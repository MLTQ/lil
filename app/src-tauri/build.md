# build.rs

## Purpose
Copies `lib/core.js` and `lib/rig.js` from the toolkit into `app/ui/vendor/` before Tauri embeds
the UI folder, so the webview loads the toolkit's own files, byte for byte.

## Components
### `main`
- **Does**: Resolves the toolkit (`$LIL_TOOLKIT`, else `../../pixel-splat-sculptures`), copies the two files, runs `tauri_build::build()`.
- **Interacts with**: `ui/index.html`, which loads `vendor/core.js` and `vendor/rig.js`.

## Decisions
- Considered a symlink in `ui/`: rejected, asset embedding and Windows handle symlinks unevenly.
- Considered serving the files through a Tauri command: rejected, script tags are simpler.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `ui/index.html` | `vendor/core.js`, `vendor/rig.js` exist after a build | file names, folder |

## Notes
- The toolkit path here is build-time only. The runtime toolkit path comes from the config.
