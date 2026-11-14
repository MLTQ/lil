//! The creature's body repository: where its form lives, is checked, and gets its history. See bodies.md.
//!   <repo>/body.js        the scene file that is the body's source of truth
//!   <repo>/report.txt     the checker's report for that body
//!   <repo>/.stage/        scratch (git-ignored): scenes/body.js candidate, lib -> toolkit/lib, out/
use crate::{body, config::Config};
use std::{fs, path::PathBuf, process::Command, sync::Mutex};

pub struct Bodies {
    pub repo: PathBuf,
    pub toolkit: PathBuf,
    node: String,
    name: String,
    /// One submission at a time: the stage folder and the git index are shared.
    busy: Mutex<()>,
}

/// What happened to a submitted body. Accepted means `packed` and `commit` are present.
pub struct Outcome {
    /// The checker's report, or the reason it never got that far.
    pub report: String,
    /// Packed body JSON, when accepted.
    pub packed: Option<String>,
    /// Short commit hash, when accepted.
    pub commit: Option<String>,
    /// Review images the checker wrote (sheet.png, rig.png), whether or not it passed.
    pub images: Vec<PathBuf>,
}

impl Bodies {
    /// Opens the repo, creating it and seeding it from the config's `scene` on first run.
    pub fn open(cfg: &Config) -> Result<Self, String> {
        let b = Self { repo: cfg.body_repo.clone(), toolkit: cfg.toolkit.clone(), node: cfg.node.clone(), name: cfg.name.clone(), busy: Mutex::new(()) };
        let io = |e: std::io::Error| format!("{}: {e}", b.repo.display());
        fs::create_dir_all(b.stage().join("scenes")).map_err(io)?;
        // Scene files say require('../lib'); this link lets a staged scene find the toolkit's lib unchanged.
        let link = b.stage().join("lib");
        let _ = fs::remove_file(&link);
        std::os::unix::fs::symlink(b.toolkit.join("lib"), &link).map_err(io)?;
        if !b.repo.join(".git").exists() {
            b.git(&["init", "-q"])?;
            fs::write(b.repo.join(".gitignore"), ".stage/\n").map_err(io)?;
            b.git(&["add", ".gitignore"])?;
        }
        if !b.file().exists() {
            fs::copy(&cfg.scene, b.file()).map_err(|e| format!("{}: {e}", cfg.scene.display()))?;
            let from = cfg.scene.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            b.commit(&format!("Seed body from {from}"), "")?;
        }
        Ok(b)
    }

    pub fn file(&self) -> PathBuf { self.repo.join("body.js") }
    fn stage(&self) -> PathBuf { self.repo.join(".stage") }
    fn staged(&self) -> PathBuf { self.stage().join("scenes").join("body.js") }

    pub fn source(&self) -> String { fs::read_to_string(self.file()).unwrap_or_default() }

    /// Packs the committed body for start-up. It passed the checker when it was accepted, so it is not re-checked.
    pub fn pack_current(&self) -> Result<String, String> {
        let _g = self.busy.lock().unwrap();
        fs::copy(self.file(), self.staged()).map_err(|e| e.to_string())?;
        body::pack(&self.node, &self.toolkit, &self.staged())
    }

    /// The gate. Stages the source, runs the toolkit's checker on it, and only if that passes: packs it,
    /// makes it the repo's body.js and commits. A rejected body changes nothing.
    pub fn submit(&self, source: &str, note: &str) -> Result<Outcome, String> {
        let _g = self.busy.lock().unwrap();
        let out = self.stage().join("out");
        let _ = fs::remove_dir_all(&out);
        fs::write(self.staged(), source).map_err(|e| e.to_string())?;
        let run = body::check(&self.node, &self.toolkit, &self.staged(), &out)?;
        let images = ["sheet.png", "rig.png"].iter().map(|f| out.join("body").join(f)).filter(|p| p.exists()).collect();
        let mut report = run.stdout.trim_end().to_string();
        if report.is_empty() { report = format!("The checker produced no report.\n{}", run.stderr.trim()); }
        let reject = |report: String, images| Ok(Outcome { report, packed: None, commit: None, images });
        if !run.ok { return reject(report, images); }
        // The checker passes still sculptures too; a body must also have a skeleton to be driven.
        let packed = match body::pack(&self.node, &self.toolkit, &self.staged()) {
            Ok(p) => p,
            Err(e) => return reject(format!("RESULT: NOT A BODY\n\n{e}\nA body needs bones and a rig block; see references/RIGGING.md.\n\n{report}"), images),
        };
        fs::write(self.file(), source).map_err(|e| e.to_string())?;
        fs::write(self.repo.join("report.txt"), format!("{report}\n")).map_err(|e| e.to_string())?;
        let title = report.lines().next().unwrap_or("").trim().to_string();
        let subject = if note.trim().is_empty() { "New body".to_string() } else { note.trim().lines().next().unwrap_or("").chars().take(72).collect() };
        let commit = self.commit(&subject, &format!("{}\n\n{title}", note.trim()))?;
        Ok(Outcome { report, packed: Some(packed), commit: Some(commit), images })
    }

    /// Brings back the body from an earlier commit by submitting it again, so it is re-checked and
    /// history only ever moves forward.
    pub fn revert(&self, rev: &str) -> Result<Outcome, String> {
        if rev.is_empty() || !rev.chars().all(|c| c.is_ascii_alphanumeric() || "~^-_./".contains(c)) || rev.starts_with('-') {
            return Err(format!("\"{rev}\" is not a commit reference"));
        }
        let source = self.git(&["show", &format!("{rev}:body.js")]).map_err(|_| format!("no body found at commit \"{rev}\"; get_body lists recent commits"))?;
        self.submit(&source, &format!("Revert to {rev}"))
    }

    /// Recent commits, newest first: "hash  date  subject".
    pub fn history(&self, n: usize) -> Vec<String> {
        self.git(&["log", &format!("-{n}"), "--date=format:%Y-%m-%d %H:%M", "--format=%h  %ad  %s"])
            .map(|s| s.lines().map(String::from).collect()).unwrap_or_default()
    }

    /// Commits body.js and report.txt as this creature. Returns the short hash (of HEAD if nothing changed).
    fn commit(&self, subject: &str, body: &str) -> Result<String, String> {
        self.git(&["add", "-A", "."])?;
        let (who, mail) = (format!("user.name=lil ({})", self.name), format!("user.email={}@lil.invalid", self.name));
        let msg = if body.trim().is_empty() { subject.to_string() } else { format!("{subject}\n\n{}", body.trim()) };
        // "nothing to commit" (the same source submitted twice) is fine: HEAD already is this body.
        let _ = self.git(&["-c", &who, "-c", &mail, "-c", "commit.gpgsign=false", "commit", "-q", "-m", &msg]);
        Ok(self.git(&["rev-parse", "--short", "HEAD"])?.trim().to_string())
    }

    fn git(&self, args: &[&str]) -> Result<String, String> {
        let out = Command::new("git").arg("-C").arg(&self.repo).args(args).output().map_err(|e| format!("could not run git: {e}"))?;
        if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).into_owned()) }
        else { Err(format!("git {}: {}", args.first().unwrap_or(&""), String::from_utf8_lossy(&out.stderr).trim())) }
    }
}

