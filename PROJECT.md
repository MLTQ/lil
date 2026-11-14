# lil

## What This Is
A small transparent desktop creature that an AI agent uses to express itself. A Tauri 2 app
shows one rigged pixel-splat sculpture in a frameless, always-on-top, click-through window.
An agent will drive it through an MCP server; harness hooks will drive baseline states.
It is not a renderer project: drawing and rigging come from `pixel-splat-sculptures/`, unchanged.

## Current State
- **Milestone 1 done (macOS, 2026-11-13).** The crab (`scenes/hermit-rigged.js`) idles in the
  bottom-right corner, transparent and click-through, with its eye stalks following the cursor.
  About 4 ms per 192x192 frame at 25 fps, about 3% of one core.
- **Milestone 2 mostly done (Omarchy, Hyprland 0.56.2, 2026-11-13).** Same creature via one window
  rule plus Hyprland's socket: transparent, floating, pinned, no focus, no decoration, placed in its
  corner, eyes following the cursor. Layer-shell was not needed so far.
- **Carrying (added on request).** Hold the grab modifier (default Alt/Option) with the cursor on the
  creature and move; release to drop. The position is saved to `window.position` in the config.
- Not yet verified by a person, on either machine: carrying with a real key press; a click reaching
  the window beneath. On Hyprland also: staying above other floating windows and fullscreen apps.
- The Hyprland rule is installed on the test machine: `~/.config/hypr/lil.lua`, required from `hyprland.lua`.
- **Milestone 3 done (2026-11-13).** Each instance serves HTTP on `127.0.0.1:<port>`: MCP at `/mcp`
  (`express`, `get_body`), Claude Code hooks at `/hook`, plain `POST /state/<name>`. This repo's
  `.claude/settings.json` posts hook events there and `.mcp.json` registers the MCP server.
  Seen working: a live Claude Code session drove thinking/tool/idle through hooks; expressions layer over
  the baseline and expire. The MCP tools were exercised with hand-made JSON-RPC, not yet by a real client.
- **Milestone 4 done (2026-11-13).** `set_body` takes scene source, runs the toolkit's `tools/make.js` on it
  and swaps the live body only on a pass; every accepted body is a commit in the instance's body repo
  (`bodies/<name>/`, git-ignored here). `revert` re-submits an earlier commit. Tested on the Mac: a broken
  scene, a syntax error and an unrigged scene were rejected with reports; the frog was accepted and appeared
  live; a revert brought the crab back. The embodiment skill is `skills/embodiment/SKILL.md`; it and the
  authoring skill are linked into `.claude/skills/`.
- A menu-bar / tray icon gives the person a menu: Avatar (toolkit creatures and earlier bodies), Open Settings
  File, Quit. `lil --quit` does the same from a terminal. The menu itself has not been clicked through by hand.
- Not tested: `set_body` through an MCP client (only through `POST /body`, same code); the embodiment skill
  in use by an agent; milestone 4 on the Omarchy machine beyond building.
- Not built: Hermes adapter (M5).

## Active Work
Waiting for review of milestone 4. Still open from earlier: hands-on checks of carrying and click-through.
Next is milestone 5: read Hermes Agent's docs for MCP, skills and hooks, then design its adapter.

## Running It
macOS:

    cd app && cargo tauri dev --no-watch

Omarchy (no tauri CLI installed there, so the UI is embedded with the `custom-protocol` feature):

    cd app/src-tauri && cargo build --features tauri/custom-protocol
    target/debug/lil --print-hyprland-rules    # add the output to the Hyprland Lua config
    target/debug/lil

Close it from anywhere inside the repo with `lil --quit` (`app/src-tauri/target/debug/lil --quit`).

The config is found via `--config <file>`, then `$LIL_CONFIG`, then the nearest `lil.config.json` at or
above the working directory. One config per instance. The app logs
`lil: frame <ms>, <fps>, look [x, y]` every 5 seconds.

## Architecture Overview
    lil.config.json                 per-instance settings (scene, toolkit, corner, scale, fps)
    pixel-splat-sculptures/         the toolkit and authoring skill; do not edit lib/ or tools/
    app/tools/pack-body.js          scene file -> JSON body (runs under Node, uses the toolkit's lib)
    app/src-tauri/build.rs          copies lib/core.js and lib/rig.js into app/ui/vendor/ at build time
    bodies/<name>/                  the instance's body repo: body.js, report.txt, one commit per body
    skills/embodiment/SKILL.md      when to express, how to choose, how to revise the body
    .claude/skills/                 links to both skills so Claude Code finds them
    .claude/settings.json           Claude Code hooks -> POST /hook (baseline states, no model tokens)
    .mcp.json                       registers the instance's MCP server with Claude Code
    app/src-tauri/src/              main (commands), config, body (runs the packer), window,
                                    mind (states, expressions, live body), bodies (repo, gate, history),
                                    server (HTTP), mcp (JSON-RPC, tools), tray (menu: avatars, settings, quit),
                                    cursor (poll loop, carrying), keys (macOS modifier), hypr (Hyprland)
    app/hyprland/claude.lua         the generated window rule for the default instance
    app/ui/                         index.html + main.js: the render loop around Splat and SplatRig

Data flow: the webview calls `boot` -> Rust runs the packer on the configured scene -> the
webview builds a `Rig` and a controller and draws every frame from one `intent`
(`{ gesture, since, look, energy }`). Rust polls the global cursor and emits `cursor` events,
which become the look direction. Hooks set a baseline state and the agent's `express` shows on top of it
for a few seconds; `ui/main.js` merges the two into the intent each frame.

Baseline states and how the crab shows them (`states` in the config): idle = calm idle, thinking = lively
idle, tool = scuttle, waiting = wave for 5 s then idle, error = startle.

## Decision Log
- **2026-11-13 The webview receives packed data, never scene code.** Scene files are JavaScript
  and will come from agents via `set_body`; they run only in a Node child process.
- **2026-11-13 The packer is compiled into the app and piped to `node -`.** No path to it at runtime.
- **2026-11-13 lib files are copied at build time, not symlinked or bundled.** Keeps them byte-identical
  and loadable with plain script tags; `app/ui/vendor/` is git-ignored.
- **2026-11-13 Cursor is polled in Rust (33 ms).** A click-through window gets no mouse events.
- **2026-11-13 Carry by holding a modifier, no click.** Works without pointer events, so it is the same
  on macOS and under Hyprland's `no_focus`. The dropped position is written back to the config.
- **2026-11-13 Hyprland: rule for float/pin/no_focus/no decoration; the app places itself over the socket.**
  Rules alone cannot restore a dragged position. Lua config syntax only.
- **2026-11-13 The whole sculpture is shown, sandbar included** (Max's choice over bone-bound splats only).
- **2026-11-13 CPU renderer stays.** 4 ms a frame in WKWebView; no need to lower resolution or port to GPU.
- **2026-11-13 Window is built in code, not tauri.conf.json**, because size and position come from the config.
- **2026-11-13 Hooks are Claude Code HTTP hooks posting to the app**, which maps event to state. No shell
  scripts, and the mapping lives in one place (`mind::state_for_hook`).
- **2026-11-13 Baseline and expression are two layers.** A hook must not erase what the agent just expressed.
- **2026-11-13 MCP is hand-written JSON-RPC over `tiny_http`**, not an SDK. Three methods, no streaming.
- **2026-11-13 The body lives in its own git repo, not in this one.** One commit per accepted body, authored
  by the creature; rollback is a new commit that re-submits an old body through the checker.
- **2026-11-13 The gate is the toolkit's make.js, run unmodified**, plus one extra rule: a body needs bones.
- **2026-11-13 A scene may carry its own `states` block** (top level, beside `rig`), overriding the config's.
- **2026-11-13 Human controls live in a tray menu**, since the window takes no clicks. A menu avatar choice
  goes through `set_body`, so it is checked and committed like an agent's.
- **Constraint: never loosen the checker's limits; keep lib/ dependency-free and UMD.**

## Sharp Edges
- Transparency on macOS needs `macOSPrivateApi` (tauri.conf.json) and the `macos-private-api` feature.
  This rules out the Mac App Store, which is fine for this project.
- `requestAnimationFrame` may be throttled if macOS decides the window is occluded; not seen so far.
- The crab's `cy` is computed in the packer with the same code as `tools/make.js`. If make.js changes
  its framing (pitch 0.48, scale res/2.55), the packer and `ui/main.js` must follow.
- Node must be on the app's PATH (or set `node` in the config). A Finder-launched bundle has a minimal PATH.
- WebKitGTK needs `WEBKIT_DISABLE_DMABUF_RENDERER=1` on NVIDIA; the app sets it itself on Linux.
- On Wayland a header bar appears despite `decorations(false)`; `window.rs` hides the GTK widget.
- The rule matches class `lil` and the window title, which is the config's `name`. Rename one, regenerate the rule.
- `lil.config.json` differs per machine once a position is saved; do not sync it between machines.
- The port appears in three places per instance: `lil.config.json`, `.claude/settings.json`, `.mcp.json`. Change all three.
- When the app is not running, every hook fails to connect. Claude Code treats that as a non-blocking error.
- Several Claude Code sessions in this repo all drive the same creature.
- `scene` in the config only seeds a new body repo. To start over from the seed, delete `bodies/<name>/`.
- Scene files are JavaScript run in Node with the user's permissions; `set_body` trusts its caller.
- The repo is not under git yet.
