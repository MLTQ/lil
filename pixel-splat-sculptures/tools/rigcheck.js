// Rig checks and rig outputs. Called by make.js when the scene defines bones.
const fs = require('fs'), path = require('path');
const L = require('../lib');
const K = 16, VISIBLE_MIN = 3;

module.exports = function rigcheck(sc, ctx) {
  const { problems, warnings, outDir, png, cam, PITCH = 0.48, RES_SHEET = 192 } = ctx, P = (s) => problems.push(s), Wn = (s) => warnings.push(s);
  const B = sc.bones, n = B.length, names = B.map((b) => b.name), lines = [], files = [];
  const spec = sc.rig || {}, gest = Object.keys(spec.gestures || {});
  const fmt = (v) => '[' + v.map((x) => x.toFixed(2)).join(', ') + ']';

  // ---- the spec itself ----
  if (!sc.rig) { P('The scene has bones but no "rig" block, so nothing moves. Add rig: { idle: {...}, gestures: {...} } to the scene file (copy the block from scenes/hermit-rigged.js).'); }
  const checkPose = (label, pose) => {
    for (const k of Object.keys(pose || {})) {
      if (k === 'once') continue;
      if (!names.includes(k)) { P(`${label} uses a bone called "${k}" that does not exist. Bones are: ${names.join(', ')}.`); continue; }
      for (const f of ['r', 't']) if (pose[k][f] && !(Array.isArray(pose[k][f]) && pose[k][f].length === 3)) P(`${label}, bone "${k}": "${f}" must be a list of exactly 3 values, like ${f}: [0, 0, 0].`);
      for (const f of Object.keys(pose[k])) if (f !== 'r' && f !== 't' && f !== 's') P(`${label}, bone "${k}": unknown key "${f}". Only r (rotation), t (offset) and s (size) are allowed.`);
      if (pose[k].s != null) { const c = pose[k].s, v = typeof c === 'number' ? c : (c.base == null ? 0 : c.base); if (Array.isArray(c)) P(`${label}, bone "${k}": "s" is one value, not a list. Example: s: 1.3`); else if (v < 0.3 || v > 2.5) P(`${label}, bone "${k}": size "s" must stay between 0.3 and 2.5, and 1 means normal size. A moving size needs base: 1, for example s: { base: 1, amp: 0.25, speed: 6 }.`); }
      for (const c of (pose[k].r || [])) { const m = typeof c === 'number' ? Math.abs(c) : Math.abs(c.base || 0) + Math.abs(c.amp || 0); if (m > 2.6) Wn(`${label}, bone "${k}": a rotation of ${m.toFixed(1)} radians is more than a three-quarter turn. Angles are radians; 1.57 is a right angle.`); }
    }
  };
  checkPose('idle', spec.idle);
  for (const g of gest) checkPose(`gesture "${g}"`, spec.gestures[g]);
  if (spec.look) for (const e of [...(spec.look.eyes || []), spec.look.head].filter(Boolean)) if (!names.includes(e)) P(`look uses a bone called "${e}" that does not exist. Bones are: ${names.join(', ')}.`);
  if (sc.rig && !spec.idle) P('The rig has no "idle" pose. Add idle: { ... } with at least one slow oscillation so the creature breathes.');
  if (sc.rig && gest.length < 2) P(`The rig has ${gest.length} gesture(s). Add at least 2, each clearly different.`);
  if (problems.length) return { lines, files }; // later checks need a valid spec

  // ---- bones at rest ----
  const count = new Int32Array(n), own = B.map(() => []);
  for (let i = 0; i < sc.N; i++) { const a = sc.bA[i]; if (a !== 255) { count[a]++; own[a].push(i); } }
  const bound = count.reduce((s, x) => s + x, 0);
  if (!bound) P('No splats are bound to any bone. Call b.bind("boneName") before building each part that should move.');
  const pos = (D, i) => [D[i * K], D[i * K + 1], D[i * K + 2]];
  for (let i = 0; i < n; i++) {
    const hasKids = B.some((b) => b.parent === i);
    if (!count[i]) { if (!hasKids) P(`Bone "${names[i]}" moves nothing. Call b.bind("${names[i]}") just before building the part it should move, or delete the bone.`); continue; }
    let best = 1e9, bp = null; for (const s of own[i]) { const q = pos(sc.D, s), d = Math.hypot(q[0] - B[i].pivot[0], q[1] - B[i].pivot[1], q[2] - B[i].pivot[2]); if (d < best) { best = d; bp = q; } }
    if (best > 0.13) P(`Bone "${names[i]}": its pivot ${fmt(B[i].pivot)} is ${best.toFixed(2)} away from the part it moves, so the part will swing around empty space. Put the pivot at the joint, where the part meets its parent. The nearest point of the part is ${fmt(bp)}.`);
  }
  // seams: where a bone's part touches the part of its nearest ancestor that has splats
  const seams = B.map(() => null);
  for (let c = 0; c < n; c++) {
    if (!count[c]) continue;
    let a = B[c].parent; while (a >= 0 && !count[a]) a = B[a].parent; if (a < 0) continue;
    const pairs = [];
    for (const s of own[c]) { const q = pos(sc.D, s); let bd = 0.075, bj = -1; for (const j of own[a]) { const d = Math.hypot(sc.D[j * K] - q[0], sc.D[j * K + 1] - q[1], sc.D[j * K + 2] - q[2]); if (d < bd) { bd = d; bj = j; } } if (bj >= 0) pairs.push([s, bj, bd]); }
    pairs.sort((x, y) => x[2] - y[2]);
    if (!pairs.length) { Wn(`Bone "${names[c]}": its part does not touch the part of "${names[a]}" at rest. If it is meant to be attached, make the two overlap.`); continue; }
    seams[c] = { a, pairs: pairs.slice(0, 40) };
  }

  // ---- simulate each gesture ----
  const run = (g, onStep) => {
    const rig = new L.Rig(sc);
    for (let i = 0; i < 30; i++) rig.update(sc.controller(i * 0.04, { gesture: 'idle', look: [0, 0], energy: 0.5 }), 0.04);
    const idleD = new Float32Array(rig.D);
    for (let s = 0; s <= 62; s++) { const t = s * 0.04; rig.update(sc.controller(10 + t, { gesture: g, since: t, look: [0, 0], energy: 0.5 }), 0.04); onStep(rig, t, idleD, s); }
  };
  lines.push('', `RIG  ${n} bones | gestures: idle, ${gest.join(', ')}`, '  what moves in each gesture (bone: furthest any of its splats travels from the idle pose)');
  const all = ['idle', ...gest];
  for (const g of all) {
    const peak = new Float32Array(n), gap = new Float32Array(n); let outOfFrame = 0;
    const lo = new Float32Array(sc.N * 3).fill(1e9), hi = new Float32Array(sc.N * 3).fill(-1e9);
    run(g, (rig, t, idleD) => {
      const D = rig.D;
      for (let i = 0; i < sc.N; i++) {
        const a = sc.bA[i]; if (a === 255) continue;
        for (let k = 0; k < 3; k++) { const v = D[i * K + k]; if (v < lo[i * 3 + k]) lo[i * 3 + k] = v; if (v > hi[i * 3 + k]) hi[i * 3 + k] = v; }
        const d = Math.hypot(D[i * K] - idleD[i * K], D[i * K + 1] - idleD[i * K + 1], D[i * K + 2] - idleD[i * K + 2]);
        if (d > peak[a]) peak[a] = d;
        if (Math.abs(D[i * K]) > 1.3 || Math.abs(D[i * K + 2]) > 1.3 || D[i * K + 1] > 1.35 || D[i * K + 1] < -1.2) outOfFrame++;
      }
      for (let c = 0; c < n; c++) if (seams[c]) {
        const inc = seams[c].pairs.map(([s, j, d0]) => Math.hypot(D[s * K] - D[j * K], D[s * K + 1] - D[j * K + 1], D[s * K + 2] - D[j * K + 2]) - d0).sort((x, y) => x - y);
        const med = inc[inc.length >> 1]; if (med > gap[c]) gap[c] = med;
      }
    });
    // idle: measure travel within the pose (range), since "distance from idle" is the definition of zero there
    if (g === 'idle') { peak.fill(0); for (let i = 0; i < sc.N; i++) { const a = sc.bA[i]; if (a === 255) continue; const d = Math.hypot(hi[i * 3] - lo[i * 3], hi[i * 3 + 1] - lo[i * 3 + 1], hi[i * 3 + 2] - lo[i * 3 + 2]); if (d > peak[a]) peak[a] = d; } }
    const moved = [...peak].map((d, i) => [d, names[i]]).filter((x) => x[0] > 0.02).sort((x, y) => y[0] - x[0]);
    lines.push(`  ${g.padEnd(10)} ${moved.length ? moved.slice(0, 8).map((x) => `${x[1]} ${x[0].toFixed(2)}`).join(', ') : '(nothing)'}`);
    if (g === 'idle') { if (!moved.length) P('Idle does not move at all. Give at least one bone a slow oscillation, for example t: [0, { amp: 0.012, speed: 2 }, 0] on the body, so the creature breathes.'); }
    else if (!moved.length || moved[0][0] < 0.04) P(`Gesture "${g}" looks the same as idle (largest movement ${moved.length ? moved[0][0].toFixed(2) : '0.00'}). Use bigger angles (0.5 to 1.2 radians) or offsets (0.05 to 0.3).`);
    if (g !== 'idle') { const weak = Object.keys(spec.gestures[g]).filter((k) => k !== 'once' && names.includes(k) && !B[names.indexOf(k)].jiggle && count[names.indexOf(k)] && peak[names.indexOf(k)] < 0.03); if (weak.length) Wn(`Gesture "${g}" sets ${weak.map((w) => '"' + w + '"').join(', ')} but ${weak.length > 1 ? 'they barely move' : 'it barely moves'} (under 0.03). Use a bigger value or remove ${weak.length > 1 ? 'them' : 'it'} from the gesture.`); }
    if (outOfFrame) P(`Gesture "${g}" throws parts out of the frame. Reduce its offsets (t values) to under 0.3 and check for a pivot that is far from its part.`);
    for (let c = 0; c < n; c++) if (gap[c] > 0.06) {
      const m = [0, 0, 0]; seams[c].pairs.forEach(([s]) => { m[0] += sc.D[s * K]; m[1] += sc.D[s * K + 1]; m[2] += sc.D[s * K + 2]; }); const k = seams[c].pairs.length;
      P(`Gesture "${g}": the part on bone "${names[c]}" pulls ${gap[c].toFixed(2)} away from "${names[seams[c].a]}", leaving a gap. Its pivot ${fmt(B[c].pivot)} is not at the joint. Move the pivot to about ${fmt(m.map((x) => x / k))}, where the two parts meet. If you used a t offset on this bone, remove it and rotate instead.`);
    }
  }

  // ---- outputs: gesture sheet (zoomed on the creature) and interactive page ----
  let ex = 0.1, ylo = 1e9, yhi = -1e9; const cyw = Math.cos(0.35), syw = Math.sin(0.35), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  for (let i = 0; i < sc.N; i++) if (sc.bA[i] !== 255) { const x = sc.D[i * K], y = sc.D[i * K + 1], z = sc.D[i * K + 2], X = x * cyw - z * syw, Y = -x * syw * sp + y * cp - z * cyw * sp; ex = Math.max(ex, Math.abs(X)); ylo = Math.min(ylo, Y); yhi = Math.max(yhi, Y); }
  const half = Math.max(ex, (yhi - ylo) / 2) * 1.45 + 0.08, zoomScene = (scn) => Object.assign({}, scn, { cy: (ylo + yhi) / 2 / cp });
  const times = [0.2, 0.5, 0.9, 1.5, 2.2], UP = 2, RES = RES_SHEET, W = RES * UP * times.length, H = RES * UP * all.length, img = new Uint8ClampedArray(W * H * 4), R = new L.Renderer(RES, RES);
  const zcam = { yaw: 0.35, pitch: PITCH, scale: Math.min(RES / 1.1, RES / (2 * half)) }, ref = [];
  lines.push('  how visible each gesture is (share of the close-up picture that differs from idle; under ' + VISIBLE_MIN + '% cannot be seen)');
  all.forEach((g, row) => {
    let col = 0, best = 0;
    run(g, (rig, t) => {
      if (col >= times.length || t < times[col]) return;
      const px = R.draw(zoomScene(Object.assign({}, rig.scene, { glow: sc.glow })), zcam, 3 + times[col]);
      if (row === 0) ref.push(Uint8ClampedArray.from(px)); else { let d = 0; const q = ref[col]; for (let i = 0; i < RES * RES; i++) if (px[i * 4] !== q[i * 4] || px[i * 4 + 1] !== q[i * 4 + 1] || px[i * 4 + 2] !== q[i * 4 + 2]) d++; best = Math.max(best, (d / (RES * RES)) * 100); }
      for (let y = 0; y < RES * UP; y++) for (let x = 0; x < RES * UP; x++) { const s2 = ((y / UP | 0) * RES + (x / UP | 0)) * 4, d = ((row * RES * UP + y) * W + col * RES * UP + x) * 4; img[d] = px[s2]; img[d + 1] = px[s2 + 1]; img[d + 2] = px[s2 + 2]; img[d + 3] = 255; }
      col++;
    });
    if (row > 0) { lines.push(`  ${g.padEnd(10)} ${best.toFixed(1)}%`); if (best < VISIBLE_MIN) P(`Gesture "${g}" cannot be seen: only ${best.toFixed(1)}% of the close-up picture changes (needs ${VISIBLE_MIN}%). Move a bigger part, or move it further. To puff or shrink a part use s, for example s: { base: 1, amp: 0.3, speed: 6 }.`); }
  });
  fs.writeFileSync(path.join(outDir, 'rig.png'), png(W, H, img));
  files.push(`  ${outDir}/rig.png       close-up, one row per gesture (${all.join(', ')}), five moments each`);
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
  const data = { name: sc.name, N: sc.N, bg: sc.bg, cy: sc.cy, bob: sc.bob, glow: sc.glow, drift: sc.drift, bones: B, rig: spec,
    ramps: sc.ramps.map((r) => Array.from(r)), D: b64(sc.D), bA: b64(sc.bA), bB: b64(sc.bB), bW: b64(sc.bW) };
  const body = rd('rig-viewer.template.html').replace('/*CORE*/', () => rd('../lib/core.js')).replace('/*RIG*/', () => rd('../lib/rig.js')).replace('/*DATA*/', () => JSON.stringify(data));
  fs.writeFileSync(path.join(outDir, 'rig.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + body + '</body></html>');
  fs.writeFileSync(path.join(outDir, 'rig.artifact.html'), body);
  files.push(`  ${outDir}/rig.html      interactive page: gesture buttons, eyes follow the pointer`);
  return { lines, files };
};
