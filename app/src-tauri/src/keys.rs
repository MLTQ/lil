//! Is the grab modifier held right now, anywhere on the system? See keys.md.
//! The creature's window never has keyboard focus, so key state has to be read globally.

/// `name` is alt, ctrl, shift or super. Unknown names and unsupported platforms are never down.
#[cfg(target_os = "macos")]
pub fn modifier_down(name: &str) -> bool {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" { fn CGEventSourceFlagsState(state: i32) -> u64; }
    let mask: u64 = match name {
        "shift" => 0x0002_0000,
        "ctrl" => 0x0004_0000,
        "alt" => 0x0008_0000,
        "super" => 0x0010_0000, // Command
        _ => return false,
    };
    // 0 = combined session state: the modifier flags as the user's session currently sees them.
    // Reading flags needs no Accessibility or Input Monitoring permission.
    unsafe { CGEventSourceFlagsState(0) & mask != 0 }
}

#[cfg(not(target_os = "macos"))]
pub fn modifier_down(_name: &str) -> bool { false }
