# index.html

## Purpose
The webview page: a transparent document holding one canvas, scaled up with hard pixel edges.

## Components
- `#stage` canvas, sized to the window; `image-rendering: pixelated`.
- Scripts, in order: `vendor/core.js` (global `Splat`), `vendor/rig.js` (global `SplatRig`), `main.js`.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `main.js` | `#stage` exists; `Splat` and `SplatRig` loaded first | ids, script order |
| `build.rs` | page loads from `vendor/` | folder name |
