# bodies.rs

## Purpose
The creature's body repository: a git repo of its own holding `body.js` (the scene file that is the body's
source of truth) and `report.txt`. This module is the gate every body change passes through and the reason
the form has history.

## Components
### `Bodies::open`
- **Does**: Creates the repo on first run (`git init`, `.gitignore` for `.stage/`), seeds `body.js` from the config's `scene`, and links `.stage/lib` to the toolkit's `lib`.
- **Rationale**: Scene files say `require('../lib')`. Staging at `.stage/scenes/body.js` next to that link lets them run unchanged, outside the toolkit folder.

### `submit`
- **Does**: Stage the source -> run the toolkit's `tools/make.js` -> if it passes, pack it -> write `body.js` and `report.txt` -> commit. Returns the report either way.
- **Interacts with**: `body::check`, `body::pack`; called by `Mind::set_body`.
- **Rationale**: Nothing in the repo changes until both the checker and the packer succeed, so a rejected body cannot leave a half-written state.

### `revert`
- **Does**: Reads `body.js` from an earlier commit and submits it again as a new commit.
- **Rationale**: Re-checking means a body that no longer passes (the toolkit changed) is not silently restored; history only moves forward.

### `pack_current`, `history`, `source`, `file`
- **Does**: Pack the committed body at start-up; list recent commits; return the scene text and path.

## Decisions
- The checker is `tools/make.js` run as a child process, unmodified, with its own limits. The app adds one check the tool cannot: a body must have bones.
- Commits are authored as `lil (<instance>)` with signing off, so they work without the user's git identity and do not prompt.
- Submitting the same source twice makes no new commit; the existing HEAD is reported.
- `rig.png` and `sheet.png` are not committed: they are derived, and binary churn would bloat the history.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `mind.rs` | `open(&Config)`, `submit(src, note)`, `revert(rev)` -> `Outcome { report, packed, commit, images }`; `pack_current`, `history(n)`, `source`, `file`, `toolkit` | signatures, field names |
| users | repo layout: `body.js`, `report.txt` at the root | renaming the files |

## Notes
- A scene is JavaScript and runs in Node with the user's permissions. The agent submitting it can already run code; do not expose `set_body` to anything less trusted.
- Unix only (`std::os::unix::fs::symlink`).
