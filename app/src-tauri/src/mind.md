# mind.rs

## Purpose
The creature's state as driven from outside. Holds the live body, the current baseline state, and how the
body shows each state. Every outside input (hooks, MCP, plain HTTP) ends in a call here, which validates it
and emits an event to the webview. It also owns the body repo and swaps the live body when a new one is accepted.

## Components
### `Mind`, `Live`
- **Does**: `Live` (behind a lock) is the packed body JSON, name, gestures with `once`, bones and state looks. `Mind` adds the current `Base` and the `Bodies` repo.
- **Interacts with**: built in `main.rs`; shared as `Arc<Mind>` with `server.rs` and the `boot` command.

### `set_body`
- **Does**: `{ scene | revert, note? }` -> `Bodies::submit` or `revert`. If accepted: builds the new `Live`, re-resolves the current state for it, emits `body { body, base }`. Returns `(accepted, text)` where the text starts with ACCEPTED or REJECTED and carries the checker's full report.
- **Rationale**: The live body is replaced only after the commit exists, so screen and repo cannot disagree.

### `set_state`
- **Does**: Resolves a baseline state (idle, thinking, tool, waiting, error) to `{ state, gesture, energy, for }` and emits `base`.
- **Rationale**: A configured gesture the body lacks falls back to `idle`, so any body can show every state.

### `express`
- **Does**: Validates `{ gesture?, look?, energy?, seconds? }`, clamps values, emits `express`, returns a sentence for the agent.
- **Rationale**: Unknown gestures are an error that lists the valid ones, so the agent can correct itself in one step.

### `describe`
- **Does**: The `get_body` answer: name, gestures (holds / plays once), bones, current state, the gesture each state uses, scene file path, toolkit path, recent history, and optionally the scene text.

### `state_for_hook`
- **Does**: Maps a Claude Code hook event name to a baseline state.

## Decisions
- Two layers, not one: the baseline holds until the next hook; an expression is temporary and shows on top.
  A single "current gesture" would let a hook erase what the agent just expressed.
- State looks come from three layers: built-in (idle only) < the instance config's `states` < the scene's own top-level `states`. A body that renames its gestures can carry its own mapping.
- Expressions are not stored here; the webview owns their timing.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `ui/main.js` | events `base { state, gesture, energy, for }`, `express { gesture?, look?, energy?, seconds }`, `body { body, base }` | names, fields |
| `mcp.rs`, `server.rs` | `set_state`, `express`, `set_body`, `describe(source)`, `base`, `packed`, `body_name`, `state_for_hook`; `Express`, `SetBody` (unknown fields rejected) | signatures |

## Notes
- If the committed body no longer builds at start-up, the app exits with the reason instead of showing a different body.
