# Brain Atlas — Interactive Vertex-Painted Brain Viewer

A minimal local Three.js website that automatically loads `src/brain.glb`, detects its vertex-painted colors, and lets you select allowed regions with a glow effect.

## Requirements

- Node.js 20.19+ or 22.12+ (recommended for Vite 7)
- `src/brain.glb` exported from Blender as `.glb`

## Run locally

1. Unzip this project folder.
2. Open a terminal in the `brain-region-viewer` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.
6. The viewer automatically loads `src/brain.glb`.

## Exporting from Blender

1. Select your brain mesh.
2. Choose **File → Export → glTF 2.0**.
3. Choose **GLB** as the format.
4. Make sure the mesh's vertex color attribute is included in the export. In recent Blender versions, vertex colors are typically stored as a color attribute on the mesh and exported by the glTF exporter.
5. Export and load the resulting `.glb` into the viewer.

If the model has a material that doesn't use its color attribute, the GLB may not display as expected. Test the export by opening it in a glTF viewer before troubleshooting the website.

## Features

- Automatically loads `src/brain.glb`
- Detects groups of similar vertex colors
- Click an allowed region on the model to see its name and description
- Disable one selected region to gray it out, or enable it again
- Take a centered flashcard quiz with four answer choices per region
- Selected region receives a bright overlay and a translucent outer shell with softly feathered boundaries
- Orbit, zoom, and reset camera
- Responsive layout

## Notes / limitations

- The app groups similar vertex colors. Regions that use the exact same color are indistinguishable to the app.
- Region IDs are matched to stable color anchors in `src/main.js`, so changing mesh resolution or color frequency will not reorder the named regions. If the painted colors themselves change, update `REGION_COLOR_ANCHORS`.
- Highlight boundaries are feathered across triangles that straddle two color regions. This softens low-resolution edges without changing the model geometry or region detection.
- Region names are generic (`Region 1`, `Region 2`, etc.); rename them in `src/main.js` if you know the anatomy/color mapping.
- Only Regions 1–9 and 11–13 are shown and selectable.
- The quiz uses the same selectable regions and temporarily disables model selection while open.
- The bottom-left reference image changes for regions with an image in `src/images`; regions without a matching image use `default.png`.

## Build a production bundle

```bash
npm run build
```

The output will be written to `dist/`.
