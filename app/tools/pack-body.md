# pack-body.js

## Purpose
Turns a scene file into the JSON "body" the webview renders: packed splats, bones and the `rig`
block. It is the only place scene code runs, and it runs in Node, outside the app.

## Components
### script body
- **Does**: `require`s `<toolkit>/lib`, calls `load()` on the scene, centres it vertically, prints JSON to stdout.
- **Interacts with**: `lib/index.js` `load` and `DRIFT`; `body.rs` (which pipes this file to `node -`).
- **Rationale**: Output has the same fields `tools/rigcheck.js` embeds in `rig.html`, so the webview
  code matches the toolkit's rig viewer.

## Decisions
- Does not call `tools/make.js`: checking is `bodies.rs`'s job, which runs make.js first and this second.
- The vertical-centring block is copied from make.js because make.js does not export it and must not be edited.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `body.rs` | args `<toolkit> <scene>`; JSON on stdout; exit 1 + message on stderr on failure | arg order, exit codes |
| `ui/main.js` | fields `name N bg cy bob glow drift bones rig ramps D bA bB bW` (typed arrays as base64) | renaming or dropping a field |
| `mind.rs` | `name`, `bones[].name`, `rig.gestures`, and `states` (the scene's optional top-level `states` object, passed through) | renaming or dropping a field |
