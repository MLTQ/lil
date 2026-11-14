# tray.rs

## Purpose
The menu-bar icon (macOS) or tray item (Linux). The creature's window is click-through and unfocusable,
so this is the only thing a person can click: it switches avatars, opens the settings file and quits.

## Components
### `create`
- **Does**: Builds the tray icon with the app's icon and menu, and rebuilds the menu on every `body` event.
- **Interacts with**: `main.rs` setup; the `body` event emitted by `Mind::set_body`.

### `menu`
- **Does**: A title line (`<instance>: <body name>`), an Avatar submenu, Open Settings File, Quit.
  Avatar lists the toolkit's rigged scenes (the current one greyed out), then earlier bodies from the body repo's history.

### `choose`
- **Does**: Handles a click. `scene:<path>` submits that scene, `rev:<hash>` reverts, both through `Mind::set_body` on a
  worker thread. `config` opens `lil.config.json` with the system's default app. `quit` exits.
- **Rationale**: Going through `set_body` means a menu choice is checked and committed exactly like an agent's.

### `scenes`
- **Does**: Finds scene files in `<toolkit>/scenes` that contain `b.bone(` and reads their `name:` line as text.
- **Rationale**: Listing must not run scene code, and still sculptures cannot be bodies.

## Decisions
- "Settings" opens the config file for now. Real settings items belong in this menu; add them above Quit.
- A rejected menu choice only prints the report to the app's log. There is no dialog yet.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `main.rs` | `create(&AppHandle, Arc<Mind>, &Config) -> tauri::Result<()>` | signature |
| `mind.rs` | `body_name`, `toolkit`, `history(n)` ("hash  date  subject"), `set_body`; a `body` event after each accepted body | names, the history line format |

## Notes
- Needs Tauri's `tray-icon` feature. On Linux it uses libayatana-appindicator and a StatusNotifier host (Omarchy's shell has one).
- Verified: the icon shows in the macOS menu bar and the item registers with the shell on Omarchy. Clicking the menu has not been tested by hand.
- Changes to `lil.config.json` take effect on the next start.
