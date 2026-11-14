// Prefab parts. Every function takes the builder `b` first and has working defaults,
// so `K.pine(b, [x, y, z])` alone is valid. Bases return { topY(x, z) } so you can
// stand things on them.
const S = require('./core.js');
const { TAU, E, WAVE, DRIFT } = S;
const K = {};

// ---------- bases (pick exactly one) ----------

// Floating clod of earth with a grassy crown and hanging roots.
K.floatingIsland = function (b, o) {
  o = o || {};
  const r = b.r, R = o.r || 0.78, y = o.y != null ? o.y : -0.32, top = o.top || 'grass', under = o.under || 'soil';
  const rootRamp = o.rootRamp || under, depth = o.depth || 0.5;
  b.ellipsoid([0, y, 0], [R, 0.17, R], top, { keep: (u) => u[1] > -0.25, rough: 0.05 });
  b.ellipsoid([0, y - 0.04, 0], [R * 0.95, depth, R * 0.95], under, { keep: (u) => u[1] < 0.02, rough: 0.12, s: 0.06 });
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU, d = R * (0.3 + r() * 0.5);
    b.ellipsoid([Math.cos(a) * d, y - 0.18 - r() * 0.15, Math.sin(a) * d], 0.1 + r() * 0.1, under, { keep: (u) => u[1] < 0.3, bias: 0.12 });
  }
  const nRoots = o.roots != null ? o.roots : 11;
  for (let i = 0; i < nRoots; i++) {
    const a = (i / nRoots) * TAU + r() * 0.4, d = R * (0.15 + r() * 0.62);
    const x = Math.cos(a) * d, z = Math.sin(a) * d, y0 = y - 0.04 - depth * Math.sqrt(Math.max(0, 1 - (d * d) / (R * R * 0.9))) + 0.04;
    const L = 0.16 + r() * 0.3, w = 0.03 + r() * 0.025;
    b.tube([[x, y0, z], [x + (r() - 0.5) * 0.05, y0 - L * 0.5, z + (r() - 0.5) * 0.05], [x + (r() - 0.5) * 0.08, y0 - L, z + (r() - 0.5) * 0.08]], w, 0.008, rootRamp, { s: 0.03 });
  }
  if (o.rim !== false) for (let i = 0; i < 26; i++) { // growth hanging over the rim
    const a = r() * TAU, x = Math.cos(a) * R * 0.97, z = Math.sin(a) * R * 0.97;
    b.stroke([x, y - 0.02, z], [Math.cos(a) * 0.15, -1, Math.sin(a) * 0.15], 0.04 + r() * 0.07, 0.02, top, { n: [Math.cos(a), 0.3, Math.sin(a)], bias: -0.1 });
  }
  return { R, topY: (x, z) => y + 0.17 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (R * R))) };
};

// Lumpy rock outcrop. cap: ramp name for a snow/moss/sand blanket on top, or null for bare rock.
K.rockOutcrop = function (b, o) {
  o = o || {};
  const r = b.r, rx = o.rx || 0.86, rz = o.rz || 0.72, y = o.y != null ? o.y : -0.56, rock = o.rock || 'slate';
  const cap = o.cap === undefined ? 'snow' : o.cap;
  b.ellipsoid([0, y, 0], [rx, 0.4, rz], rock, { rough: 0.14, s: 0.06, keep: (u) => u[1] < 0.5 });
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU;
    b.ellipsoid([Math.cos(a) * rx * 0.72, y - 0.06 - r() * 0.12, Math.sin(a) * rz * 0.7], [0.2 + r() * 0.12, 0.16 + r() * 0.12, 0.2 + r() * 0.1], rock, { rough: 0.1, bias: (r() - 0.5) * 0.2 });
  }
  const cx = rx * 0.93, cz = rz * 0.92;
  b.ellipsoid([0, y + 0.16, 0], [cx, 0.22, cz], cap || rock, { keep: (u) => u[1] > 0.02, rough: 0.05, bias: cap ? 0 : 0.1 });
  if (cap && o.drips !== false) for (let i = 0; i < 16; i++) {
    const a = r() * TAU, x = Math.cos(a) * cx, z = Math.sin(a) * cz;
    b.stroke([x, y + 0.14, z], [0, -1, 0], 0.04 + r() * 0.08, 0.016, cap, { n: [Math.cos(a), 0.2, Math.sin(a)], bias: 0.1 });
  }
  return { rx: cx, rz: cz, topY: (x, z) => y + 0.16 + 0.22 * Math.sqrt(Math.max(0, 1 - (x * x) / (cx * cx) - (z * z) / (cz * cz))) };
};

// Sand bar in a ring of animated water.
K.sandbar = function (b, o) {
  o = o || {};
  const R = o.r || 0.74, y = o.y != null ? o.y : -0.62, sand = o.sand || 'sand', water = o.water || 'water', foam = o.foam || 'foam';
  b.fill([0, y + 0.05, 0], [0, 1, 0], o.waterR || 1.12, water, { f: WAVE, s: 0.06, cov: 1.5, jit: 0.3, bias: -0.32, th: 0.5, edge: (a) => 0.84 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7) });
  b.ellipsoid([0, y, 0], [R, 0.2, R * 0.95], sand, { keep: (u) => u[1] > -0.3, rough: 0.06 });
  if (foam) b.torus([0, y + 0.065, 0], [0, 1, 0], R * 0.97, 0.018, foam, { s: 0.028, f: WAVE, cov: 1.1, jit: 0.4 });
  const rz = R * 0.95;
  return { R, topY: (x, z) => y + 0.2 * Math.sqrt(Math.max(0, 1 - (x * x) / (R * R) - (z * z) / (rz * rz))) };
};

// Round stone slab, optionally with drips of a (usually glowing) ramp running off the edge.
K.slab = function (b, o) {
  o = o || {};
  const r = b.r, R = o.r || 0.7, y = o.y != null ? o.y : -0.3, h = o.h || 0.14, top = o.top || 'stone', side = o.side || 'slate';
  b.cyl([0, y - h, 0], [0, y, 0], R * 0.94, R, side, {});
  b.fill([0, y, 0], [0, 1, 0], R, top, { rough: 0.02 });
  b.fill([0, y - h, 0], [0, -1, 0], R * 0.94, side, { bias: -0.1 });
  if (o.drips) for (let i = 0; i < (o.nDrips || 14); i++) {
    const a = r() * TAU, x = Math.cos(a) * R, z = Math.sin(a) * R, L = 0.1 + r() * 0.3;
    b.tube([[x, y, z], [x, y - L * 0.6, z], [x, y - L, z]], 0.03, 0.01, o.drips, { f: o.dripGlow ? E : 0, s: 0.025 });
  }
  return { R, topY: () => y };
};

// ---------- props ----------

K.boulder = function (b, p, o) {
  o = o || {};
  const s = o.r || 0.2;
  b.ellipsoid(p, [s, s * 0.85, s * 0.9], o.rock || 'slate', { rough: 0.1, bias: 0.05 });
  if (o.cap) b.ellipsoid([p[0], p[1] + s * 0.12, p[2]], [s * 0.98, s * 0.85, s * 0.9], o.cap, { keep: (u) => u[1] > 0.35 });
};

// Mushroom. p is the foot of the stem. glow: true makes the whole cap emissive.
K.mushroom = function (b, p, o) {
  o = o || {};
  const r = b.r, h = o.h || 0.3, cr = o.r || h * 0.55, sw = o.stemW || cr * 0.28;
  const lean = o.lean != null ? o.lean : (r() - 0.5) * 0.25 * h, x = p[0], y = p[1], z = p[2];
  b.tube([[x, y, z], [x + lean, y + h * 0.33, z + lean * 0.5], [x + lean, y + h * 0.66, z], [x, y + h, z - lean * 0.3]], sw, sw * 0.65, o.stem || (o.glow ? 'reed' : 'bone'));
  const c = [x, y + h - cr * 0.1, z - lean * 0.3], R = [cr, cr * (o.dome || 0.68), cr];
  if (o.glow) { b.ellipsoid(c, R, o.cap || 'aqua', { keep: (u) => u[1] > -0.1, f: E }); return { top: [c[0], c[1] + R[1], c[2]] }; }
  b.ellipsoid(c, R, o.cap || 'cap', { keep: (u) => u[1] > -0.08 });
  b.fill([c[0], c[1] - 0.02, c[2]], [0, -1, 0], cr * 0.94, o.gill || 'peach', { f: E, s: Math.min(0.04, cr * 0.3), hole: sw * 0.6 });
  const nSpots = o.spots != null ? o.spots : Math.round(cr * 22);
  for (let i = 0; i < nSpots; i++) {
    const yy = 0.2 + r() * 0.75, rad = Math.sqrt(1 - yy * yy), a = r() * TAU, u = [Math.cos(a) * rad, yy, Math.sin(a) * rad];
    b.fill([c[0] + u[0] * R[0] * 1.03, c[1] + u[1] * R[1] * 1.03, c[2] + u[2] * R[2] * 1.03], [u[0] / R[0], u[1] / R[1], u[2] / R[2]], cr * (0.07 + r() * 0.09), o.spot || 'cream', { s: Math.max(0.014, cr * 0.05), cov: 2.4 });
  }
  return { top: [c[0], c[1] + R[1], c[2]] };
};

// Conifer. k scales the whole tree (1 = about 0.86 tall). snow: ramp name or null.
K.pine = function (b, p, o) {
  o = o || {};
  const r = b.r, k = o.k || 1, x = p[0], y = p[1], z = p[2], leaf = o.leaf || 'pine';
  b.cyl([x, y, z], [x, y + 0.22 * k, z], 0.035 * k, 0.03 * k, o.wood || 'bark', { s: 0.025 });
  for (const [y0, y1, rad] of [[0.16, 0.5, 0.25], [0.36, 0.68, 0.19], [0.54, 0.86, 0.13]]) {
    b.cyl([x, y + y0 * k, z], [x, y + y1 * k, z], rad * k, 0.005, leaf, { s: 0.035 });
    b.fill([x, y + y0 * k, z], [0, -1, 0], rad * k, leaf, { s: 0.035, bias: -0.1 });
    if (o.snow) for (let i = 0; i < 12; i++) {
      const t = 0.05 + r() * 0.55, a = r() * TAU, rr = rad * k * (1 - t);
      b.dab([x + Math.cos(a) * rr, y + (y0 + (y1 - y0) * t) * k + 0.012, z + Math.sin(a) * rr], [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5], o.snow, { s: 0.035, bias: 0.1 });
    }
  }
};

// Broadleaf tree: bent trunk and a clumped canopy. h is total height.
K.tree = function (b, p, o) {
  o = o || {};
  const r = b.r, h = o.h || 0.7, cr = o.r || h * 0.38, x = p[0], y = p[1], z = p[2], lx = (r() - 0.5) * 0.12, lz = (r() - 0.5) * 0.12;
  b.tube([[x, y, z], [x + lx, y + h * 0.3, z + lz], [x + lx * 0.4, y + h * 0.62, z + lz * 0.4]], h * 0.075, h * 0.045, o.wood || 'bark');
  const c = [x + lx * 0.4, y + h * 0.72, z + lz * 0.4];
  b.ellipsoid(c, [cr, cr * 0.8, cr], o.leaf || 'leaf', { rough: 0.12 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + r(), d = cr * 0.62;
    b.ellipsoid([c[0] + Math.cos(a) * d, c[1] + (r() - 0.4) * cr * 0.6, c[2] + Math.sin(a) * d], cr * (0.45 + r() * 0.2), o.leaf || 'leaf', { rough: 0.12, bias: (r() - 0.5) * 0.15 });
  }
  return { top: [c[0], c[1] + cr * 0.8, c[2]] };
};

// Pointed crystal. glow: true for emissive.
K.crystal = function (b, p, o) {
  o = o || {};
  const h = o.h || 0.4, rr = o.r || h * 0.2, f = o.glow ? E : 0, ramp = o.ramp || (o.glow ? 'violet' : 'ice');
  b.at(p, o.ry || 0, o.lean || 0, o.leanZ || 0, () => {
    b.cyl([0, 0, 0], [0, h * 0.7, 0], rr, rr * 0.85, ramp, { f, s: Math.max(0.014, rr * 0.4) });
    b.cyl([0, h * 0.7, 0], [0, h, 0], rr * 0.85, 0.004, ramp, { f, s: Math.max(0.014, rr * 0.4) });
  });
};

// Flame or wisp: an emissive teardrop that flickers.
K.flame = function (b, p, o) {
  o = o || {};
  const h = o.h || 0.14, ramp = o.ramp || 'ember', n = 6;
  for (let i = 0; i < n; i++) { // stacked blobs: wide and bright at the bottom, thin and red at the tip
    const t = i / (n - 1), rr = h * (0.3 - 0.24 * t), y = p[1] + h * (0.22 + 0.72 * t);
    b.ellipsoid([p[0] + Math.sin(i * 2.1) * h * 0.05 * t, y, p[2] + Math.cos(i * 1.7) * h * 0.05 * t], [rr, rr * 1.35, rr], ramp, { f: E | WAVE, v: 0.86 - 0.62 * t, s: Math.max(0.012, rr * 0.45) });
  }
};

// Eyeball with pupil and highlight. look: direction the eye faces (default +z, the front).
K.eye = function (b, p, o) {
  o = o || {};
  const rr = o.r || 0.05, d = S.norm(o.look || [0, 0, 1]);
  b.ellipsoid(p, rr, o.white || 'white', { s: Math.max(0.012, rr * 0.5), bias: 0.3 });
  b.ellipsoid([p[0] + d[0] * rr * 0.7, p[1] + d[1] * rr * 0.7 + rr * 0.08, p[2] + d[2] * rr * 0.7], rr * 0.55, o.pupil || 'ink', { s: Math.max(0.012, rr * 0.35) });
  b.mote([p[0] + d[0] * rr * 1.25 - rr * 0.15, p[1] + d[1] * rr * 1.25 + rr * 0.35, p[2] + d[2] * rr * 1.25], Math.max(0.006, rr * 0.16), o.white || 'white', { bias: 0.5, jit: 0 });
};

// ---------- dressing ----------

// Upright blades scattered on a base. topY comes from the base you built.
K.tufts = function (b, topY, o) {
  o = o || {};
  const r = b.r, n = o.n || 90, R = o.r || 0.7, len = o.len || 0.05;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.stroke([x, topY(x, z), z], [(r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6], len * (0.6 + r() * 0.8), o.w || 0.014, o.ramp || 'grass', { bias: 0.08 + r() * 0.2 });
  }
};

// A clump of tall wavy blades (seaweed, reeds) at one spot.
K.reeds = function (b, p, o) {
  o = o || {};
  const r = b.r, n = o.n || 7, h = o.h || 0.11;
  for (let i = 0; i < n; i++) {
    const dx = (r() - 0.5) * 0.5, dz = (r() - 0.5) * 0.5, L = h * (0.4 + r() * 0.5) / 2;
    b.stroke([p[0] + dx * 0.1, p[1], p[2] + dz * 0.1], [dx * 0.4, 1, dz * 0.4], L, 0.016, o.ramp || 'leaf', { bias: -0.05 });
    b.stroke([p[0] + dx * 0.1 + dx * 0.8 * L, p[1] + 2 * L, p[2] + dz * 0.1 + dz * 0.8 * L], [dx, 1, dz], L, 0.014, o.ramp || 'leaf', { bias: 0.15 });
  }
};

// Small stones or shells scattered on a base.
K.pebbles = function (b, topY, o) {
  o = o || {};
  const r = b.r, n = o.n || 7, ramps = o.ramps || ['stone'], r0 = o.rmin || 0.35, r1 = o.rmax || 0.65;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r0 + r() * (r1 - r0), x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.ellipsoid([x, topY(x, z), z], [0.03 + r() * 0.03, 0.02 + r() * 0.02, 0.03 + r() * 0.03], ramps[i % ramps.length], { s: 0.022 });
  }
};

// Drifting particles around the piece (spores, snow, bubbles, embers).
// glow: true = emissive. Direction and speed are set in the scene's meta.drift.
K.motes = function (b, o) {
  o = o || {};
  const r = b.r, n = o.n || 45, r0 = o.rmin || 0.15, r1 = o.rmax || 1.0, y = o.y != null ? o.y : 0.15, size = o.size || 0.011;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r0 + Math.sqrt(r()) * (r1 - r0);
    const opt = o.glow ? { f: E | DRIFT, v: 0.3 + r() * 0.7 } : { f: DRIFT, bias: (r() - 0.5) * 0.9, jit: 0 };
    b.mote([Math.cos(a) * d, y + (r() - 0.5) * 0.3, Math.sin(a) * d], size * (0.8 + r()), o.ramp || 'white', opt);
  }
};

// ---------- structures ----------

// Two-post gate with a double lintel (torii style). p is the ground point midway between the posts.
// The gate faces +z. w = half the distance between posts, h = height of the top beam.
K.gate = function (b, p, o) {
  o = o || {};
  const r = b.r, w = o.w || 0.42, h = o.h || 0.82, post = o.post || 'lacquer', roof = o.roof || 'ink', o3 = { s: 0.03 };
  b.at(p, o.ry || 0, 0, 0, () => {
    for (const sx of [-1, 1]) {
      b.cyl([sx * w, 0, 0], [sx * w * 0.93, h, 0], 0.058, 0.046, post, o3);
      b.cyl([sx * w, -0.02, 0], [sx * w, 0.1, 0], 0.074, 0.07, roof, { s: 0.03, cap: 1 });
      if (o.cap) b.ellipsoid([sx * w, 0, 0], [0.13, 0.05, 0.13], o.cap, { keep: (u) => u[1] > 0, s: 0.03 });
    }
    b.box([0, h * 0.68, 0], [w * 1.29, 0.036, 0.034], post, o3);
    b.box([0, h * 0.84, 0], [0.032, h * 0.116, 0.03], post, o3);
    b.box([0, h, 0], [w * 1.43, 0.042, 0.055], post, o3);
    b.box([0, h + 0.065, 0], [w * 1.48, 0.028, 0.075], roof, o3);
    for (const sx of [-1, 1]) b.at([sx * w * 1.43, h + 0.065, 0], 0, 0, sx * 0.3, () => {
      b.box([sx * 0.11, 0, 0], [0.12, 0.028, 0.075], roof, o3);
      b.box([sx * 0.1, -0.06, 0], [0.11, 0.036, 0.055], post, o3);
    });
    if (o.cap) for (let i = 0; i < 9; i++) b.ellipsoid([-w * 1.2 + i * w * 0.3 + (r() - 0.5) * 0.04, h + 0.095, (r() - 0.5) * 0.03], [0.09, 0.03 + r() * 0.02, 0.075], o.cap, { keep: (u) => u[1] > -0.1, s: 0.03 });
  });
  return { hang: [p[0], p[1] + h * 0.68 - 0.03, p[2]] }; // a good point to hang a lantern from
};

// Box lantern hanging from point p on a short cord. The glass glows.
K.lantern = function (b, p, o) {
  o = o || {};
  const k = o.k || 1, x = p[0], y = p[1], z = p[2], frame = o.frame || 'ink';
  b.cyl([x, y, z], [x, y - 0.13 * k, z], 0.01, 0.01, frame, { s: 0.014 });
  b.box([x, y - 0.115 * k, z], [0.09 * k, 0.016 * k, 0.09 * k], frame, { s: 0.025 });
  b.box([x, y - 0.2 * k, z], [0.066 * k, 0.07 * k, 0.066 * k], o.light || 'lamp', { f: E, s: 0.025 });
  b.box([x, y - 0.28 * k, z], [0.05 * k, 0.012 * k, 0.05 * k], frame, { s: 0.025 });
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl([x + cx * 0.066 * k, y - 0.27 * k, z + cz * 0.066 * k], [x + cx * 0.066 * k, y - 0.13 * k, z + cz * 0.066 * k], 0.012, 0.012, frame, { s: 0.013 });
  if (o.tassel) b.stroke([x, y - 0.29 * k, z], [0, -1, 0], 0.035 * k, 0.012, o.tassel, {});
};

// A patch of ground coloured as if lit by a lamp above it. Put it just above the base surface.
K.lightPool = function (b, p, o) {
  o = o || {};
  b.fill(p, [0, 1, 0], o.r || 0.24, o.ramp || 'candlelit', { s: 0.04, bias: 0.05, edge: (a) => 0.8 + 0.2 * Math.sin(a * 5) });
};

// Stone steps descending toward +z, starting at p (centre of the top step).
K.steps = function (b, p, o) {
  o = o || {};
  const n = o.n || 3, w = o.w || 0.2, ramp = o.ramp || 'stone';
  for (let i = 0; i < n; i++) b.box([p[0], p[1] - i * 0.075, p[2] + i * 0.135], [w + i * 0.03, 0.03 + i * 0.005, 0.075], ramp, { s: 0.035 });
  if (o.footing !== false) b.ellipsoid([p[0], p[1] - n * 0.075 - 0.07, p[2] + (n - 1) * 0.1], [w + 0.16, 0.18, 0.2], o.footing || 'slate', { rough: 0.1 });
};

// Fluted column on a plinth. broken: true snaps the top off at an angle and drops a chunk beside it.
K.column = function (b, p, o) {
  o = o || {};
  const h = o.h || 0.6, rr = o.r || 0.07, ramp = o.ramp || 'stone', x = p[0], y = p[1], z = p[2];
  b.box([x, y + 0.025, z], [rr * 1.5, 0.025, rr * 1.5], ramp, { s: 0.03 });
  b.cyl([x, y + 0.05, z], [x, y + h, z], rr, rr * 0.88, ramp, { cap: 1 });
  if (o.broken) {
    b.at([x + rr * 3, y + rr * 0.8, z + rr * 1.5], 0.7, 0, 1.45, () => b.cyl([0, -h * 0.12, 0], [0, h * 0.12, 0], rr * 0.88, rr * 0.85, ramp, { cap: 2 }));
  } else {
    b.box([x, y + h + 0.02, z], [rr * 1.45, 0.02, rr * 1.45], ramp, { s: 0.03 });
    b.box([x, y + h + 0.055, z], [rr * 1.7, 0.02, rr * 1.7], ramp, { s: 0.03 });
  }
  return { top: [x, y + h + (o.broken ? 0 : 0.075), z] };
};

// Hanging vine from a to c that sags in the middle, with leaves along it.
K.vine = function (b, a, c, o) {
  o = o || {};
  const r = b.r, n = 8, sag = o.sag != null ? o.sag : 0.12, ramp = o.ramp || 'leaf', pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]);
  }
  b.tube(pts, 0.012, 0.012, ramp, { s: 0.014, bias: -0.15 });
  for (let i = 1; i < n; i++) for (let k = 0; k < 2; k++) {
    const q = pts[i];
    b.ellipsoid([q[0] + (r() - 0.5) * 0.05, q[1] - 0.01 - r() * 0.03, q[2] + (r() - 0.5) * 0.05], [0.03, 0.012, 0.022], ramp, { s: 0.016, bias: r() * 0.2 });
  }
};

// Spiral shell (conch) about 0.9 tall, built at the origin with the opening at the bottom.
// Wrap in b.at(position, ry, rx, rz, () => K.spiralShell(b)) to place and tilt it.
K.spiralShell = function (b, o) {
  o = o || {};
  const n = 58, k0 = o.k || 1, main = o.ramp || 'shell', band = o.band || 'sea';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), a = t * TAU * 3.1 + 1.2, k = Math.pow(1 - t, 1.15);
    const Rc = 0.17 * k * k0, rs = (0.25 * k + 0.02) * k0, y = (0.08 + 0.72 * (1 - Math.pow(1 - t, 1.5))) * k0;
    b.ellipsoid([Math.cos(a) * Rc, y, Math.sin(a) * Rc], [rs, rs * 0.82, rs], i % 7 < 5 ? main : band, { cov: 1.0, s: 0.042, bias: 0.04 * Math.sin(i * 1.7) });
  }
  if (o.knobs !== false) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    b.ellipsoid([Math.cos(a) * 0.36 * k0, 0.2 * k0, Math.sin(a) * 0.36 * k0], [0.05 * k0, 0.06 * k0, 0.05 * k0], o.knob || 'pearl', { s: 0.03 });
  }
};

module.exports = K;
