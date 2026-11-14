# keys.rs

## Purpose
Answers one question: is the grab modifier held right now? The window never has focus, so this is global key state.

## Components
### `modifier_down`
- **Does**: macOS: reads `CGEventSourceFlagsState` and tests the mask for alt, ctrl, shift or super (Command). Elsewhere: false.
- **Interacts with**: `Desk::sample` in `cursor.rs`. Hyprland does not use this; `hypr::sample` asks the compositor.

## Decisions
- Raw FFI to one CoreGraphics function instead of a crate. Reading modifier flags needs no Accessibility or Input Monitoring permission; an event tap would.

## Contracts
| Dependent | Expects | Breaking changes |
|-----------|---------|------------------|
| `cursor.rs` | `modifier_down(&str) -> bool`, false for unknown names | signature |

## Notes
- X11 and non-Hyprland Wayland have no implementation, so the creature cannot be carried there.
