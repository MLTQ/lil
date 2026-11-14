//! The MCP side of the HTTP server: JSON-RPC over one POST endpoint, two tools. See mcp.md.
use crate::mind::{Express, Mind, SetBody};
use serde_json::{json, Value};
use tauri::AppHandle;

const PROTOCOLS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];

fn tools() -> Value {
    json!([
        {
            "name": "express",
            "description": "Show something on your desktop creature for a few seconds: a gesture, a look direction, an energy level, or any mix. It then returns to its baseline state by itself. Call get_body first to learn which gestures this body has.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "gesture": { "type": "string", "description": "A gesture name from get_body, or \"idle\"." },
                    "look": { "type": "array", "items": { "type": "number", "minimum": -1, "maximum": 1 }, "minItems": 2, "maxItems": 2,
                              "description": "[x, y], each -1 to 1. x: -1 is the creature's far left on screen, 1 far right. y: -1 down, 1 up. Without it the eyes follow the mouse cursor." },
                    "energy": { "type": "number", "minimum": 0, "maximum": 1, "description": "0 is nearly still, 0.5 normal, 1 lively. Scales the resting motion." },
                    "seconds": { "type": "number", "minimum": 0.5, "maximum": 60, "description": "How long to hold it. Default 6. Ignored for gestures that play once." }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "get_body",
            "description": "Describe your current desktop creature: its name, the gestures it can make, its bones, how it shows each baseline state, where its scene file is, and its recent history of bodies.",
            "inputSchema": {
                "type": "object",
                "properties": { "source": { "type": "boolean", "description": "Also return the full text of the scene file. Use this before revising the body." } },
                "additionalProperties": false
            }
        },
        {
            "name": "set_body",
            "description": "Change your desktop creature's body. Give the complete source of a scene file (the format of the pixel-splat-sculptures skill, with bones and a rig block). It is run through the toolkit's checker; the live body is replaced only if it passes, and each accepted body is a commit in the creature's own repository. The checker's full report is returned either way, so fix what it lists and submit again. To go back to an earlier body, give revert instead of scene. Takes several seconds.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "scene": { "type": "string", "description": "The whole scene file as text: module.exports = { name, build(b) { ... }, rig: { ... } }. Not a path." },
                    "revert": { "type": "string", "description": "A commit hash from get_body's history. That body is checked again and becomes current." },
                    "note": { "type": "string", "description": "One line on what changed and why. Becomes the commit message." }
                },
                "additionalProperties": false
            }
        }
    ])
}

fn text(s: String, is_error: bool) -> Value { json!({ "content": [{ "type": "text", "text": s }], "isError": is_error }) }

fn call(mind: &Mind, app: &AppHandle, params: &Value) -> Result<Value, (i64, String)> {
    let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
    match params["name"].as_str() {
        Some("express") => Ok(match serde_json::from_value::<Express>(args) {
            Ok(e) => match mind.express(app, e) { Ok(s) => text(s, false), Err(s) => text(s, true) },
            Err(e) => text(format!("bad arguments: {e}"), true),
        }),
        Some("get_body") => Ok(text(serde_json::to_string_pretty(&mind.describe(args["source"].as_bool().unwrap_or(false))).unwrap_or_default(), false)),
        Some("set_body") => Ok(match serde_json::from_value::<SetBody>(args) {
            Ok(req) => match mind.set_body(app, req) { Ok((accepted, s)) => text(s, !accepted), Err(s) => text(s, true) },
            Err(e) => text(format!("bad arguments: {e}"), true),
        }),
        other => Err((-32602, format!("unknown tool {other:?}"))),
    }
}

/// Handles one JSON-RPC message. Returns None for notifications, which get no reply.
pub fn handle(mind: &Mind, app: &AppHandle, msg: &Value) -> Option<Value> {
    let id = msg.get("id").cloned()?;
    let result = match msg["method"].as_str().unwrap_or("") {
        "initialize" => {
            let asked = msg["params"]["protocolVersion"].as_str().unwrap_or("");
            Ok(json!({
                "protocolVersion": if PROTOCOLS.contains(&asked) { asked } else { PROTOCOLS[0] },
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "lil", "version": env!("CARGO_PKG_VERSION") },
                "instructions": "lil is your small desktop creature. Its baseline states (thinking, working, waiting) are driven for you. Use express sparingly, for moments worth showing. The body is yours to revise with set_body."
            }))
        }
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": tools() })),
        "tools/call" => call(mind, app, &msg["params"]),
        m => Err((-32601, format!("method not found: {m}"))),
    };
    Some(match result {
        Ok(r) => json!({ "jsonrpc": "2.0", "id": id, "result": r }),
        Err((code, message)) => json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }),
    })
}
