import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const brainModelUrl = new URL('./brain3.glb', import.meta.url).href;

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const statusEl = $('status');
const loadingEl = $('loading');
const errorEl = $('error');
const regionLabel = $('region-label');
const regionLabelName = $('region-label-name');
const regionLabelDescription = $('region-label-description');
const regionToggleDisabled = $('region-toggle-disabled');
const regionReference = $('region-reference');
const regionImage = $('region-image');
const regionReferenceText = $('region-reference-text');
const quizModal = $('quiz-modal');
const quizProgress = $('quiz-progress');
const quizQuestion = $('quiz-question');
const quizOptions = $('quiz-options');
const quizResult = $('quiz-result');
const quizNext = $('quiz-next');

let scene, camera, renderer, controls, modelRoot, glowGroup, disabledGroup;
let regions = [];
let selectedRegion = null;
let disabledRegion = null;
let quizDeck = [];
let quizIndex = 0;
let quizScore = 0;
let quizOpen = false;
let glowMaterials = [];
let disabledMaterials = [];
let modelCenter = new THREE.Vector3();
let modelRadius = 1;
let lastPointer = null;
let resizeObserver;
let regionImageRequest = 0;
const regionLabelPosition = new THREE.Vector2();
let regionLabelPositionInitialized = false;

const REGION_QUANTIZATION = 20;
const MAX_REGION_BUTTONS = 100;
const SIDEBAR_REGION_NUMBERS = new Set([1, 3, 4, 5, 6, 7, 9, 11, 12, 13]);
const DEFAULT_REGION_NAMES = new Map([
  [1, 'Temporal lobe'],
  [3, 'Cerebellum'],
  [4, 'Prefrontal cortex'],
  [5, 'Occipital lobe'],
  [6, 'Premotor cortex'],
  [7, 'Wernicke\'s area'],
  [9, 'Parietal lobe'],
  [11, 'Primary motor cortex'],
  [12, 'Auditory cortex'],
  [13, 'Broca\'s area'],
]);
const DEFAULT_REGION_DESCRIPTIONS = new Map([
  [1, 'The temporal lobes are located on both sides of the brain. These lobes help to store and retrieve memories, recognize faces and objects, and manage emotions, among other things.'],
  [3, 'The cerebellum, or "little brain," is located at the base of the brain and helps maintain balance, coordination, and fine motor skills.'],
  [4, 'The prefrontal cortex is the frontmost part of the brain, sitting right behind the forehead. It helps manage thoughts, emotions, and behavior.'],
  [5, 'The occipital lobe, locating in the back of the brain, is responsible for processing and interpreting information from the eyes.'],
  [6, 'The premotor cortex is an area of the frontal lobe that is involved in planning and coordinating voluntary movements.'],
  [7, 'Wernicke\'s area is located in the left temporal lobe and helps you understand spoken and written language.'],
  [9, 'The parietal lobe is located above the temporal lobes. It recieves sensory information and processes spatial relationships.'],
  [11, 'The primary motor cortex, located behind the premotor cortex, is responsible for executing voluntary movements bysending commands to muscles.'],
  [12, 'The auditory cortexes, located in the temporal lobes above the ears, are responsible for processing sound and hearing information.'],
  [13, 'Broca\'s area is located in the left hemisphere and is helps you to produce speech.'],
]);
const DEFAULT_QUIZ_ANSWERS = new Map([
  [1, 'Stores and retrieves memories, recognizes faces and objects, and manages emotions'],
  [3, 'Maintains balance and coordination.'],
  [4, 'Manages thoughts, emotions, and behavior.'],
  [5, 'Processes visual information.'],
  [6, 'Plans and coordinates voluntary movements.'],
  [7, 'Helps process spoken and written language.'],
  [9, 'Recieves sensory information and processes spatial relationships.'],
  [11, 'Executes voluntary movements by sending commands to muscles.'],
  [12, 'Processes sound information.'],
  [13, 'Helps to produce speech.'],
]);
const DEFAULT_DISABLED_TEXT = new Map([
  ['temporal lobe', 'Damage to the temporal lobe can affect memory, language, and auditory processing.'],
  ['cerebellum', 'Damage to the cerebellum can affect, among other things, balance and coordination.'],
  ['prefrontal cortex', 'Damage to the prefrontal cortex can impair executive functions, decision-making, and emotional control.'],
  ['occipital lobe', 'Damage to the occipital lobe can impair vision and affect the ability to identify objects.'],
  ['premotor cortex', 'Damage to the premotor cortex can affect motor planning andthe ability to execute learned movements .'],
  ["wernicke's area", "Damage to Wernicke's area can result in 'word salad' speech and an inability to understand language."],
  ['parietal lobe', 'Damage to the parietal lobe can impair sensory processing and spatial awareness.'],
  ['primary motor cortex', 'Damage to the primary motor cortex can cause weakness, paralysis, spasticity, and a lose of fine motor control.'],
  ['auditory cortex', 'Damage to the auditory cortex can affect the ability to process and interpret sound.'],
  ["broca's area", "Damage to Broca's area can result in difficulty producing speech, while not affecting language comprehension."],
]);
// Keep these tied to the model's painted colors, not to their frequency in the export.
const REGION_COLOR_ANCHORS = new Map([
  [1, [0.0762, 0.3372, 0.1384]],
  [2, [1, 1, 1]],
  [3, [0.402, 0.1946, 0]],
  [4, [0.7011, 0.0723, 0.0452]],
  [5, [0.2502, 0.3712, 0.4072]],
  [6, [0.4179, 0.2016, 0.4072]],
  [7, [0.855, 0.314, 0.2159]],
  [8, [0.2423, 0.5583, 0.7758]],
  [9, [0.0262, 0.1714, 0.3916]],
  [10, [1, 0.3968, 0.3968]],
  [11, [0.8796, 0.7084, 0.1529]],
  [12, [0.7913, 0.4452, 0.117]],
  [13, [0.4452, 0.0561, 0.0452]],
]);
const REGION_COLOR_MATCH_DISTANCE = 0.14;
const REGION_IMAGE_URLS = new Map([
  ['temporal lobe', new URL('./images/temporal lobe.png', import.meta.url).href],
  ['occipital lobe', new URL('./images/occipital lobe.png', import.meta.url).href],
  ["wernicke's area", new URL("./images/wernicke's area.png", import.meta.url).href],
  ['primary motor cortex', new URL('./images/primary motor cortex.png', import.meta.url).href],
  ['auditory cortex', new URL('./images/auditory cortex.png', import.meta.url).href],
  ["broca's area", new URL("./images/broca's area.png", import.meta.url).href],
  ["prefrontal cortex", new URL("./images/prefrontal cortex.png", import.meta.url).href],
  ["parietal lobe", new URL("./images/parietal lobe.png", import.meta.url).href],
  ["cerebellum", new URL("./images/cerebellum.png", import.meta.url).href],
  ["premotor cortex", new URL("./images/premotor cortex.png", import.meta.url).href]
]);
const DEFAULT_REGION_IMAGE_URL = new URL('./images/default.png', import.meta.url).href;
updateRegionImage();

initViewer();
wireUI();
animate();
loadModel(brainModelUrl, 'brain.glb');

function initViewer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#111720');

  camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
  camera.position.set(2.6, 1.8, 3.2);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.className = 'webgl-canvas';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D brain model. Drag to rotate and click a painted region to select it.');
  viewport.prepend(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.15;
  controls.maxDistance = 100;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xdceaff, 0x34303d, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6c9dff, 2.4);
  rim.position.set(-4, 2, -4);
  scene.add(rim);
  const fill = new THREE.PointLight(0xb68aff, 1.3, 30);
  fill.position.set(0, -3, 4);
  scene.add(fill);

  const floor = new THREE.GridHelper(20, 40, 0x303c50, 0x222b39);
  floor.position.y = -2.5;
  floor.material.transparent = true;
  floor.material.opacity = 0.25;
  scene.add(floor);

  glowGroup = new THREE.Group();
  glowGroup.name = 'selected-region-glow';
  scene.add(glowGroup);
  disabledGroup = new THREE.Group();
  disabledGroup.name = 'disabled-region-overlay';
  scene.add(disabledGroup);

  resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(viewport);
  resizeRenderer();

  renderer.domElement.addEventListener('pointerdown', (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!lastPointer || Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) > 5) return;
    pickRegion(event);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!modelRoot) return;
    renderer.domElement.style.cursor = event.buttons ? 'grabbing' : 'crosshair';
  });
}

function wireUI() {
  $('reset-view').addEventListener('click', resetCamera);
  $('quiz-button').addEventListener('click', startQuiz);
  $('quiz-close').addEventListener('click', closeQuiz);
  quizNext.addEventListener('click', showNextQuizCard);
  regionToggleDisabled.addEventListener('click', toggleDisabledRegion);
}

function resizeRenderer() {
  if (!renderer) return;
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

async function loadModel(url, fileName) {
  clearError();
  loadingEl.classList.remove('hidden');
  statusEl.textContent = 'Loading model…';

  if (modelRoot) {
    scene.remove(modelRoot);
    disposeObject(modelRoot);
    modelRoot = null;
  }
  clearGlow();
  clearDisabledOverlay();
  regions = [];
  selectedRegion = null;
  disabledRegion = null;
  updateSelectedCard(null);

  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(url);
    modelRoot = gltf.scene;
    modelRoot.name = fileName;
    scene.add(modelRoot);
    modelRoot.updateMatrixWorld(true);
    prepareModel(modelRoot);
    statusEl.textContent = 'Model loaded';
    loadingEl.classList.add('hidden');
    resetCamera();
    detectRegions(modelRoot);
  } catch (error) {
    console.error(error);
    loadingEl.classList.add('hidden');
    statusEl.textContent = 'Could not load model';
    showError('Could not load src/brain.glb.');
  }
}

function prepareModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  modelCenter = box.getCenter(new THREE.Vector3());
  modelRadius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

  // Center the model without changing its mesh data or vertex colors.
  root.position.sub(modelCenter);
  root.updateMatrixWorld(true);

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }
    }
  });
  modelCenter.set(0, 0, 0);
}

function countMeshes(root) {
  let count = 0;
  root.traverse((obj) => { if (obj.isMesh) count++; });
  return count;
}

function detectRegions(root) {
  const samples = new Map();
  const meshes = [];
  let hasVertexColors = false;

  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    const colorAttr = obj.geometry.attributes.color;
    if (!colorAttr) return;
    hasVertexColors = true;
    meshes.push(obj);
    for (let i = 0; i < colorAttr.count; i++) {
      const color = readColor(colorAttr, i);
      const key = colorKey(color);
      const entry = samples.get(key) || { key, color, count: 0 };
      entry.count++;
      samples.set(key, entry);
    }
  });

  if (!hasVertexColors || samples.size === 0) {
    showError('This model does not appear to contain vertex colors. In Blender, select the mesh and export as glTF/GLB with its color attribute included.');
    statusEl.textContent = 'Vertex colors not found';
    return;
  }

  const anchors = [...REGION_COLOR_ANCHORS.entries()].map(([number, values]) => ({
    number,
    color: new THREE.Color(...values),
    count: 0,
    keys: new Set(),
  }));
  const keyToRegion = new Map();
  for (const sample of samples.values()) {
    let best = null;
    let bestDistance = Infinity;
    for (const anchor of anchors) {
      const d = colorDistance(anchor.color, sample.color);
      if (d < bestDistance) { bestDistance = d; best = anchor; }
    }
    if (best && bestDistance <= REGION_COLOR_MATCH_DISTANCE) {
      best.count += sample.count;
      best.keys.add(sample.key);
      keyToRegion.set(sample.key, best.number - 1);
    }
  }
  regions = anchors
    .filter((anchor) => anchor.count > 0)
    .map((anchor) => ({
      id: anchor.number - 1,
      color: anchor.color,
      count: anchor.count,
      keys: anchor.keys,
      name: DEFAULT_REGION_NAMES.get(anchor.number) || `Region ${anchor.number}`,
      description: DEFAULT_REGION_DESCRIPTIONS.get(anchor.number) || 'Description coming soon.',
      quizAnswer: DEFAULT_QUIZ_ANSWERS.get(anchor.number) || 'Placeholder answer.',
    }));

  for (const mesh of meshes) {
    mesh.userData.regionColorAttr = mesh.geometry.attributes.color;
    mesh.userData.keyToRegion = keyToRegion;
    mesh.userData.regions = regions;
  }

}

function pickRegion(event) {
  if (!modelRoot || quizOpen) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(modelRoot, true);
  for (const hit of hits) {
    const mesh = hit.object;
    const colorAttr = mesh.userData.regionColorAttr;
    if (!colorAttr || !hit.face) continue;
    const ids = [hit.face.a, hit.face.b, hit.face.c];
    const counts = new Map();
    for (const vertexIndex of ids) {
      const key = colorKey(readColor(colorAttr, vertexIndex));
      const regionId = mesh.userData.keyToRegion.get(key);
      if (regionId !== undefined) counts.set(regionId, (counts.get(regionId) || 0) + 1);
    }
    if (!counts.size) continue;
    const bestId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    selectRegion(bestId);
    return;
  }
  selectRegion(null);
}

function selectRegion(regionId) {
  selectedRegion = regions.find((r) => r.id === regionId && isSelectableRegion(r)) || null;
  clearGlow();
  if (selectedRegion && modelRoot) createGlow(selectedRegion);
  updateSelectedCard(selectedRegion);
}

function isSelectableRegion(region) {
  return SIDEBAR_REGION_NUMBERS.has(region.id + 1);
}

function createGlow(region) {
  region.anchorWorld = null;
  region.anchorCandidates = [];
  const glowMaterial = createMaskedGlowMaterial(
    region.color.clone().lerp(new THREE.Color('#ffffff'), 0.2),
    0.92,
    THREE.DoubleSide,
    modelRadius * 0.004,
  );
  const outerMaterial = createMaskedGlowMaterial(
    region.color.clone().lerp(new THREE.Color('#a6c9ff'), 0.35),
    0.23,
    THREE.BackSide,
    0,
  );
  glowMaterials.push(glowMaterial, outerMaterial);

  modelRoot.updateMatrixWorld(true);
  modelRoot.traverse((mesh) => {
    const result = buildRegionGeometry(mesh, region);
    if (!result) return;
    region.anchorCandidates.push(...result.anchorCandidates);
    const geometry = result.geometry;

    const inner = new THREE.Mesh(geometry, glowMaterial);
    inner.matrixAutoUpdate = false;
    inner.matrix.copy(mesh.matrixWorld);
    inner.renderOrder = 10;
    glowGroup.add(inner);

    const shellGeometry = geometry.clone();
    const shell = new THREE.Mesh(shellGeometry, outerMaterial);
    shell.matrixAutoUpdate = false;
    shell.matrix.copy(mesh.matrixWorld);
    shell.scale.setScalar(1.012);
    // Keep shell expansion centered on the model's local origin.
    shell.matrixAutoUpdate = true;
    shell.position.copy(mesh.getWorldPosition(new THREE.Vector3()));
    shell.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));
    shell.scale.copy(mesh.getWorldScale(new THREE.Vector3())).multiplyScalar(1.012);
    shell.renderOrder = 9;
    glowGroup.add(shell);

  });
}

function buildRegionGeometry(mesh, region) {
  if (!mesh.isMesh || !mesh.geometry?.attributes?.color) return null;
  const source = mesh.geometry;
  const pos = source.attributes.position;
  const colorAttr = source.attributes.color;
  const indices = source.index;
  const triCount = indices ? indices.count / 3 : pos.count / 3;
  const positions = [];
  const normals = [];
  const selections = [];
  const anchorCandidates = [];
  const sourceNormals = source.attributes.normal;

  for (let t = 0; t < triCount; t++) {
    const vi = indices
      ? [indices.getX(t * 3), indices.getX(t * 3 + 1), indices.getX(t * 3 + 2)]
      : [t * 3, t * 3 + 1, t * 3 + 2];
    const ids = vi.map((i) => mesh.userData.keyToRegion?.get(colorKey(readColor(colorAttr, i))));
    const selection = ids.map((id) => id === region.id ? 1 : 0);
    if (!selection.some(Boolean)) continue;

    for (let j = 0; j < 3; j++) {
      const i = vi[j];
      const point = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      positions.push(point.x, point.y, point.z);
      if (sourceNormals) normals.push(sourceNormals.getX(i), sourceNormals.getY(i), sourceNormals.getZ(i));
      else normals.push(0, 1, 0);
      selections.push(selection[j]);
      if (selection[j]) anchorCandidates.push(point.applyMatrix4(mesh.matrixWorld));
    }
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('selection', new THREE.Float32BufferAttribute(selections, 1));
  geometry.computeBoundingSphere();
  return { geometry, anchorCandidates };
}

function createDisabledOverlay(region) {
  clearDisabledOverlay();
  const material = createMaskedGlowMaterial(
    new THREE.Color('#4a4a4a'),
    0.82,
    THREE.DoubleSide,
    modelRadius * 0.004,
    THREE.NormalBlending,
  );
  disabledMaterials.push(material);
  modelRoot.updateMatrixWorld(true);
  modelRoot.traverse((mesh) => {
    const result = buildRegionGeometry(mesh, region);
    if (!result) return;
    const overlay = new THREE.Mesh(result.geometry, material);
    overlay.matrixAutoUpdate = false;
    overlay.matrix.copy(mesh.matrixWorld);
    overlay.renderOrder = 12;
    disabledGroup.add(overlay);
  });
}

function createMaskedGlowMaterial(
  color,
  opacity,
  side,
  surfaceOffset,
  blending = THREE.AdditiveBlending,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: color },
      opacity: { value: opacity },
      surfaceOffset: { value: surfaceOffset },
    },
    vertexShader: `
      attribute float selection;
      varying float vSelection;
      uniform float surfaceOffset;

      void main() {
        vSelection = selection;
        vec3 offsetPosition = position + normalize(normal) * surfaceOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(offsetPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying float vSelection;

      void main() {
        float edgeFade = smoothstep(0.05, 0.95, vSelection);
        gl_FragColor = vec4(color, edgeFade * opacity);
      }
    `,
    transparent: true,
    blending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side,
    toneMapped: false,
  });
}

function clearGlow() {
  if (!glowGroup) return;
  while (glowGroup.children.length) {
    const child = glowGroup.children[0];
    glowGroup.remove(child);
    child.geometry?.dispose();
  }
  for (const material of glowMaterials) material.dispose();
  glowMaterials = [];
  if (selectedRegion) {
    selectedRegion.anchorWorld = null;
    selectedRegion.anchorCandidates = [];
  }
  regionLabelPositionInitialized = false;
  regionLabel.hidden = true;
}

function clearDisabledOverlay() {
  if (disabledGroup) {
    while (disabledGroup.children.length) {
      const child = disabledGroup.children[0];
      disabledGroup.remove(child);
      child.geometry?.dispose();
    }
  }
  for (const material of disabledMaterials) material.dispose();
  disabledMaterials = [];
}

function updateSelectedCard(region) {
  if (!region) {
    regionLabel.hidden = true;
    return;
  }
  regionLabelName.textContent = region.name;
  regionLabelDescription.textContent = region.description;
  regionToggleDisabled.textContent = disabledRegion === region ? 'Enable' : 'Disable';
  regionLabel.hidden = false;
  updateRegionImage();
}

function toggleDisabledRegion() {
  if (!selectedRegion || quizOpen) return;
  if (disabledRegion === selectedRegion) {
    disabledRegion = null;
    clearDisabledOverlay();
  } else {
    disabledRegion = selectedRegion;
    createDisabledOverlay(disabledRegion);
  }
  updateRegionImage();
  updateSelectedCard(selectedRegion);
}

function updateRegionImage() {
  const region = disabledRegion;
  const imageKey = region ? normalizeRegionName(region.name) : '';
  const imageUrl = REGION_IMAGE_URLS.get(imageKey) || DEFAULT_REGION_IMAGE_URL;
  regionImage.alt = region ? `${region.name} reference` : 'Brain region reference';
  regionReference.hidden = false;
  regionReferenceText.textContent = region
    ? DEFAULT_DISABLED_TEXT.get(normalizeRegionName(region.name)) || 'Placeholder information about this disabled region.'
    : 'Walter White';
  const requestId = ++regionImageRequest;
  cropTransparentMargins(imageUrl)
    .then((croppedUrl) => {
      if (requestId === regionImageRequest) regionImage.src = croppedUrl;
    })
    .catch(() => {
      if (requestId === regionImageRequest && imageUrl !== DEFAULT_REGION_IMAGE_URL) {
        regionImage.src = DEFAULT_REGION_IMAGE_URL;
      }
    });
}

function normalizeRegionName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cropTransparentMargins(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        reject(new Error('Could not create an image canvas.'));
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width;
      let top = canvas.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }
      if (right < left || bottom < top) {
        resolve(url);
        return;
      }
      const cropWidth = right - left + 1;
      const cropHeight = bottom - top + 1;
      const cropped = document.createElement('canvas');
      cropped.width = cropWidth;
      cropped.height = cropHeight;
      cropped.getContext('2d').drawImage(
        canvas,
        left,
        top,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );
      resolve(cropped.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });
}

function resetCamera() {
  if (!camera || !controls) return;
  const bounds = modelRoot ? new THREE.Box3().setFromObject(modelRoot) : null;
  const center = bounds?.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
  const size = bounds?.isEmpty() ? new THREE.Vector3(1, 1, 1) : bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || modelRadius;
  const distance = Math.max(2.2, radius * 2.65);
  const viewDirection = new THREE.Vector3(0.8, 0.53, 1).normalize();
  camera.position.copy(center).addScaledVector(viewDirection, distance);
  controls.target.copy(center);
  controls.minDistance = Math.max(0.05, radius * 0.25);
  controls.maxDistance = Math.max(10, radius * 12);
  controls.update();
}

function startQuiz() {
  const selectableRegions = regions.filter(isSelectableRegion);
  if (!selectableRegions.length) return;
  quizDeck = shuffle([...selectableRegions]);
  quizIndex = 0;
  quizScore = 0;
  quizOpen = true;
  quizModal.hidden = false;
  regionLabel.hidden = true;
  showQuizCard();
}

function closeQuiz() {
  quizOpen = false;
  quizModal.hidden = true;
}

function showQuizCard() {
  const region = quizDeck[quizIndex];
  quizQuestion.hidden = false;
  quizOptions.hidden = false;
  quizProgress.textContent = `Question ${quizIndex + 1} of ${quizDeck.length}`;
  quizQuestion.textContent = `What does the ${region.name} do?`;
  quizResult.hidden = true;
  quizNext.hidden = true;
  quizOptions.innerHTML = '';

  const wrongAnswers = shuffle(
    quizDeck
      .filter((candidate) => candidate.id !== region.id)
      .map((candidate) => candidate.quizAnswer),
  ).slice(0, 3);
  for (const answer of shuffle([region.quizAnswer, ...wrongAnswers])) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'quiz-option';
    option.textContent = answer;
    option.addEventListener('click', () => answerQuiz(option, answer === region.quizAnswer, region.quizAnswer));
    quizOptions.append(option);
  }
}

function answerQuiz(selectedOption, correct, correctAnswer) {
  const options = quizOptions.querySelectorAll('.quiz-option');
  for (const option of options) option.disabled = true;
  if (correct) {
    quizScore++;
    selectedOption.classList.add('correct');
  } else {
    selectedOption.classList.add('wrong');
    for (const option of options) {
      if (option.textContent === correctAnswer) option.classList.add('correct');
    }
  }
  quizNext.textContent = quizIndex === quizDeck.length - 1 ? 'See result' : 'Next';
  quizNext.hidden = false;
}

function showNextQuizCard() {
  if (quizIndex === quizDeck.length - 1) {
    quizQuestion.hidden = true;
    quizOptions.hidden = true;
    quizProgress.textContent = 'Quiz complete';
    quizResult.textContent = `You got ${quizScore} out of ${quizDeck.length} correct.`;
    quizResult.hidden = false;
    quizNext.hidden = true;
    return;
  }
  quizIndex++;
  showQuizCard();
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}
function clearError() {
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function readColor(attr, index) {
  return new THREE.Color(attr.getX(index), attr.getY(index), attr.getZ(index));
}
function colorKey(color) {
  const q = (v) => Math.round(THREE.MathUtils.clamp(v, 0, 1) * REGION_QUANTIZATION);
  return `${q(color.r)},${q(color.g)},${q(color.b)}`;
}
function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}
function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls?.update();
  updateRegionLabel();
  renderer?.render(scene, camera);
}

function updateRegionLabel() {
  if (!selectedRegion?.anchorCandidates?.length || !modelRoot) {
    regionLabel.hidden = true;
    return;
  }

  let bestPoint = null;
  let bestDepth = Infinity;
  for (const point of selectedRegion.anchorCandidates) {
    const projectedPoint = point.clone().project(camera);
    if (projectedPoint.z < -1 || projectedPoint.z > 1) continue;
    if (projectedPoint.z < bestDepth) {
      bestDepth = projectedPoint.z;
      bestPoint = projectedPoint;
    }
  }
  if (!bestPoint) {
    regionLabel.hidden = true;
    regionLabelPositionInitialized = false;
    return;
  }
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  const target = new THREE.Vector2(
    (bestPoint.x * 0.5 + 0.5) * width,
    (-bestPoint.y * 0.5 + 0.5) * height,
  );
  if (!regionLabelPositionInitialized) {
    regionLabelPosition.copy(target);
    regionLabelPositionInitialized = true;
  } else {
    regionLabelPosition.lerp(target, 0.14);
  }
  regionLabel.style.left = `${regionLabelPosition.x}px`;
  regionLabel.style.top = `${regionLabelPosition.y}px`;
  regionLabel.hidden = false;
}
