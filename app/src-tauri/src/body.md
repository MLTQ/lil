# body.rs

## Purpose
Runs Node on a scene file. Two jobs: pack a scene into the JSON the webview renders, and run the toolkit's checker.

## Components
### `pack`
- **Does**: `node - <toolkit> <scene>` with the embedded packer on stdin; returns the body JSON or the error text.
- **Interacts with**: `tools/pack-body.js` (via `include_str!`).

### `check`
- **Does**: `node <toolkit>/tools/make.js <scene> --out <dir>`; returns its exit verdict and its report text.

### `node` (private)
- **Does**: Spawns Node, collects output, kills it after 90 seconds.
- **Rationale**: A scene from an agent may never finish building.

## Decisions
- Packer embedded with `include_str!` and piped to `node -`, so there is no script path to configure or lose.
- The checker is not embedded: it must be the toolkit's own file so its limits cannot drift.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `bodies.rs` | `pack(node, toolkit, scene) -> Result<String, String>`, `check(node, toolkit, scene, out) -> Result<Run, String>` | signatures |

## Notes
- The crab takes about 0.3 s to check and pack on the Mac; the frog about 1.3 s.
