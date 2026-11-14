//! Runs Node on a scene file: the packer (scene -> body JSON) and the toolkit's checker. See body.md.
use std::{io::{Read, Write}, path::Path, process::{Command, Stdio}, thread, time::{Duration, Instant}};

/// The packer is compiled in and piped to `node -`, so the app carries no path to it.
const PACKER: &str = include_str!("../../tools/pack-body.js");

/// A scene is untrusted and may loop forever; nothing here waits longer than this.
const LIMIT: Duration = Duration::from_secs(90);

pub struct Run { pub ok: bool, pub stdout: String, pub stderr: String }

/// Runs `node <args>`, optionally feeding a script on stdin, and kills it after LIMIT.
fn node(node: &str, args: &[&std::ffi::OsStr], stdin: Option<&str>, cwd: Option<&Path>) -> Result<Run, String> {
    let mut cmd = Command::new(node);
    cmd.args(args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(d) = cwd { cmd.current_dir(d); }
    let mut child = cmd.spawn().map_err(|e| format!("could not start `{node}`: {e}"))?;
    let mut input = child.stdin.take().unwrap();
    if let Some(s) = stdin { input.write_all(s.as_bytes()).map_err(|e| e.to_string())?; }
    drop(input);
    let (mut out, mut err) = (child.stdout.take().unwrap(), child.stderr.take().unwrap());
    let o = thread::spawn(move || { let mut s = String::new(); let _ = out.read_to_string(&mut s); s });
    let e = thread::spawn(move || { let mut s = String::new(); let _ = err.read_to_string(&mut s); s });
    let start = Instant::now();
    let status = loop {
        if let Some(st) = child.try_wait().map_err(|e| e.to_string())? { break st; }
        if start.elapsed() > LIMIT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("stopped after {} seconds; the scene probably never finishes building", LIMIT.as_secs()));
        }
        thread::sleep(Duration::from_millis(40));
    };
    Ok(Run { ok: status.success(), stdout: o.join().unwrap_or_default(), stderr: e.join().unwrap_or_default() })
}

/// Scene file -> packed body JSON, or the packer's error text.
pub fn pack(node_bin: &str, toolkit: &Path, scene: &Path) -> Result<String, String> {
    let run = node(node_bin, &["-".as_ref(), toolkit.as_os_str(), scene.as_os_str()], Some(PACKER), None)?;
    if run.ok { Ok(run.stdout) } else { Err(format!("{} did not build: {}", scene.display(), run.stderr.trim())) }
}

/// Runs the toolkit's own `tools/make.js` on a scene, unmodified. `ok` is its verdict (exit 0 = RESULT: PASS);
/// `stdout` is its report. Outputs go to `<out>/<scene file stem>/`.
pub fn check(node_bin: &str, toolkit: &Path, scene: &Path, out: &Path) -> Result<Run, String> {
    let make = toolkit.join("tools").join("make.js");
    node(node_bin, &[make.as_os_str(), scene.as_os_str(), "--out".as_ref(), out.as_os_str()], None, None)
}
