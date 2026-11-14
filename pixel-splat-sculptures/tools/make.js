#!/usr/bin/env node
// Build, check and export one sculpture.
//   node tools/make.js scenes/my-piece.js [--res 192] [--dirs 8] [--frames 1] [--loop 8] [--out out]
// Prints a plain-text report and exits 0 when the piece passes, 1 when something must be fixed.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const L = require('../lib');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.log('Usage: node tools/make.js scenes/<file>.js [--res 192] [--dirs 8] [--frames 1] [--loop 8] [--out out]'); process.exit(2); }
const RES = +opt('res', 192), DIRS = +opt('dirs', 8), FRAMES = +opt('frames', 1), LOOP = +opt('loop', 8), OUT = opt('out', 'out');
const PITCH = 0.48, scaleFor = (res) => res / 2.55, HALF = 1.275;

// ---------- load ----------
let sc;
const abs = path.resolve(file);
try { sc = L.load(require(abs)); } catch (e) {
  const line = (e.stack || '').split('\n').find((l) => l.includes(abs));
  const m = line && line.match(/:(\d+):\d+\)?$/);
  console.log('RESULT: BUILD ERROR\n');
  console.log(e.message);
  if (m) console.log('Scene line: ' + path.basename(abs) + ':' + m[1] + '  ->  ' + (fs.readFileSync(abs, 'utf8').split('\n')[m[1] - 1] || '').trim());
  console.log('\nFix that line and run this command again.');
  process.exit(1);
}
const slug = path.basename(file).replace(/\.js$/, '');
const outDir = path.join(OUT, slug);
fs.mkdirSync(outDir, { recursive: true });

// ---------- helpers ----------
const K = 16, D = sc.D, DRIFT = L.DRIFT, E = L.E;
function subset(keep) {
  const idx = []; for (let i = 0; i < sc.N; i++) if (keep(i)) idx.push(i);
  const d = new Float32Array(idx.length * K), p = new Uint8Array(idx.length);
  idx.forEach((s, j) => { d.set(D.subarray(s * K, s * K + K), j * K); p[j] = sc.part[s]; });
  return Object.assign({}, sc, { N: idx.length, D: d, part: p });
}
const solid = subset((i) => !(D[i * K + 14] & DRIFT));
const cam = (yaw, res) => ({ yaw, pitch: PITCH, scale: scaleFor(res) });

// projected extents of the solid splats over 8 yaws, in world units
let Xmax = 0, Ymin = 1e9, Ymax = -1e9;
for (let v = 0; v < 8; v++) {
  const yaw = (v / 8) * Math.PI * 2, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  for (let i = 0; i < solid.N; i++) {
    const o = i * K, x = solid.D[o], y = solid.D[o + 1], z = solid.D[o + 2], r = Math.sqrt(Math.max(solid.D[o + 3], solid.D[o + 6], solid.D[o + 8]));
    const X = x * cy - z * sy, Y = -x * sy * sp + y * cp - z * cy * sp;
    Xmax = Math.max(Xmax, Math.abs(X) + r); Ymin = Math.min(Ymin, Y - r); Ymax = Math.max(Ymax, Y + r);
  }
}
if (sc.cy === 0 || sc.cy == null) sc.cy = solid.cy = (Ymin + Ymax) / 2 / Math.cos(PITCH); // centre vertically
const Yhalf = (Ymax - Ymin) / 2;

// ---------- checks ----------
const problems = [], warnings = [], notes = [];
const P = (s) => problems.push(s), Wn = (s) => warnings.push(s);

if (sc.N < 900) P(`Too simple: only ${sc.N} splats. A finished piece has 2,500-9,000. Add supporting pieces and ground dressing (see "Recipe" in SKILL.md).`);
else if (sc.N > 16000) P(`Too heavy: ${sc.N} splats. Keep it under 16,000. Remove parts or stop passing small "s" / large "cov" values.`);
if (Xmax > HALF * 0.98 || Yhalf > HALF * 0.98) P(`Too big for the frame: it reaches ${Xmax.toFixed(2)} sideways and is ${(Yhalf * 2).toFixed(2)} tall on screen. Limits are 1.25 sideways and 2.5 tall. Keep every part within 1.0 of the centre line (x and z between -1 and 1) and make the tallest thing shorter.`);
else if (Xmax < 0.6 && Yhalf < 0.6) P(`Too small in the frame: widest reach is ${Xmax.toFixed(2)} (should be 0.8-1.2). Build at the normal size: base radius about 0.75, hero about 0.6-0.9 tall.`);
const unnamed = sc.part.reduce((n, p) => n + (p === 0), 0);
if (unnamed > sc.N * 0.3) Wn('Most of the piece has no part name. Call b.part("name") before each section so this report can point at the right place.');

// floating parts: connected components of solid splats
(function floating() {
  const n = solid.N, d = solid.D, cell = 0.14, grid = new Map(), par = new Int32Array(n).map((_, i) => i), rad = new Float32Array(n);
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const key = (x, y, z) => (Math.floor(x / cell) + 512) * 1048576 + (Math.floor(y / cell) + 512) * 1024 + Math.floor(z / cell) + 512;
  for (let i = 0; i < n; i++) {
    rad[i] = Math.min(cell * 0.5, Math.sqrt(Math.max(d[i * K + 3], d[i * K + 6], d[i * K + 8])));
    const k = key(d[i * K], d[i * K + 1], d[i * K + 2]);
    if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
  }
  for (let i = 0; i < n; i++) {
    const x = d[i * K], y = d[i * K + 1], z = d[i * K + 2];
    for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) for (let c = -1; c <= 1; c++) {
      const g = grid.get(key(x + a * cell, y + b2 * cell, z + c * cell)); if (!g) continue;
      for (const j of g) {
        if (j <= i) continue;
        const lim = rad[i] + rad[j] + 0.02, dx = d[j * K] - x, dy = d[j * K + 1] - y, dz = d[j * K + 2] - z;
        if (dx * dx + dy * dy + dz * dz < lim * lim) { const ra = find(i), rb = find(j); if (ra !== rb) par[ra] = rb; }
      }
    }
  }
  const comps = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); }
  const list = [...comps.values()].sort((a, b2) => b2.length - a.length), main = list[0];
  const loose = list.slice(1).filter((c) => c.length >= 4);
  for (const c of loose.slice(0, 5)) {
    let cx = 0, cy = 0, cz = 0, lowest = 1e9; const names = new Set();
    for (const i of c) { cx += d[i * K]; cy += d[i * K + 1]; cz += d[i * K + 2]; lowest = Math.min(lowest, d[i * K + 1]); names.add(sc.parts[solid.part[i]]); }
    cx /= c.length; cy /= c.length; cz /= c.length;
    // distance to the nearest splat of the main body
    let gap = 1e9;
    for (const j of main) { const dx = d[j * K] - cx, dy = d[j * K + 1] - lowest, dz = d[j * K + 2] - cz; gap = Math.min(gap, Math.sqrt(dx * dx + dy * dy + dz * dz)); }
    P(`Floating piece: something in part "${[...names].join('", "')}" centred at [${cx.toFixed(2)}, ${cy.toFixed(2)}, ${cz.toFixed(2)}] touches nothing else (its lowest point is about ${gap.toFixed(2)} from the rest). Move it so it rests on or overlaps what it belongs to. For things standing on the base, use y = base.topY(x, z) - 0.02.`);
  }
  if (loose.length > 5) P(`${loose.length - 5} more floating pieces not listed.`);
})();

// pixel metrics over 8 views
const R = new L.Renderer(192, 192), W = 192, NV = 8;
const rampPx = new Float64Array(sc.ramps.length), rampDark = new Float64Array(sc.ramps.length), tones = sc.ramps.map(() => new Set());
const partRGB = new Float64Array(sc.parts.length * 3);
const partPx = new Float64Array(sc.parts.length), partBest = new Float64Array(sc.parts.length), holeBy = new Float64Array(sc.parts.length);
let filled = 0, dark = 0, emis = 0, holes = 0, solidity = [], fillFr = [];
const ascii = [];
for (let v = 0; v < NV; v++) {
  const yaw = (v / NV) * Math.PI * 2;
  const px = R.draw(Object.assign({}, solid, { glow: 0 }), cam(yaw, W), 3);
  const rb = R.rb, tb = R.tb, pb = R.pb, zb = R.zb, fb = R.fb, pv = new Float64Array(sc.parts.length);
  let f = 0; const lo = new Int32Array(W).fill(-1), hi = new Int32Array(W).fill(-1);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!rb[i]) continue;
    f++; if (lo[y] < 0) lo[y] = x; hi[y] = x;
    const ri = rb[i] - 1; rampPx[ri]++; tones[ri].add(tb[i]); if (tb[i] === 0) rampDark[ri]++;
    pv[pb[i]]++; partRGB[pb[i] * 3] += px[i * 4]; partRGB[pb[i] * 3 + 1] += px[i * 4 + 1]; partRGB[pb[i] * 3 + 2] += px[i * 4 + 2];
    if (fb[i]) emis++;
    if (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11 < 46) dark++;
    if (x > 0 && y > 0 && x < W - 1 && y < W - 1) {
      let deeper = 0; const z0 = zb[i];
      for (const j of [i - 1, i + 1, i - W, i + W]) if (rb[j] && zb[j] > z0 + 0.09) deeper++;
      if (deeper >= 4) { holes++; holeBy[pb[i - 1]]++; }
    }
  }
  filled += f; fillFr.push(f / (W * W));
  for (let p = 0; p < pv.length; p++) { partPx[p] += pv[p]; partBest[p] = Math.max(partBest[p], pv[p]); }
  // convex hull of the silhouette -> solidity
  const pts = []; for (let y = 0; y < W; y++) if (lo[y] >= 0) { pts.push([lo[y], y]); pts.push([hi[y] + 1, y]); pts.push([lo[y], y + 1]); pts.push([hi[y] + 1, y + 1]); }
  pts.sort((a, b2) => a[0] - b2[0] || a[1] - b2[1]);
  const cr = (o, a, b2) => (a[0] - o[0]) * (b2[1] - o[1]) - (a[1] - o[1]) * (b2[0] - o[0]), hull = [];
  for (const p of pts) { while (hull.length >= 2 && cr(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
  const t = hull.length + 1;
  for (let i = pts.length - 2; i >= 0; i--) { const p = pts[i]; while (hull.length >= t && cr(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
  let area = 0; for (let i = 0; i < hull.length - 1; i++) area += hull[i][0] * hull[i + 1][1] - hull[i + 1][0] * hull[i][1];
  solidity.push(f / Math.max(1, Math.abs(area) / 2));
  if (v === 0 || v === 2) { // text picture: front and right side
    const cols = 64, rows = 32, lines = [];
    for (let r = 0; r < rows; r++) {
      let s = '';
      for (let c = 0; c < cols; c++) {
        const cnt = {}; let best = 0, ch = '.';
        for (let y = r * 6; y < r * 6 + 6; y++) for (let x = c * 3; x < c * 3 + 3; x++) {
          const i = y * W + x; if (!rb[i]) continue;
          const n = (cnt[pb[i]] = (cnt[pb[i]] || 0) + 1); if (n > best) { best = n; ch = String.fromCharCode(pb[i] === 0 ? 63 : 96 + Math.min(26, pb[i])); }
        }
        s += best >= 5 ? ch : '.';
      }
      lines.push(s.replace(/\.+$/, ''));
    }
    while (lines.length && !lines[0]) lines.shift(); while (lines.length && !lines[lines.length - 1]) lines.pop();
    ascii.push({ title: v === 0 ? 'FRONT (camera at +z)' : 'RIGHT SIDE (camera at +x)', lines });
  }
}
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const holePct = (holes / filled) * 100;
if (holePct > 0.45) {
  const worst = [...holeBy].map((n, p) => [n, sc.parts[p]]).sort((a, b2) => b2[0] - a[0])[0];
  P(`Surfaces have pinholes (${holePct.toFixed(2)}% of pixels; limit 0.45%), mostly in part "${worst[1]}". On the calls in that part, remove any "s" option you set by hand, or add cov: 2.4.`);
}
const usedRamps = sc.rampNames.map((n, i) => ({ n, share: rampPx[i] / filled, tones: tones[i].size, steps: sc.ramps[i].length / 3, darkShare: rampDark[i] / Math.max(1, rampPx[i]) })).sort((a, b2) => b2.share - a.share);
const big = usedRamps.filter((r) => r.share > 0.03);
if (sc.rampNames.length < 4) P(`Only ${sc.rampNames.length} ramps used. Use 5-9: two or three for the base, two or three for the hero, one glow accent, one for dressing.`);
if (sc.rampNames.length > 12) Wn(`${sc.rampNames.length} ramps is a lot; pieces read best with 5-9. Reuse ramps instead of adding new ones.`);
if (usedRamps[0].share > 0.62) P(`One colour dominates: ramp "${usedRamps[0].n}" covers ${(usedRamps[0].share * 100).toFixed(0)}% of the piece (limit 62%). Give the hero or the base a different ramp, or add supporting pieces in a contrasting ramp.`);
for (const r of big) if (r.steps >= 3 && r.tones < 2) Wn(`Ramp "${r.n}" shows only one tone, so that surface looks flat. This is normal for a flat top; if it is a round object, it is probably hidden from the light or too small.`);
const darkPct = (dark / filled) * 100, emisPct = (emis / filled) * 100;
if (darkPct > 55) P(`Too dark: ${darkPct.toFixed(0)}% of the piece is near-black (limit 55%). Swap one large dark ramp (ink, soil, slate, ash) for a lighter one, or add a glowing part with K.lightPool under it.`);
if (emisPct > 30) P(`Too much glow: ${emisPct.toFixed(0)}% of the piece is glowing (limit 30%). Glow works as an accent. Make the largest glowing part non-glowing.`);
if (emisPct < 0.3) Wn('Nothing glows. One small glowing accent (K.lantern, K.flame, a glow: true mushroom or crystal, or glowing K.motes) lifts almost every piece.');
const sol = avg(solidity), ff = avg(fillFr) * 100;
if (sol > 0.93) P(`Silhouette is a plain blob (solidity ${sol.toFixed(3)}; must be 0.930 or less). Add something that sticks out: one tall element, an overhang, hanging roots or drips, or pieces of clearly different heights.`);
if (ff < 9) Wn(`The piece fills only ${ff.toFixed(0)}% of the frame (normal is 14-40%). Make the main parts larger.`);
for (let p = 1; p < sc.parts.length; p++) {
  const isMote = !Array.from(solid.part).includes(p);
  if (isMote) continue;
  if (partBest[p] < 12) P(`Part "${sc.parts[p]}" cannot be seen (at most ${partBest[p]} pixels from any side). It is buried inside something or far too small. Move it to open ground or make it at least 0.08 across.`);
}

// ---------- outputs ----------
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function blit(dst, dw, src, sw, sh, ox, oy, up) {
  for (let y = 0; y < sh * up; y++) for (let x = 0; x < sw * up; x++) {
    const s = ((y / up | 0) * sw + (x / up | 0)) * 4, d = ((oy + y) * dw + ox + x) * 4;
    dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; dst[d + 3] = src[s + 3];
  }
}
// contact sheet: 4 views, upscaled, on the background colour
{
  const up = 3, yaws = [0.5, 2.0, 3.6, 5.2], w = 192 * up * 4, h = 192 * up, img = new Uint8ClampedArray(w * h * 4);
  yaws.forEach((yaw, c) => blit(img, w, R.draw(sc, cam(yaw, 192), 3 + c * 1.3), 192, 192, c * 192 * up, 0, up));
  fs.writeFileSync(path.join(outDir, 'sheet.png'), png(w, h, img));
}
// sprite grid: columns = directions, rows = animation frames, transparent background
{
  const Rs = new L.Renderer(RES, RES), w = RES * DIRS, h = RES * FRAMES, img = new Uint8ClampedArray(w * h * 4);
  const scl = FRAMES > 1 ? Object.assign({}, sc, { loop: LOOP }) : sc;
  for (let f = 0; f < FRAMES; f++) for (let d = 0; d < DIRS; d++)
    blit(img, w, Rs.draw(scl, cam((d / DIRS) * Math.PI * 2, RES), FRAMES > 1 ? (f / FRAMES) * LOOP : 3, { alpha: true }), RES, RES, d * RES, f * RES, 1);
  fs.writeFileSync(path.join(outDir, 'sprites.png'), png(w, h, img));
  fs.writeFileSync(path.join(outDir, 'sprites.json'), JSON.stringify({
    name: sc.name, image: 'sprites.png', cell: [RES, RES], columns: DIRS, rows: FRAMES,
    columnMeaning: 'camera yaw in degrees, clockwise seen from above, 0 = front (+z)', yawDegrees: Array.from({ length: DIRS }, (_, d) => (d * 360) / DIRS),
    rowMeaning: FRAMES > 1 ? `animation frame; ${FRAMES} frames loop seamlessly over ${LOOP} seconds` : 'single still frame',
    pitchDegrees: +(PITCH * 180 / Math.PI).toFixed(1), pixelsPerUnit: +scaleFor(RES).toFixed(2), background: sc.bg,
  }, null, 2));
}
// standard 3D gaussian splat .ply (soft-edged in ordinary viewers; colours baked from the fixed key light)
{
  const [LX, LY, LZ] = L.LIGHT, n = sc.N, rec = 17 * 4, buf = Buffer.alloc(n * rec), C0 = 0.28209479;
  for (let i = 0; i < n; i++) {
    const o = i * K, f = D[o + 14], ramp = sc.ramps[D[o + 12]], len = ramp.length / 3;
    let v = f & E ? D[o + 13] : f & L.LIT ? (0.5 + 0.5 * (D[o + 9] * LX + D[o + 10] * LY + D[o + 11] * LZ)) * 0.92 + D[o + 13] : 0.5 + D[o + 13];
    const idx = Math.max(0, Math.min(len - 1, Math.floor(v * len)));
    const u = [sc.X[i * 5], sc.X[i * 5 + 1], sc.X[i * 5 + 2]], s1 = sc.X[i * 5 + 3] / 1.8, s2 = sc.X[i * 5 + 4] / 1.8;
    // quaternion taking +x to u
    let q; const d = u[0];
    if (d < -0.99999) q = [0, 0, 1, 0]; else { const w = 1 + d, l = Math.hypot(w, u[2], u[1]); q = [w / l, 0, -u[2] / l, u[1] / l]; }
    const vals = [D[o], D[o + 1], D[o + 2], D[o + 9], D[o + 10], D[o + 11],
      (ramp[idx * 3] / 255 - 0.5) / C0, (ramp[idx * 3 + 1] / 255 - 0.5) / C0, (ramp[idx * 3 + 2] / 255 - 0.5) / C0, 8,
      Math.log(s1), Math.log(s2), Math.log(s2), q[0], q[1], q[2], q[3]];
    vals.forEach((x, j) => buf.writeFloatLE(x, i * rec + j * 4));
  }
  const props = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
  const head = 'ply\nformat binary_little_endian 1.0\nelement vertex ' + n + '\n' + props.map((p) => 'property float ' + p).join('\n') + '\nend_header\n';
  fs.writeFileSync(path.join(outDir, slug + '.ply'), Buffer.concat([Buffer.from(head), buf]));
}
// self-contained turntable page
{
  const tpl = fs.readFileSync(path.join(__dirname, 'viewer.template.html'), 'utf8');
  const data = { name: sc.name, N: sc.N, bg: sc.bg, cy: sc.cy, bob: sc.bob, glow: sc.glow, drift: sc.drift, rampNames: sc.rampNames,
    ramps: sc.ramps.map((r) => Array.from(r)), D: Buffer.from(D.buffer, D.byteOffset, D.byteLength).toString('base64') };
  fs.writeFileSync(path.join(outDir, 'viewer.html'), tpl.replace('/*CORE*/', () => fs.readFileSync(path.join(__dirname, '../lib/core.js'), 'utf8')).replace('/*DATA*/', () => JSON.stringify(data)));
}

// ---------- rig (only when the scene has bones) ----------
const rigOut = sc.bones && sc.bones.length ? require('./rigcheck.js')(sc, { problems, warnings, outDir, png, cam, PITCH }) : null;

// ---------- report ----------
const out = [];
out.push(`RESULT: ${problems.length ? 'FIX ' + problems.length + ' PROBLEM' + (problems.length > 1 ? 'S' : '') : 'PASS'}   (${sc.name}, ${sc.N} splats, ${sc.rampNames.length} ramps)`);
if (problems.length) { out.push('', 'PROBLEMS - fix every one, then run again:'); problems.forEach((p, i) => out.push(`  ${i + 1}. ${p}`)); }
if (warnings.length) { out.push('', 'WARNINGS - fix if you can do so simply:'); warnings.forEach((p) => out.push(`  - ${p}`)); }
out.push('', 'MEASUREMENTS', `  frame fill ${ff.toFixed(0)}% (14-40 normal) | reach ${Xmax.toFixed(2)} wide, ${(Yhalf * 2).toFixed(2)} tall | silhouette solidity ${sol.toFixed(3)} (0.930 or less) | dark ${darkPct.toFixed(0)}% | glow ${emisPct.toFixed(1)}% | pinholes ${holePct.toFixed(2)}%`);
if (rigOut) rigOut.lines.forEach((l) => out.push(l));
out.push('', 'PARTS (letter, name, splats, share of visible pixels)');
for (let p = 0; p < sc.parts.length; p++) {
  const n = sc.part.reduce((s, x) => s + (x === p), 0); if (!n) continue;
  out.push(`  ${p === 0 ? '?' : String.fromCharCode(96 + Math.min(26, p))}  ${sc.parts[p].padEnd(18)} ${String(n).padStart(6)}  ${((partPx[p] / filled) * 100).toFixed(1).padStart(5)}%`);
}
out.push('', 'RAMPS (name, share of piece, tones seen / tones available)');
usedRamps.forEach((r) => out.push(`  ${r.n.padEnd(12)} ${(r.share * 100).toFixed(1).padStart(5)}%   ${r.tones}/${r.steps}`));
for (const a of ascii) { out.push('', 'PICTURE - ' + a.title + ' (each letter is the part listed above; "." is empty)'); a.lines.forEach((l) => out.push('  ' + l)); }
out.push('', 'FILES', `  ${outDir}/sheet.png     four views for looking at`, `  ${outDir}/sprites.png   ${DIRS} directions x ${FRAMES} frame(s), ${RES}px cells, transparent`, `  ${outDir}/sprites.json  layout of sprites.png`, `  ${outDir}/${slug}.ply   3D gaussian splat file`, `  ${outDir}/viewer.html   turntable page`);
if (rigOut) rigOut.files.forEach((l) => out.push(l));
const text = out.join('\n');
fs.writeFileSync(path.join(outDir, 'report.txt'), text + '\n');
console.log(text);
process.exit(problems.length ? 1 : 0);
