# server.rs

## Purpose
The instance's one network surface: an HTTP server on 127.0.0.1 at the configured port. Agents use MCP on it,
harness hooks post events to it, anything else can set states with a plain POST.

## Components
### `start`
- **Does**: Binds `127.0.0.1:<port>` and serves requests on four worker threads.

### `route`
- `POST /mcp`: MCP (see `mcp.rs`). `GET /mcp`: 405.
- `POST /hook`: body is a Claude Code hook event; `hook_event_name` becomes a baseline state. Always 200 with an empty body.
- `POST /state/<name>`: set a baseline state directly (for harnesses without HTTP hooks).
- `POST /express`: the same expression as the MCP tool.
- `GET /health`, `GET /body`: current state and body description.
- `POST /body`: `{ scene | revert, note? }`, the same change as the MCP `set_body`. 200 accepted, 422 rejected, report in both.
- `POST /quit`: closes the app. `lil --quit` uses it; the window itself cannot be clicked.

### `local_only`
- **Does**: Rejects requests whose Host is not a loopback name, or whose Origin (if any) is not loopback.
- **Rationale**: Binding to localhost does not stop a web page in the user's browser from posting to it; these two checks do.

## Decisions
- `tiny_http`, synchronous. Four workers because `set_body` takes seconds and hook posts must not queue behind it.
- `/hook` never returns anything Claude Code could read as a decision, and never an error: the creature must not be able to block or steer the agent.
- No authentication token: localhost plus the Host/Origin checks. Any local process can move the creature; accepted for a desktop pet.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `.claude/settings.json` | `POST /hook` accepts hook JSON, answers 2xx with an empty body | path, reply |
| `.mcp.json` | MCP at `/mcp` | path |
| `main.rs` | `start(AppHandle, Arc<Mind>, port) -> Result<(), String>`; an occupied port is a start-up error | signature |
