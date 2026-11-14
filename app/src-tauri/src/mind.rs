//! What the creature is and is doing: its live body, baseline state and the agent's expressions. See mind.md.
//! Everything that drives or changes the body from outside (hooks, MCP, plain HTTP) goes through `Mind`.
use crate::{bodies::Bodies, config::{Config, StateCfg}};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::{Mutex, RwLock}};
use tauri::{AppHandle, Emitter};

pub const STATES: [&str; 5] = ["idle", "thinking", "tool", "waiting", "error"];

pub struct Gesture { pub name: String, pub once: Option<f64> }

/// The body on screen: what the webview renders and what callers are checked against.
struct Live {
    packed: String,
    name: String,
    gestures: Vec<Gesture>,
    bones: Vec<String>,
    /// How this body shows each baseline state: built-in defaults < instance config < the body's own `states`.
    states: HashMap<String, StateCfg>,
}

/// The baseline the webview shows when the agent is not expressing anything.
#[derive(Clone, Serialize)]
pub struct Base {
    pub state: String,
    pub gesture: String,
    pub energy: f64,
    #[serde(rename = "for")]
    pub hold: Option<f64>,
}

/// One expression from the agent. Every field is optional; absent fields leave the baseline showing.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Express {
    pub gesture: Option<String>,
    pub look: Option<[f64; 2]>,
    pub energy: Option<f64>,
    pub seconds: Option<f64>,
}

/// A request to change the body: new scene source, or an earlier commit to bring back.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetBody {
    pub scene: Option<String>,
    pub revert: Option<String>,
    pub note: Option<String>,
}

#[derive(Clone, Serialize)]
struct Expression { gesture: Option<String>, look: Option<[f64; 2]>, energy: Option<f64>, seconds: f64 }

#[derive(Clone, Serialize)]
struct NewBody { body: String, base: Base }

pub struct Mind {
    live: RwLock<Live>,
    cfg_states: HashMap<String, StateCfg>,
    base: Mutex<Base>,
    bodies: Bodies,
}

impl Live {
    fn new(packed: String, cfg_states: &HashMap<String, StateCfg>) -> Result<Self, String> {
        let v: Value = serde_json::from_str(&packed).map_err(|e| format!("packed body is not JSON: {e}"))?;
        let gestures = v["rig"]["gestures"].as_object().map(|g| {
            g.iter().map(|(name, def)| Gesture { name: name.clone(), once: def["once"].as_f64() }).collect()
        }).unwrap_or_default();
        let bones = v["bones"].as_array().map(|b| b.iter().filter_map(|x| x["name"].as_str().map(String::from)).collect()).unwrap_or_default();
        // Built-in looks use only "idle", so they work on any body.
        let mut states: HashMap<String, StateCfg> = [("idle", 0.3), ("thinking", 0.8), ("tool", 1.0), ("waiting", 0.5), ("error", 1.0)]
            .into_iter().map(|(n, energy)| (n.to_string(), StateCfg { energy, ..Default::default() })).collect();
        states.extend(cfg_states.clone());
        if let Some(own) = v["states"].as_object() {
            for (k, def) in own {
                if !STATES.contains(&k.as_str()) { continue; }
                if let Ok(s) = serde_json::from_value::<StateCfg>(def.clone()) { states.insert(k.clone(), s); }
            }
        }
        Ok(Self { packed, name: v["name"].as_str().unwrap_or("Untitled").to_string(), gestures, bones, states })
    }

    fn has_gesture(&self, g: &str) -> bool { g == "idle" || self.gestures.iter().any(|x| x.name == g) }

    fn gesture_list(&self) -> String {
        std::iter::once("idle").chain(self.gestures.iter().map(|g| g.name.as_str())).collect::<Vec<_>>().join(", ")
    }

    fn resolve(&self, state: &str) -> Result<Base, String> {
        let s = self.states.get(state).ok_or_else(|| format!("unknown state \"{state}\"; states are: {}", STATES.join(", ")))?;
        let gesture = if self.has_gesture(&s.gesture) { s.gesture.clone() } else { "idle".into() };
        Ok(Base { state: state.to_string(), gesture, energy: s.energy.clamp(0.0, 1.0), hold: s.hold })
    }
}

impl Mind {
    /// Opens the body repo and loads the committed body. If that body no longer builds (say the toolkit
    /// changed under it), start-up fails with the reason rather than showing something else.
    pub fn new(cfg: &Config) -> Result<Self, String> {
        let bodies = Bodies::open(cfg)?;
        let live = Live::new(bodies.pack_current()?, &cfg.states)?;
        let base = live.resolve("idle")?;
        Ok(Self { live: RwLock::new(live), cfg_states: cfg.states.clone(), base: Mutex::new(base), bodies })
    }

    /// Recent bodies, newest first: "hash  date  subject".
    pub fn history(&self, n: usize) -> Vec<String> { self.bodies.history(n) }
    pub fn toolkit(&self) -> std::path::PathBuf { self.bodies.toolkit.clone() }

    pub fn packed(&self) -> String { self.live.read().unwrap().packed.clone() }
    pub fn body_name(&self) -> String { self.live.read().unwrap().name.clone() }
    pub fn base(&self) -> Base { self.base.lock().unwrap().clone() }

    /// Sets the baseline state (from a hook or a plain HTTP call) and tells the webview.
    pub fn set_state(&self, app: &AppHandle, state: &str) -> Result<Base, String> {
        let base = self.live.read().unwrap().resolve(state)?;
        *self.base.lock().unwrap() = base.clone();
        let _ = app.emit("base", base.clone());
        Ok(base)
    }

    /// Shows an expression over the baseline for a few seconds. Returns a sentence describing what happened.
    pub fn express(&self, app: &AppHandle, e: Express) -> Result<String, String> {
        let live = self.live.read().unwrap();
        if let Some(g) = &e.gesture {
            if !live.has_gesture(g) { return Err(format!("this body has no gesture \"{g}\"; it has: {}", live.gesture_list())); }
        }
        if e.gesture.is_none() && e.look.is_none() && e.energy.is_none() {
            return Err("nothing to express: give at least one of gesture, look, energy".into());
        }
        let once = e.gesture.as_ref().and_then(|g| live.gestures.iter().find(|x| &x.name == g)).and_then(|g| g.once);
        let seconds = once.unwrap_or_else(|| e.seconds.unwrap_or(6.0).clamp(0.5, 60.0));
        let x = Expression {
            gesture: e.gesture.clone(),
            look: e.look.map(|[x, y]| [x.clamp(-1.0, 1.0), y.clamp(-1.0, 1.0)]),
            energy: e.energy.map(|v| v.clamp(0.0, 1.0)),
            seconds,
        };
        app.emit("express", x.clone()).map_err(|e| e.to_string())?;
        let mut parts = Vec::new();
        if let Some(g) = &x.gesture { parts.push(format!("gesture {g}")); }
        if let Some([lx, ly]) = x.look { parts.push(format!("looking [{lx:.1}, {ly:.1}]")); }
        if let Some(v) = x.energy { parts.push(format!("energy {v:.1}")); }
        Ok(format!("Showing {} for {seconds:.1}s, then back to the \"{}\" baseline.", parts.join(", "), self.base().state))
    }

    /// Changes the body. The new source goes through the toolkit's checker; only a passing body is committed
    /// to the body repo and swapped in. Returns (accepted, text for the agent): the verdict, then the full report.
    pub fn set_body(&self, app: &AppHandle, req: SetBody) -> Result<(bool, String), String> {
        let note = req.note.unwrap_or_default();
        let outcome = match (&req.scene, &req.revert) {
            (Some(src), None) if !src.trim().is_empty() => self.bodies.submit(src, &note)?,
            (None, Some(rev)) => self.bodies.revert(rev.trim())?,
            _ => return Err("give exactly one of: scene (the full source of a scene file) or revert (a commit from get_body's history)".into()),
        };
        let images = outcome.images.iter().map(|p| format!("  {}", p.display())).collect::<Vec<_>>().join("\n");
        let look = if images.is_empty() { String::new() } else { format!("\n\nReview images (open them if you can view images):\n{images}") };
        let (Some(packed), Some(commit)) = (outcome.packed, outcome.commit) else {
            return Ok((false, format!("REJECTED. Your body is unchanged: still \"{}\".\n\n{}{look}", self.body_name(), outcome.report)));
        };
        let live = Live::new(packed, &self.cfg_states)?;
        let base = live.resolve(&self.base().state).or_else(|_| live.resolve("idle"))?;
        let (name, gestures, body) = (live.name.clone(), live.gesture_list(), live.packed.clone());
        *self.live.write().unwrap() = live;
        *self.base.lock().unwrap() = base.clone();
        let _ = app.emit("body", NewBody { body, base });
        Ok((true, format!("ACCEPTED. You are now \"{name}\" (commit {commit} in {}). Gestures: {gestures}.\n\n{}{look}",
            self.bodies.repo.display(), outcome.report)))
    }

    /// The body as an agent needs to know it. `source` adds the scene file's text.
    pub fn describe(&self, source: bool) -> Value {
        let live = self.live.read().unwrap();
        let mut v = json!({
            "name": live.name,
            "gestures": std::iter::once(json!({ "name": "idle", "note": "the resting loop; always available" }))
                .chain(live.gestures.iter().map(|g| match g.once {
                    Some(s) => json!({ "name": g.name, "plays": format!("once, {s}s") }),
                    None => json!({ "name": g.name, "plays": "holds" }),
                })).collect::<Vec<_>>(),
            "bones": live.bones,
            "state": self.base().state,
            "states": STATES.iter().map(|s| (s.to_string(), json!(live.resolve(s).map(|b| b.gesture).unwrap_or_default()))).collect::<serde_json::Map<_, _>>(),
            "scene_file": self.bodies.file(),
            "toolkit": self.bodies.toolkit,
            "history": self.bodies.history(8),
        });
        if source { v["scene"] = json!(self.bodies.source()); }
        v
    }
}

/// Which baseline state a Claude Code hook event means. None = not a state change.
pub fn state_for_hook(event: &str) -> Option<&'static str> {
    Some(match event {
        "SessionStart" | "SessionEnd" => "idle",
        "UserPromptSubmit" | "PostToolUse" | "PreCompact" => "thinking",
        "PreToolUse" => "tool",
        "Notification" | "PermissionRequest" | "Stop" => "waiting",
        "PostToolUseFailure" | "StopFailure" => "error",
        _ => return None,
    })
}
