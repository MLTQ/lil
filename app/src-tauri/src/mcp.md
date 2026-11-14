# mcp.rs

## Purpose
The MCP protocol layer: JSON-RPC messages in, replies out, three tools. No networking here; `server.rs` feeds it.

## Components
### `handle`
- **Does**: `initialize`, `ping`, `tools/list`, `tools/call`. Notifications (no `id`) return None.
- **Interacts with**: `POST /mcp` in `server.rs`; `Mind::express`, `Mind::describe`.

### `tools`
- **Does**: Schemas and descriptions for `express({ gesture?, look?, energy?, seconds? })`, `get_body({ source? })` and `set_body({ scene | revert, note? })`.
- **Rationale**: The descriptions must stand alone; an agent may have the tools without the embodiment skill.

## Decisions
- Hand-written instead of an MCP SDK: three methods over plain HTTP did not justify an async runtime and a dependency tree.
- Streamable HTTP without streaming: one JSON reply per POST, no sessions, GET returns 405. Nothing here is long-running.
- Tool failures (unknown gesture, bad arguments) are tool results with `isError`, not protocol errors, so the model sees the message.
- `seconds` was added to the brief's three parameters so the agent controls how long an expression lasts.
- `set_body` takes the scene as text, not a path, so agents without a shared filesystem can use it. `revert` and `note` were added for rollback and commit messages.
- A rejected body is a tool result with `isError`, carrying the full report.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `server.rs` | `handle(&Mind, &AppHandle, &Value) -> Option<Value>` | signature |
| MCP clients | tool names `express`, `get_body`, `set_body`; protocol 2025-06-18, 2025-03-26 or 2024-11-05 | tool names, schemas |

## Notes
- `express` and `get_body` have been called by a real client (a Claude Code session). `set_body` has been exercised through `POST /body`, which runs the same code, not yet through an MCP client.
