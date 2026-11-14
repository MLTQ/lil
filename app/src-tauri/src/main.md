# main.rs

## Purpose
Entry point. Loads the config, packs the body, builds the `Mind`, starts Tauri, creates the creature window,
starts the cursor loop and the HTTP server, and exposes the commands the webview calls.

## Components
### `boot` (command)
- **Does**: Returns `{ body, render, base }`: the packed body, render settings and the current baseline state.
- **Interacts with**: `Mind`, `config::RenderCfg`, `ui/main.js`.
- **Rationale**: The body is packed in `main` before any window exists, so a scene that does not build stops start-up with a message.

### `perf` (command)
- **Does**: Prints the webview's frame cost, frame rate, look vector and current gesture and energy to stderr.

### `fail` (command)
- **Does**: Prints an error thrown by the webview script.

### `--print-hyprland-rules` (Linux)
- **Does**: Prints `hypr::rules` for this instance and exits.

### `--quit`
- **Does**: Posts `/quit` to the running instance on the config's port and reports whether one was running.
- **Rationale**: The window is click-through and has no Dock icon, so there is nothing to click to close it.

### `main`
- **Does**: Config -> `Mind::new` (opens the body repo, packs the committed body) -> builder -> `ActivationPolicy::Accessory` on macOS (no Dock icon) -> `window::create` -> `cursor::follow` -> `server::start` -> `tray::create`.

## Decisions
- On Linux `WEBKIT_DISABLE_DMABUF_RENDERER=1` is set unless already defined: without it WebKitGTK died with Wayland protocol error 71 on the NVIDIA test machine.
- `body` is returned as a JSON string inside the response; parsing it twice costs nothing at this size.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `ui/main.js` | `boot` -> `{ body: string, render: { res, fps, yaw }, base }`; `perf({ ms, fps, look, gesture })`; `fail({ message })` | names, argument shapes |

## Notes
- Start-up errors (bad config, scene does not build, port in use) print one line and exit.
