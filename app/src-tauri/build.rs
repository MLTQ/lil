// Copies the toolkit's renderer and rig runtime, unchanged, into ui/vendor/ so the
// webview can load them with plain <script> tags. See build.md.
use std::{env, fs, path::PathBuf};

fn main() {
    let here = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let toolkit = env::var("LIL_TOOLKIT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| here.join("../../pixel-splat-sculptures"));
    let vendor = here.join("../ui/vendor");
    fs::create_dir_all(&vendor).expect("create ui/vendor");
    println!("cargo:rerun-if-env-changed=LIL_TOOLKIT");
    for f in ["core.js", "rig.js"] {
        let src = toolkit.join("lib").join(f);
        println!("cargo:rerun-if-changed={}", src.display());
        fs::copy(&src, vendor.join(f)).unwrap_or_else(|e| panic!("copy {}: {e}", src.display()));
    }
    tauri_build::build();
}
