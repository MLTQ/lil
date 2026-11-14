//! Watches the mouse: feeds the cursor position to the webview and lets the user carry the creature. See cursor.md.
//! A click-through window gets no mouse or key events, so everything here is polled globally.
use crate::config::{self, Config};
use serde::Serialize;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter, LogicalPosition, WebviewWindow};

/// One reading, in logical pixels in the desktop's coordinate space.
pub struct Sample {
    pub cursor: (f64, f64),
    /// window top-left
    pub at: (f64, f64),
    pub size: (f64, f64),
    /// the grab modifier is held
    pub grab: bool,
}

#[derive(Clone, Serialize)]
struct Cursor { dx: f64, dy: f64, held: bool }

/// Polls about 30 times a second (60 while carried) and:
/// - emits "cursor" { dx, dy, held }: the cursor's offset from the window centre, when it changes and at least
///   once a second, so a webview that starts listening late still learns where a resting cursor is;
/// - while the grab modifier is held with the cursor on the creature, moves the window with the cursor, and
///   saves the position to the config when the modifier is released.
pub fn follow(app: AppHandle, win: WebviewWindow, cfg: Config) {
    thread::spawn(move || {
        let desk = Desk::new(app, win.clone(), &cfg);
        let (mut last, mut quiet) = ((f64::NAN, f64::NAN, false), 0u32);
        let mut held: Option<(f64, f64)> = None; // cursor offset from the window's top-left at pick-up
        let mut placed = false;
        loop {
            thread::sleep(Duration::from_millis(if held.is_some() { 16 } else { 33 }));
            let Some(mut s) = desk.sample() else { continue };
            if !placed { placed = true; if desk.place(&cfg) { continue; } }
            let inside = s.cursor.0 >= s.at.0 && s.cursor.0 < s.at.0 + s.size.0 && s.cursor.1 >= s.at.1 && s.cursor.1 < s.at.1 + s.size.1;
            match (held, s.grab) {
                (None, true) if inside => held = Some((s.cursor.0 - s.at.0, s.cursor.1 - s.at.1)),
                (Some(o), true) => {
                    let to = (s.cursor.0 - o.0, s.cursor.1 - o.1);
                    if to != s.at { desk.move_to(to.0, to.1); s.at = to; }
                }
                (Some(_), false) => {
                    held = None;
                    if let Err(e) = config::save_position(&cfg.file, s.at.0, s.at.1) { eprintln!("lil: could not save position: {e}"); }
                }
                _ => {}
            }
            let now = (s.cursor.0 - (s.at.0 + s.size.0 / 2.0), s.cursor.1 - (s.at.1 + s.size.1 / 2.0), held.is_some());
            quiet += 1;
            if now == last && quiet < 30 { continue; }
            (last, quiet) = (now, 0);
            if win.emit("cursor", Cursor { dx: now.0, dy: now.1, held: now.2 }).is_err() { break; }
        }
    });
}

/// Where readings come from and how the window is moved: Hyprland's socket inside Hyprland (Wayland gives a
/// client none of this), the windowing system everywhere else.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
struct Desk { app: AppHandle, win: WebviewWindow, grab: String, hypr: bool }

impl Desk {
    fn new(app: AppHandle, win: WebviewWindow, cfg: &Config) -> Self {
        #[cfg(target_os = "linux")]
        let hypr = crate::hypr::active();
        #[cfg(not(target_os = "linux"))]
        let hypr = false;
        Self { app, win, grab: cfg.window.grab.clone(), hypr }
    }

    fn sample(&self) -> Option<Sample> {
        #[cfg(target_os = "linux")]
        if self.hypr { return crate::hypr::sample(&self.grab); }
        let (c, p, s, k) = (self.app.cursor_position().ok()?, self.win.outer_position().ok()?, self.win.outer_size().ok()?, self.win.scale_factor().ok()?);
        Some(Sample {
            cursor: (c.x / k, c.y / k),
            at: (p.x as f64 / k, p.y as f64 / k),
            size: (s.width as f64 / k, s.height as f64 / k),
            grab: crate::keys::modifier_down(&self.grab),
        })
    }

    fn move_to(&self, x: f64, y: f64) {
        #[cfg(target_os = "linux")]
        if self.hypr { return crate::hypr::move_to(x, y); }
        let _ = self.win.set_position(LogicalPosition::new(x, y));
    }

    /// Initial placement where the window could not place itself. Returns true if it moved the window.
    fn place(&self, _cfg: &Config) -> bool {
        #[cfg(target_os = "linux")]
        if self.hypr { return crate::hypr::place(_cfg).is_some(); }
        false
    }
}
