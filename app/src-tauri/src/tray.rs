//! The menu-bar / tray icon: the one thing a person can click. See tray.md.
//! The creature's window is click-through, so switching avatars, opening settings and quitting live here.
use crate::{config::Config, mind::{Mind, SetBody}};
use std::{fs, path::{Path, PathBuf}, sync::Arc, thread};
use tauri::{menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder}, tray::TrayIconBuilder, AppHandle, Listener, Wry};

const ID: &str = "lil";

pub fn create(app: &AppHandle, mind: Arc<Mind>, cfg: &Config) -> tauri::Result<()> {
    let (name, file) = (cfg.name.clone(), cfg.file.clone());
    let mut tray = TrayIconBuilder::with_id(ID)
        .tooltip(format!("lil: {name}"))
        .menu(&menu(app, &mind, &name)?)
        .show_menu_on_left_click(true);
    if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
    let m = mind.clone();
    tray.on_menu_event(move |app, event| choose(app, &m, &file, event.id().as_ref())).build(app)?;

    // The menu shows the current body and its history, so rebuild it whenever the body changes
    // (from this menu or from an agent's set_body).
    let (app2, m) = (app.clone(), mind);
    app.listen("body", move |_| {
        let (app3, m, name) = (app2.clone(), m.clone(), name.clone());
        let _ = app2.run_on_main_thread(move || {
            if let (Some(tray), Ok(menu)) = (app3.tray_by_id(ID), menu(&app3, &m, &name)) { let _ = tray.set_menu(Some(menu)); }
        });
    });
    Ok(())
}

/// Item ids: "scene:<path>" wears a toolkit scene, "rev:<hash>" brings back an earlier body, "config", "quit".
fn menu(app: &AppHandle, mind: &Mind, name: &str) -> tauri::Result<Menu<Wry>> {
    let current = mind.body_name();
    let mut avatars = SubmenuBuilder::new(app, "Avatar");
    for (label, path) in scenes(&mind.toolkit()) {
        avatars = avatars.item(&MenuItemBuilder::with_id(format!("scene:{}", path.display()), &label).enabled(label != current).build(app)?);
    }
    let history = mind.history(9);
    if history.len() > 1 {
        avatars = avatars.separator().item(&MenuItemBuilder::with_id("earlier", "Earlier bodies").enabled(false).build(app)?);
        for line in history.iter().skip(1) { // the first is the body on screen
            let (hash, rest) = line.split_once("  ").unwrap_or((line.as_str(), ""));
            avatars = avatars.item(&MenuItemBuilder::with_id(format!("rev:{hash}"), rest).build(app)?);
        }
    }
    MenuBuilder::new(app)
        .item(&MenuItemBuilder::with_id("title", format!("{name}: {current}")).enabled(false).build(app)?)
        .separator()
        .item(&avatars.build()?)
        .item(&MenuItemBuilder::with_id("config", "Open Settings File").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("quit", "Quit").build(app)?)
        .build()
}

fn choose(app: &AppHandle, mind: &Arc<Mind>, config_file: &Path, id: &str) {
    let req = if let Some(path) = id.strip_prefix("scene:") {
        match fs::read_to_string(path) {
            Ok(scene) => SetBody { scene: Some(scene), revert: None, note: Some("Chosen from the menu".into()) },
            Err(e) => return eprintln!("lil: {path}: {e}"),
        }
    } else if let Some(rev) = id.strip_prefix("rev:") {
        SetBody { scene: None, revert: Some(rev.to_string()), note: None }
    } else {
        match id {
            "quit" => app.exit(0),
            "config" => { let _ = std::process::Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" }).arg(config_file).spawn(); }
            _ => {}
        }
        return;
    };
    // Checking a body takes a second or more; keep the menu and the creature responsive meanwhile.
    let (app, mind) = (app.clone(), mind.clone());
    thread::spawn(move || match mind.set_body(&app, req) {
        Ok((true, _)) => {}
        Ok((false, report)) => eprintln!("lil: the menu's choice was rejected:\n{report}"),
        Err(e) => eprintln!("lil: {e}"),
    });
}

/// The toolkit's rigged scenes, as (name, path): files in scenes/ that define bones.
fn scenes(toolkit: &Path) -> Vec<(String, PathBuf)> {
    let mut out: Vec<(String, PathBuf)> = fs::read_dir(toolkit.join("scenes")).into_iter().flatten().flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "js") && !p.file_name().is_some_and(|n| n.to_string_lossy().starts_with('_')))
        .filter_map(|p| {
            let text = fs::read_to_string(&p).ok()?;
            if !text.contains("b.bone(") { return None; }
            // The scene's `name: '...'` line, without running the file.
            let name = text.lines().find_map(|l| {
                let l = l.trim().strip_prefix("name:")?.trim();
                let q = l.chars().next().filter(|c| *c == '\'' || *c == '"')?;
                Some(l[1..].split(q).next()?.to_string())
            }).unwrap_or_else(|| p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default());
            Some((name, p))
        }).collect();
    out.sort();
    out
}
