//! lil: one creature in a transparent, click-through window, driven over local HTTP. See main.md.
mod bodies;
mod body;
mod config;
mod cursor;
#[cfg(target_os = "linux")]
mod hypr;
mod keys;
mod mcp;
mod mind;
mod server;
mod tray;
mod window;

use config::RenderCfg;
use mind::{Base, Mind};
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Serialize)]
struct Boot { body: String, render: RenderCfg, base: Base }

/// Called once by the webview: the packed body, how to render it, and the current baseline state.
#[tauri::command]
fn boot(mind: State<'_, Arc<Mind>>, render: State<'_, RenderCfg>) -> Boot {
    Boot { body: mind.packed(), render: render.inner().clone(), base: mind.base() }
}

/// The webview's measured cost per frame and where it is looking, printed every few seconds
/// so the frame rate and resolution can be tuned and the cursor feed can be checked.
#[tauri::command]
fn perf(ms: f64, fps: f64, look: [f64; 2], gesture: String) {
    eprintln!("lil: frame {ms:.1} ms, {fps:.1} fps, look [{:.2}, {:.2}], {gesture}", look[0], look[1]);
}

/// An error from the webview's script.
#[tauri::command]
fn fail(message: String) { eprintln!("lil: webview error: {message}"); }

fn die(e: String) -> ! { eprintln!("lil: {e}"); std::process::exit(2) }

/// `lil --quit`: asks the running instance for this config to close, over its local port.
fn quit(port: u16) -> ! {
    use std::io::{Read, Write};
    let req = format!("POST /quit HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    match std::net::TcpStream::connect(("127.0.0.1", port)) {
        Ok(mut s) => {
            let mut reply = String::new();
            let ok = s.write_all(req.as_bytes()).is_ok() && s.read_to_string(&mut reply).is_ok() && reply.starts_with("HTTP/1.1 200");
            if ok { println!("lil: closed the creature on port {port}"); std::process::exit(0) }
            die(format!("something on port {port} answered, but it did not accept /quit"))
        }
        Err(_) => { println!("lil: no creature is running on port {port}"); std::process::exit(0) }
    }
}

fn main() {
    let cfg = config::load().unwrap_or_else(|e| die(e));
    if std::env::args().any(|a| a == "--quit") { quit(cfg.port); }
    #[cfg(target_os = "linux")]
    {
        if std::env::args().any(|a| a == "--print-hyprland-rules") {
            print!("{}", hypr::rules(&cfg));
            return;
        }
        // WebKitGTK's DMA-BUF renderer kills the Wayland connection (protocol error 71) on NVIDIA.
        // The creature is a 2D canvas, so the fallback renderer costs nothing visible.
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
    // Open the body repo and build the body before any window exists: a body that does not build is a start-up error.
    let mind = Arc::new(Mind::new(&cfg).unwrap_or_else(|e| die(e)));

    tauri::Builder::default()
        .manage(mind.clone())
        .manage(cfg.render.clone())
        .invoke_handler(tauri::generate_handler![boot, perf, fail])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // no Dock icon, never takes focus
            let win = window::create(app.handle(), &cfg)?;
            cursor::follow(app.handle().clone(), win, cfg.clone());
            server::start(app.handle().clone(), mind.clone(), cfg.port)?;
            tray::create(app.handle(), mind.clone(), &cfg)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("lil failed to start");
}
