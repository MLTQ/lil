// The creature's render loop. See main.md.
// Loads the packed body from the app, then steps the rig and draws it with a
// transparent background at a fixed frame rate. The only input in milestone 1 is
// the global cursor position, which Rust sends as a "cursor" event.
(async function () {
  const { invoke } = window.__TAURI__.core, { listen } = window.__TAURI__.event;
  const boot = await invoke('boot');
  const cfg = boot.render;
  const bytes = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const f32 = (s) => new Float32Array(bytes(s).buffer);

  const RES = cfg.res, cv = document.getElementById('stage'), ctx = cv.getContext('2d');
  cv.width = cv.height = RES;
  const R = new Splat.Renderer(RES, RES), img = ctx.createImageData(RES, RES);
  const cam = { yaw: cfg.yaw, pitch: 0.48, scale: RES / 2.55 }; // same framing as tools/make.js

  // The body: rebuilt from packed data at start and whenever set_body swaps in a new one.
  let rig, controller, G;
  function wear(packed) {
    const data = JSON.parse(packed);
    const sc = Object.assign({}, data, { D: f32(data.D), bA: bytes(data.bA), bB: bytes(data.bB), bW: f32(data.bW), ramps: data.ramps.map((r) => Uint8Array.from(r)) });
    rig = new SplatRig.Rig(sc); controller = SplatRig.makeController(data.rig); G = data.rig.gestures || {};
  }
  wear(boot.body);

  // The intent is the whole interface to the body: what the toolkit's controller turns into bone targets.
  const intent = { gesture: 'idle', since: 0, look: [0, 0], energy: 0.5 };
  let time = 10, cursorLook = [0, 0], carried = false;

  // Two layers decide the intent. The baseline comes from harness hooks (thinking, tool, waiting...) and
  // holds until the next one. An expression comes from the agent (MCP express), lasts a few seconds, and
  // shows on top; when it ends the baseline shows again.
  let base = Object.assign({ at: time }, boot.base);   // { state, gesture, energy, for?, at }
  let expr = null;                                     // { gesture?, look?, energy?, until }
  listen('base', (e) => { base = Object.assign({ at: time }, e.payload); });
  listen('express', (e) => { expr = Object.assign({ until: time + e.payload.seconds }, e.payload); });
  listen('body', (e) => { // a new body: wear it, drop any expression made for the old one, let the springs settle
    wear(e.payload.body); expr = null; base = Object.assign({ at: time }, e.payload.base);
    intent.gesture = 'idle'; intent.since = 0; showing = '';
    for (let i = 0; i < 30; i++) step(0.04);
  });

  // Cursor offset from the window centre, in logical pixels. The direction is kept and the
  // length saturates, so the eyes still move for a nearby cursor and reach full turn far away.
  const REACH = 260;
  listen('cursor', (e) => {
    const { dx, dy, held } = e.payload, d = Math.hypot(dx, dy), k = 1.25 / (d + REACH);
    cursorLook = [Math.max(-1, Math.min(1, dx * k)), Math.max(-1, Math.min(1, -dy * k))];
    carried = held;
  });

  // A gesture has run its course when it plays once and has finished, or its hold time is over.
  const spent = (name, started, hold) => (G[name] && G[name].once != null && time - started > G[name].once + 0.1) || (hold != null && time - started > hold);

  function want() {
    if (expr && time >= expr.until) expr = null;
    const b = { gesture: spent(base.gesture, base.at, base.for) ? 'idle' : base.gesture, energy: base.energy, look: null, key: 'b' + base.at };
    if (!expr) return b;
    return { gesture: expr.gesture || b.gesture, energy: expr.energy == null ? b.energy : expr.energy, look: expr.look || null, key: expr.gesture ? 'e' + expr.until : b.key };
  }

  let showing = '';
  function step(dt) {
    time += dt; intent.since += dt;
    const w = want();
    // Restart the gesture clock when the gesture changes or a new state/expression asks for it again.
    if (w.gesture !== intent.gesture || w.key !== showing) { intent.gesture = w.gesture; intent.since = 0; showing = w.key; }
    // Being carried livens the motion; otherwise ease toward what the current layer asks for.
    intent.energy += ((carried ? 1 : w.energy) - intent.energy) * Math.min(1, dt * 4);
    const ease = Math.min(1, dt * 8), c = Math.cos(cam.yaw), goal = w.look || cursorLook;
    intent.look[0] += (goal[0] * c - intent.look[0]) * ease;
    intent.look[1] += (goal[1] - intent.look[1]) * ease;
    rig.update(controller(time, intent), dt);
  }
  function draw() {
    img.data.set(R.draw(rig.scene, cam, time, { alpha: true }));
    ctx.putImageData(img, 0, 0);
  }

  for (let i = 0; i < 30; i++) step(0.04); // settle so the first frame is a finished pose
  draw();

  // requestAnimationFrame ticks at the display rate; `due` keeps the long-run average at cfg.fps
  // even when that is not a whole fraction of the display rate.
  const gap = 1000 / cfg.fps;
  let last = 0, due = 0, cost = 0, frames = 0, mark = performance.now();
  requestAnimationFrame(function frame(ts) {
    requestAnimationFrame(frame);
    if (ts < due - 4) return;
    due = Math.max(due + gap, ts - gap);
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    const t0 = performance.now();
    step(dt); draw();
    cost += performance.now() - t0; frames++;
    if (t0 - mark > 5000) { // report the measured cost so it can be tuned from the app's log
      invoke('perf', { ms: cost / frames, fps: (frames * 1000) / (t0 - mark), look: intent.look, gesture: intent.gesture + ' @' + intent.energy.toFixed(2) });
      cost = 0; frames = 0; mark = t0;
    }
  });
})().catch((e) => window.__TAURI__.core.invoke('fail', { message: String(e && e.stack || e) }));
