# config.rs

## Purpose
Reads the one per-instance file, `lil.config.json`. Everything that differs between two creature
instances lives there; nothing else in the app holds a path.

## Components
### `Config`, `WindowCfg`, `RenderCfg`
- **Does**: `name`, `toolkit`, `scene`, `node`, `port`, `bodyRepo`, `window { corner, margin, scale, grab, position }`, `render { res, fps, yaw }`,
  `states { <state>: { gesture, energy, for? } }`.
- **Interacts with**: `window.rs` (corner, margin, scale, res), `body.rs` (node, toolkit, scene), `main.rs` (render).

### `load`
- **Does**: Finds the file (`--config <file>`, then `$LIL_CONFIG`, then nearest at or above the working
  directory), parses it, and makes `toolkit` and `scene` absolute relative to the file's folder.

### `save_position`
- **Does**: Writes `window.position` into the config file when the creature is dropped, leaving other keys alone.
- **Interacts with**: `follow` in `cursor.rs`.

## Decisions
- The dropped position goes into the same file rather than a state file: one file per instance. The file is re-serialised, so hand formatting is lost.
- Relative paths resolve against the config file, not the working directory, so an instance can be started from anywhere.
- Window size is `res * scale` rather than a free number, so pixels stay square and whole.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `body.rs`, `window.rs`, `main.rs` | field names above; `toolkit` and `scene` absolute after `load` | renames |
| users | `toolkit` and `scene` required; the rest default | making a defaulted field required |

## Notes
- `grab` is alt, ctrl, shift or super; an empty string turns carrying off.
- `states` names this body's gestures for idle, thinking, tool, waiting and error; `mind.rs` falls back to `idle` for a gesture the body lacks.
- `bodyRepo` defaults to `bodies/<name>` beside the config. `scene` is only the seed for a new body repo; after that the repo's `body.js` is the body.
