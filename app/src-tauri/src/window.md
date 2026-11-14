# window.rs

## Purpose
Creates the one window and places it: transparent, frameless, no shadow, always on top, on every
Space, out of the Dock and app switcher, click-through.

## Components
### `create`
- **Does**: Builds the window at `res * scale` logical pixels, sets `set_ignore_cursor_events(true)`, calls `place`.
- **Interacts with**: `Config`, `main.rs` setup, `cursor.rs` (takes the returned window).

### `place`
- **Does**: Puts the window in the configured corner of the primary monitor's work area, `margin` in from the edges.
- **Rationale**: Work area, not full size, so it clears the menu bar and the Dock.

### `strip_titlebar` (Linux)
- **Does**: Hides the client-side header bar that appears on Wayland even with decorations off, and keeps it hidden.

## Decisions
- `set_decorations(false)` after creation did not remove the header bar; hiding the GTK widget did.
- Built in code instead of `tauri.conf.json` because size and position come from the instance config.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `main.rs` | `create(&AppHandle, &Config) -> tauri::Result<WebviewWindow>`, label `main` | label (capabilities/default.json names it) |

## Notes
- On Wayland the compositor ignores always-on-top and position; `hypr.rs` places the window and the shipped rule pins it.
- `place` uses `window.position` when the config has one.
- Only the primary monitor is supported.
