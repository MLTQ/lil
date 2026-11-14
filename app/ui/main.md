# main.js

## Purpose
The creature's render loop, adapted from the toolkit's `tools/rig-viewer.template.html` with the
page and controls removed. It owns the `intent`, the one object that drives the body.

## Components
### boot block, `wear`
- **Does**: Calls `boot` and builds the renderer. `wear(packed)` decodes a body and builds its `Rig`, controller and gesture table; it runs at start and on every `body` event, which also drops the running expression and lets the springs settle.

### `intent`
- **Does**: `{ gesture, since, look: [x, y], energy }`, the shape the toolkit's controller takes. Written only by `step`.

### `base`, `expr`, `want`
- **Does**: `base` is the baseline from the `base` event (and `boot`); `expr` is the agent's expression from the `express` event, with an end time.
  `want` picks what to show: the expression's fields where it has them, the baseline otherwise. A gesture that plays once or has a `for` time settles to idle when spent.
- **Rationale**: Layering here keeps timing in one clock (the render clock) and lets a hook change the baseline under a running expression.

### `cursor` listener
- **Does**: Maps the offset from the window centre to a look goal in [-1, 1]. Direction is kept; length saturates (`REACH` = 260 px).
  `held` raises `intent.energy` to 1 while the creature is carried and lets it settle back after.

### `step`, `draw`
- **Does**: Advance time, return `once` gestures to idle, ease the look, update the rig; draw with `{ alpha: true }`.

### frame scheduler
- **Does**: Runs `step` + `draw` at `render.fps` on average and reports cost through `perf` every 5 seconds.

## Decisions
- First scheduler skipped frames by elapsed time and gave 20 fps for a 25 fps setting on a 60 Hz display; replaced with a due-time accumulator.
- Camera framing (pitch 0.48, scale `res / 2.55`) copied from make.js so the body looks as it does in the checker's sheets.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `main.rs` | calls `boot`, `perf`, `fail` | command names and arguments |
| `cursor.rs` | listens for `cursor { dx, dy, held }` | event name |
| `mind.rs` | listens for `base { state, gesture, energy, for }` and `express { gesture?, look?, energy?, seconds }` | event names, fields |
| `index.html` | globals `Splat`, `SplatRig`, `window.__TAURI__`; a `#stage` canvas | load order |

## Notes
- An expression's `look` replaces the cursor as the look target while it lasts.
