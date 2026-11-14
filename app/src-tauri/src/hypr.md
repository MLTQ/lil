# hypr.rs

## Purpose
Everything Hyprland-specific (Linux only). A Wayland client cannot read the global cursor or key state,
position itself, or stay on top, so the app asks the compositor over its command socket and ships a
window rule for the rest.

## Components
### `active`
- **Does**: True when `HYPRLAND_INSTANCE_SIGNATURE` is set.

### `sample`
- **Does**: One Lua `repl` request returning cursor, this process's window (matched by pid) and whether the grab key is down.
- **Interacts with**: `cursor::Sample`, `Desk::sample` in `cursor.rs`.

### `move_to`, `place`
- **Does**: Move the window with `hl.dsp.window.move`; `place` uses the saved position or the configured corner
  of the focused monitor, inside its reserved area (the bar).

### `rules`
- **Does**: Returns the Lua `hl.window_rule` for this instance: float, pin, no_focus, no border, rounding, blur, shadow, animation or dim.
- **Interacts with**: `main.rs` prints it for `--print-hyprland-rules`; a copy for the default instance is in `app/hyprland/claude.lua`.

## Decisions
- Rules first, layer-shell not needed so far: with the rule the window floats, pins, takes no focus and has no decoration (checked on Hyprland 0.56.2).
- The rule has no `move`. A first version placed the window with `move` expressions; dropped so the app can restore a dragged position.
- Lua only. This machine's Hyprland uses the Lua config; old-style `hyprctl dispatch <name> <args>` strings are rejected there.
- Polling Lua in the compositor 30 times a second measured about 5% of one core for the whole app; acceptable, revisit if it shows.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `cursor.rs` | `sample(grab) -> Option<Sample>` (None until mapped), `move_to(x, y)`, `place(&Config) -> Option<()>` | signatures |
| Hyprland config | rule matches class `^lil$` and title `^<name>$` | changing the window title or binary name |

## Notes
- Verified: transparency, float, pin, no focus on hover, corner placement, restart at a saved position, cursor feed.
- Not verified (needs a person at the machine): Alt-carry with a real key, a click reaching the window beneath,
  and staying above other floating windows and fullscreen apps. If stacking falls short, move to a layer-shell surface.
- `is_key_down` did not see a key pressed by `wtype`, so the carry could not be tested remotely.
- Placement happens once, at start. If the monitor layout changes later, the creature stays where it was put.
