//! Per-instance configuration: one JSON file. See config.md.
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env, fs, path::{Path, PathBuf}};

pub const FILE: &str = "lil.config.json";

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "d_name")]
    pub name: String,
    pub toolkit: PathBuf,
    pub scene: PathBuf,
    #[serde(default = "d_node")]
    pub node: String,
    #[serde(default)]
    pub window: WindowCfg,
    #[serde(default)]
    pub render: RenderCfg,
    /// The creature's own git repository: body.js plus one commit per accepted body. Default bodies/<name>.
    #[serde(default, rename = "bodyRepo")]
    pub body_repo: PathBuf,
    /// Port of the instance's HTTP server (MCP, hooks, states). Bound to 127.0.0.1 only.
    #[serde(default = "d_port")]
    pub port: u16,
    /// Baseline states -> how the body shows them. Missing states fall back to built-in defaults.
    #[serde(default)]
    pub states: HashMap<String, StateCfg>,
    /// Where this config was read from; `save_position` writes back to it.
    #[serde(skip)]
    pub file: PathBuf,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct WindowCfg {
    /// top-left, top-right, bottom-left or bottom-right
    pub corner: String,
    /// gap to the screen edge, logical pixels
    pub margin: f64,
    /// window size = render.res * scale, logical pixels
    pub scale: f64,
    /// Modifier that picks the creature up while the cursor is on it: alt, ctrl, shift or super ("" disables).
    pub grab: String,
    /// Top-left corner in logical pixels, written when the creature is dropped. Overrides `corner`.
    pub position: Option<[f64; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct RenderCfg {
    pub res: u32,
    pub fps: f64,
    pub yaw: f64,
}

/// How one baseline state (thinking, tool, waiting, error, idle) looks on this body.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct StateCfg {
    /// A gesture of the body, or "idle". Unknown gestures fall back to "idle".
    pub gesture: String,
    pub energy: f64,
    /// Seconds to hold the gesture before settling to idle at the same energy. Absent = hold.
    #[serde(rename = "for")]
    pub hold: Option<f64>,
}
impl Default for StateCfg {
    fn default() -> Self { Self { gesture: "idle".into(), energy: 0.5, hold: None } }
}

fn d_port() -> u16 { 4747 }
fn d_name() -> String { "lil".into() }
fn d_node() -> String { "node".into() }
impl Default for WindowCfg {
    fn default() -> Self { Self { corner: "bottom-right".into(), margin: 16.0, scale: 1.5, grab: "alt".into(), position: None } }
}
impl Default for RenderCfg {
    fn default() -> Self { Self { res: 192, fps: 25.0, yaw: 0.35 } }
}

/// `--config <file>`, then `$LIL_CONFIG`, then the nearest lil.config.json at or above the working directory.
fn locate() -> Result<PathBuf, String> {
    let args: Vec<String> = env::args().collect();
    if let Some(i) = args.iter().position(|a| a == "--config") {
        return args.get(i + 1).map(PathBuf::from).ok_or_else(|| "--config needs a file path".to_string());
    }
    if let Ok(p) = env::var("LIL_CONFIG") { return Ok(PathBuf::from(p)); }
    let cwd = env::current_dir().map_err(|e| e.to_string())?;
    cwd.ancestors().map(|d| d.join(FILE)).find(|p| p.is_file())
        .ok_or_else(|| format!("no {FILE} found at or above {}; pass --config <file>", cwd.display()))
}

/// Loads the config and makes `toolkit` and `scene` absolute, relative to the config file's folder.
pub fn load() -> Result<Config, String> {
    let file = locate()?;
    let text = fs::read_to_string(&file).map_err(|e| format!("{}: {e}", file.display()))?;
    let mut cfg: Config = serde_json::from_str(&text).map_err(|e| format!("{}: {e}", file.display()))?;
    let root = file.parent().unwrap_or(Path::new(".")).to_path_buf();
    let root = root.canonicalize().unwrap_or(root);
    cfg.toolkit = root.join(&cfg.toolkit);
    cfg.scene = root.join(&cfg.scene);
    cfg.body_repo = root.join(if cfg.body_repo.as_os_str().is_empty() { Path::new("bodies").join(&cfg.name) } else { cfg.body_repo.clone() });
    cfg.file = file;
    Ok(cfg)
}

/// Records where the creature was dropped as `window.position`, leaving every other key in the file as it was.
pub fn save_position(file: &Path, x: f64, y: f64) -> Result<(), String> {
    let text = fs::read_to_string(file).map_err(|e| e.to_string())?;
    let mut v: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let root = v.as_object_mut().ok_or("config is not a JSON object")?;
    let win = root.entry("window").or_insert_with(|| serde_json::json!({}));
    win.as_object_mut().ok_or("window is not a JSON object")?
        .insert("position".into(), serde_json::json!([x.round(), y.round()]));
    let out = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())? + "\n";
    fs::write(file, out).map_err(|e| e.to_string())
}
