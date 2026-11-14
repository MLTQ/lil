//! The instance's HTTP server on 127.0.0.1: MCP, harness hooks and plain state changes. See server.md.
use crate::{mcp, mind::{self, Mind}};
use serde_json::{json, Value};
use std::{io::Read, sync::Arc, thread};
use tauri::AppHandle;
use tiny_http::{Header, Method, Request, Response, Server};

const MAX_BODY: u64 = 4 << 20;

pub fn start(app: AppHandle, mind: Arc<Mind>, port: u16) -> Result<(), String> {
    let server = Server::http(("127.0.0.1", port)).map_err(|e| format!("could not listen on 127.0.0.1:{port}: {e}"))?;
    eprintln!("lil: listening on http://127.0.0.1:{port} (MCP at /mcp)");
    // A few workers, because set_body takes seconds and hook posts must not wait behind it.
    let server = Arc::new(server);
    for _ in 0..4 {
        let (server, app, mind) = (server.clone(), app.clone(), mind.clone());
        thread::spawn(move || {
            while let Ok(mut req) = server.recv() {
                let (code, body) = route(&app, &mind, &mut req, port);
                let mut res = Response::from_string(body.map(|v| v.to_string()).unwrap_or_default()).with_status_code(code);
                res.add_header(Header::from_bytes("Content-Type", "application/json").unwrap());
                let _ = req.respond(res);
            }
        });
    }
    Ok(())
}

fn header<'a>(req: &'a Request, name: &'static str) -> Option<&'a str> {
    req.headers().iter().find(|h| h.field.equiv(name)).map(|h| h.value.as_str())
}

/// Only this machine may talk to the creature, and not through a web page: the Host must be a loopback name
/// (stops DNS rebinding) and a browser Origin, if present, must be loopback too.
fn local_only(req: &Request, port: u16) -> bool {
    let loopback = |h: &str| ["127.0.0.1", "localhost", "[::1]"].iter().any(|n| h == *n || h == format!("{n}:{port}"));
    let host_ok = header(req, "Host").map(loopback).unwrap_or(false);
    let origin_ok = header(req, "Origin").map(|o| o.strip_prefix("http://").map(loopback).unwrap_or(false)).unwrap_or(true);
    host_ok && origin_ok
}

fn read_json(req: &mut Request) -> Result<Value, String> {
    let mut s = String::new();
    req.as_reader().take(MAX_BODY).read_to_string(&mut s).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| format!("body is not JSON: {e}"))
}

fn route(app: &AppHandle, mind: &Mind, req: &mut Request, port: u16) -> (u16, Option<Value>) {
    if !local_only(req, port) { return (403, Some(json!({ "error": "local requests only" }))); }
    let url = req.url().split('?').next().unwrap_or("").to_string();
    let err = |code: u16, e: String| (code, Some(json!({ "error": e })));
    match (req.method(), url.as_str()) {
        (Method::Get, "/health") => (200, Some(json!({ "instance": app.package_info().name, "body": mind.body_name(), "state": mind.base().state }))),
        (Method::Get, "/body") => (200, Some(mind.describe(false))),

        // MCP, Streamable HTTP transport without streaming: every request gets one JSON reply.
        (Method::Post, "/mcp") => match read_json(req) {
            Ok(msg) => match mcp::handle(mind, app, &msg) { Some(reply) => (200, Some(reply)), None => (202, None) },
            Err(e) => (400, Some(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": e } }))),
        },
        (_, "/mcp") => (405, None),

        // Claude Code HTTP hooks post their event JSON here. Always answer 200 with an empty body (Claude Code
        // reads that as success with no output), so a hook can never block or steer the agent.
        (Method::Post, "/hook") => {
            if let Ok(v) = read_json(req) {
                if let Some(state) = v["hook_event_name"].as_str().and_then(mind::state_for_hook) { let _ = mind.set_state(app, state); }
            }
            (200, None)
        }

        // Any other harness: POST /state/<name>.
        (Method::Post, u) if u.starts_with("/state/") => match mind.set_state(app, &u["/state/".len()..]) {
            Ok(base) => (200, Some(json!(base))),
            Err(e) => err(404, e),
        },

        // The same expression the MCP tool makes, for harnesses without MCP.
        (Method::Post, "/express") => match read_json(req).and_then(|v| serde_json::from_value(v).map_err(|e| e.to_string())) {
            Ok(e) => match mind.express(app, e) { Ok(s) => (200, Some(json!({ "ok": s }))), Err(e) => err(400, e) },
            Err(e) => err(400, e),
        },
        // The same body change the MCP tool makes: { scene | revert, note? }. 200 = accepted, 422 = rejected.
        (Method::Post, "/body") => match read_json(req).and_then(|v| serde_json::from_value(v).map_err(|e| e.to_string())) {
            Ok(b) => match mind.set_body(app, b) {
                Ok((accepted, report)) => (if accepted { 200 } else { 422 }, Some(json!({ "accepted": accepted, "report": report }))),
                Err(e) => err(400, e),
            },
            Err(e) => err(400, e),
        },
        // The window cannot be clicked, so this is how the creature is closed: `lil --quit` posts here.
        (Method::Post, "/quit") => {
            let app = app.clone();
            thread::spawn(move || { thread::sleep(std::time::Duration::from_millis(150)); app.exit(0); });
            (200, Some(json!({ "ok": "bye" })))
        }
        _ => (404, Some(json!({ "error": "not found" }))),
    }
}
