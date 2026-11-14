//! Creates the creature's window and puts it in its corner. See window.md.
use crate::config::Config;
use tauri::{AppHandle, LogicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const LABEL: &str = "main";

pub fn create(app: &AppHandle, cfg: &Config) -> tauri::Result<WebviewWindow> {
    let size = cfg.render.res as f64 * cfg.window.scale;
    let win = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title(&cfg.name)
        .inner_size(size, size)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .focused(false)
        .build()?;
    #[cfg(target_os = "linux")]
    strip_titlebar(&win);
    win.set_ignore_cursor_events(true)?; // click-through: every click lands on whatever is beneath
    place(&win, cfg, size)?;
    Ok(win)
}

/// The saved position if there is one, else the corner of the primary monitor's work area (so it clears
/// the menu bar and the Dock). Wayland ignores this; on Hyprland `hypr::place` does the same job.
fn place(win: &WebviewWindow, cfg: &Config, size: f64) -> tauri::Result<()> {
    if let Some([x, y]) = cfg.window.position { return win.set_position(LogicalPosition::new(x, y)); }
    let Some(mon) = win.primary_monitor()? else { return Ok(()) };
    let k = mon.scale_factor();
    let area = mon.work_area();
    let (x0, y0) = (area.position.x as f64 / k, area.position.y as f64 / k);
    let (w, h) = (area.size.width as f64 / k, area.size.height as f64 / k);
    let m = cfg.window.margin;
    let x = if cfg.window.corner.ends_with("left") { x0 + m } else { x0 + w - size - m };
    let y = if cfg.window.corner.starts_with("top") { y0 + m } else { y0 + h - size - m };
    win.set_position(LogicalPosition::new(x, y))
}

/// On Wayland the windowing layer gives every window a client-side header bar, even with decorations off.
/// Hide it and keep it hidden, so only the canvas is left.
#[cfg(target_os = "linux")]
fn strip_titlebar(win: &WebviewWindow) {
    use gtk::prelude::*;
    let Ok(g) = win.gtk_window() else { return };
    g.set_decorated(false);
    if let Some(bar) = g.titlebar() {
        bar.set_no_show_all(true);
        bar.hide();
        bar.connect_show(|b| b.hide());
    }
}
