// Turns a scene file into the JSON body the webview renders. See pack-body.md.
//   node pack-body.js <toolkit dir> <scene file>      (the app pipes this script to `node -`)
// Prints one JSON object to stdout. Exits 1 with the error on stderr if the scene does not build.
const path = require('path');
const [toolkit, scene] = process.argv.slice(2);
if (!toolkit || !scene) { console.error('usage: pack-body.js <toolkit dir> <scene file>'); process.exit(2); }
let L, sc, def;
try {
  L = require(path.resolve(toolkit, 'lib'));
  def = require(path.resolve(scene));
  sc = L.load(def);
} catch (e) { console.error(e.message); process.exit(1); }
if (!sc.bones || !sc.bones.length) { console.error('The scene has no bones; a body needs a rig.'); process.exit(1); }

// Centre the piece vertically the same way tools/make.js does, so the body sits in
// the frame exactly as it does in the toolkit's own sheets and rig page.
if (!sc.cy) {
  const K = 16, D = sc.D, PITCH = 0.48, cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  let lo = 1e9, hi = -1e9;
  for (let v = 0; v < 8; v++) {
    const yaw = (v / 8) * Math.PI * 2, cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let i = 0; i < sc.N; i++) {
      const o = i * K; if (D[o + 14] & L.DRIFT) continue;
      const r = Math.sqrt(Math.max(D[o + 3], D[o + 6], D[o + 8]));
      const Y = -D[o] * sy * sp + D[o + 1] * cp - D[o + 2] * cy * sp;
      lo = Math.min(lo, Y - r); hi = Math.max(hi, Y + r);
    }
  }
  sc.cy = (lo + hi) / 2 / cp;
}

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
process.stdout.write(JSON.stringify({
  name: sc.name, N: sc.N, bg: sc.bg, cy: sc.cy, bob: sc.bob, glow: sc.glow, drift: sc.drift,
  bones: sc.bones, rig: sc.rig || {},
  // Optional: how this body shows the baseline states, e.g. { tool: { gesture: 'scuttle', energy: 0.7 } }.
  states: def.states && typeof def.states === 'object' ? def.states : {},
  ramps: sc.ramps.map((r) => Array.from(r)),
  D: b64(sc.D), bA: b64(sc.bA), bB: b64(sc.bB), bW: b64(sc.bW),
}));
