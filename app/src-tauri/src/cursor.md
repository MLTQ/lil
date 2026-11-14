# cursor.rs

## Purpose
The polling loop behind everything mouse-related. A click-through window receives no mouse or key events,
so this thread reads the cursor, the window and the grab key globally. It feeds the webview's look direction
and lets the user carry the creature.

## Components
### `Sample`
- **Does**: One reading: cursor, window top-left, window size, grab key down. Logical pixels.

### `follow`
- **Does**: Polls every 33 ms (16 ms while carried). Emits `cursor { dx, dy, held }` on change and at least once a second.
  While the grab modifier is held with the cursor on the window, moves the window with the cursor; on release, saves the position.
- **Interacts with**: `listen('cursor')` in `ui/main.js`, `config::save_position`.
- **Rationale**: The once-a-second resend exists because a resting cursor was never delivered to a webview that started listening late.

### `Desk`
- **Does**: Picks the backend: `hypr.rs` inside Hyprland, the windowing system plus `keys.rs` elsewhere. `sample`, `move_to`, `place`.

## Decisions
- Carrying needs no click: hold the modifier over the creature and move. Considered making the window briefly
  non-click-through and using a normal drag; rejected because it needs pointer events, which Hyprland's `no_focus` blocks,
  and because polling works the same on both platforms.
- Raw offsets are sent; the mapping to a look vector lives in the webview.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `ui/main.js` | event `cursor`, payload `{ dx, dy, held }`, +x right, +y down, logical pixels from the window centre | event name, units, sign |
| `hypr.rs` | `Sample` fields | renames |
| `main.rs` | `follow(AppHandle, WebviewWindow, Config)` | signature |
