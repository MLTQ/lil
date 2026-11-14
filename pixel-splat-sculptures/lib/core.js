// Pixel-splat core: build sculptures out of anisotropic 3D gaussians (hard-thresholded
// ellipsoids), render them orthographically at low resolution with palette-ramp shading.
(function (root) {
  const TAU = Math.PI * 2, GA = 2.399963229728653;
  const E = 1, WAVE = 2, DRIFT = 4, LIT = 8;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function perp(d) {
    const h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = norm(cross(d, h));
    return [e1, cross(d, e1)];
  }
  const mulM = (A, B) => {
    const C = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return C;
  };
  const mulV = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
  function rotM(ry, rx, rz) {
    const cy = Math.cos(ry || 0), sy = Math.sin(ry || 0), cx = Math.cos(rx || 0), sx = Math.sin(rx || 0), cz = Math.cos(rz || 0), sz = Math.sin(rz || 0);
    const Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], X = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
    return mulM(Y, mulM(X, Z));
  }

  function Builder(seed, ramps) {
    this.r = rng(seed || 1);
    this.S = [];
    this.X = [];
    this.lib = ramps;      // every ramp that may be used, by name
    this.rampNames = [];   // ramps actually used, in first-use order
    this.ramps = [];
    this.parts = ['(unnamed)'];
    this.cur = 0;
    this.Pt = [];
    this.bones = [];       // skeleton: { name, pivot, parent, ... }
    this.curBone = 255;    // 255 = not bound to any bone (static)
    this.Bn = [];
    this.R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.T = [0, 0, 0];
    this.s = 0.05; // default splat radius, world units
  }
  const P = Builder.prototype;

  // Raw splat: ellipsoid with radius s1 along axis u and s2 across it.
  P.add = function (p, u, s1, s2, n, ramp, o) {
    o = o || {};
    const R = this.R, T = this.T;
    const q = mulV(R, p), uu = norm(mulV(R, u));
    const d = s1 * s1 - s2 * s2, b = s2 * s2;
    let f = o.f || 0, nn = [0, 0, 0];
    if (n) { nn = norm(mulV(R, n)); f |= LIT; }
    const jit = f & E ? (o.v != null ? o.v : this.r()) : (o.bias || 0) + (this.r() - 0.5) * 2 * (o.jit != null ? o.jit : 0.13);
    let ri = this.rampNames.indexOf(ramp);
    if (ri < 0) {
      if (!this.lib[ramp]) throw new Error('Unknown ramp "' + ramp + '". Use one of: ' + Object.keys(this.lib).join(', '));
      ri = this.rampNames.push(ramp) - 1;
      this.ramps.push(this.lib[ramp].map(hex));
    }
    if (![q[0], q[1], q[2], s1, s2, uu[0], uu[1], uu[2]].every(Number.isFinite) || s1 <= 0 || s2 <= 0)
      throw new Error('A part was given a position or size that is not a positive, finite number. Check the arguments on the scene line named below.');
    this.Pt.push(this.cur);
    this.Bn.push(this.curBone);
    this.X.push([uu[0], uu[1], uu[2], s1, s2]);
    this.S.push([q[0] + T[0], q[1] + T[1], q[2] + T[2],
      b + d * uu[0] * uu[0], d * uu[0] * uu[1], d * uu[0] * uu[2], b + d * uu[1] * uu[1], d * uu[1] * uu[2], b + d * uu[2] * uu[2],
      nn[0], nn[1], nn[2], ri, jit, f, this.r() * TAU]);
  };
  // Flat disc facing n — the basic surface element.
  P.dab = function (p, n, ramp, o) {
    const s = ((o && o.s) || this.s) * (0.8 + 0.4 * this.r());
    this.add(p, n, s * ((o && o.th) || 0.35), s, n, ramp, o);
  };
  // Name the section you are about to build. The checker uses these names in its report.
  P.part = function (name) {
    let i = this.parts.indexOf(name);
    if (i < 0) i = this.parts.push(name) - 1;
    this.cur = i;
  };
  // Define a bone. pivot is the joint position (in the current b.at frame). parent is a bone name or null.
  // opts: blend (radius around the joint where splats blend with the neighbouring bone, default 0.04),
  //       stiff (spring rate, default 18), damp (1 = no overshoot; lower = wobble),
  //       jiggle: [dx, dy, dz] makes it a passive follow-through bone whose rest tip is pivot + that offset.
  P.bone = function (name, pivot, parent, opts) {
    const q = mulV(this.R, pivot), o = Object.assign({ blend: 0.04, stiff: 18, damp: 1 }, opts || {});
    const pi = parent == null ? -1 : this.bones.findIndex((x) => x.name === parent);
    if (parent != null && pi < 0) throw new Error('Bone "' + name + '" names a parent "' + parent + '" that is not defined yet. Define parents first.');
    if (o.jiggle) o.jiggle = mulV(this.R, o.jiggle);
    this.bones.push(Object.assign(o, { name, pivot: [q[0] + this.T[0], q[1] + this.T[1], q[2] + this.T[2]], parent: pi }));
  };
  // Everything built after this moves with the named bone. b.bind(null) goes back to static.
  P.bind = function (name) {
    if (name == null) { this.curBone = 255; return; }
    const i = this.bones.findIndex((x) => x.name === name);
    if (i < 0) throw new Error('Unknown bone "' + name + '". Define it with b.bone first.');
    this.curBone = i;
  };
  P.auto = function (o, r) {
    if (o.s) return o;
    const c = Object.assign({}, o);
    c.s = Math.max(0.012, Math.min(this.s, r * 0.45));
    return c;
  };
  P.count = function (area, o) {
    const s = (o && o.s) || this.s;
    return Math.max(1, Math.ceil(((o && o.cov) || 1.8) * area / (Math.PI * s * s)));
  };
  P.at = function (t, ry, rx, rz, fn) {
    const R0 = this.R, T0 = this.T;
    const tt = mulV(R0, t);
    this.T = [tt[0] + T0[0], tt[1] + T0[1], tt[2] + T0[2]];
    this.R = mulM(R0, rotM(ry, rx, rz));
    fn();
    this.R = R0; this.T = T0;
  };

  P.ellipsoid = function (c, r, ramp, o) {
    o = o || {};
    if (typeof r === 'number') r = [r, r, r];
    o = this.auto(o, Math.min(r[0], r[1], r[2]));
    const m = (r[0] + r[1] + r[2]) / 3, N = this.count(4 * Math.PI * m * m, o);
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, rad = Math.sqrt(1 - y * y), th = GA * i;
      const u = [Math.cos(th) * rad, y, Math.sin(th) * rad];
      if (o.keep && !o.keep(u)) continue;
      const k = 1 + (o.rough ? (this.r() - 0.5) * o.rough : 0);
      const p = [c[0] + u[0] * r[0] * k, c[1] + u[1] * r[1] * k, c[2] + u[2] * r[2] * k];
      this.dab(p, [u[0] / r[0], u[1] / r[1], u[2] / r[2]], o.pick ? o.pick(u, p) : ramp, o);
    }
  };
  P.fill = function (c, n, r, ramp, o) {
    o = o || {};
    n = norm(n);
    const [e1, e2] = perp(n), N = this.count(Math.PI * r * r, o);
    for (let i = 0; i < N; i++) {
      const a = GA * i;
      let rr = r * Math.sqrt((i + 0.5) / N);
      if (o.edge && rr > r * o.edge(a)) continue;
      if (o.hole && rr < o.hole) continue;
      const ca = Math.cos(a) * rr, sa = Math.sin(a) * rr;
      this.dab([c[0] + e1[0] * ca + e2[0] * sa, c[1] + e1[1] * ca + e2[1] * sa, c[2] + e1[2] * ca + e2[2] * sa], n, ramp, o);
    }
  };
  P.cyl = function (a, b, r0, r1, ramp, o) {
    o = o || {};
    const dv = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(dv[0], dv[1], dv[2]), d = norm(dv);
    o = this.auto(o, Math.max(r0, r1));
    const [e1, e2] = perp(d), N = Math.max(4, this.count(Math.PI * (r0 + r1) * L, o));
    for (let i = 0; i < N; i++) {
      const t = (i + this.r()) / N, ang = GA * i, rr = r0 + (r1 - r0) * t;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const n = [e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa, e1[2] * ca + e2[2] * sa];
      const sl = (r0 - r1) / L; // tilt normal along the taper
      this.dab([a[0] + dv[0] * t + n[0] * rr, a[1] + dv[1] * t + n[1] * rr, a[2] + dv[2] * t + n[2] * rr],
        [n[0] + d[0] * sl, n[1] + d[1] * sl, n[2] + d[2] * sl], o.pick ? o.pick(t, ang) : ramp, o);
    }
    if (o.cap) { this.fill(b, d, r1, o.capRamp || ramp, o); if (o.cap > 1) this.fill(a, [-d[0], -d[1], -d[2]], r0, o.capRamp || ramp, o); }
  };
  P.tube = function (pts, r0, r1, ramp, o) {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++)
      this.cyl(pts[i], pts[i + 1], r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, ramp, o);
  };
  P.box = function (c, h, ramp, o) {
    o = o || {};
    o = this.auto(o, Math.min(h[0], h[1], h[2]) * 1.2);
    const step = (o.s * 1.15);
    for (let ax = 0; ax < 3; ax++) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3;
      const nu = Math.max(1, Math.round((2 * h[u]) / step)), nv = Math.max(1, Math.round((2 * h[v]) / step));
      for (let sg = -1; sg <= 1; sg += 2) {
        const n = [0, 0, 0]; n[ax] = sg;
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const p = [c[0], c[1], c[2]];
          p[ax] += sg * h[ax];
          p[u] += -h[u] + ((i + 0.2 + 0.6 * this.r()) / nu) * 2 * h[u];
          p[v] += -h[v] + ((j + 0.2 + 0.6 * this.r()) / nv) * 2 * h[v];
          this.dab(p, n, ramp, o);
        }
      }
    }
  };
  P.torus = function (c, ax, R, r, ramp, o) {
    o = o || {};
    ax = norm(ax);
    o = this.auto(o, r * 0.9);
    const [e1, e2] = perp(ax), a0 = o.a0 || 0, a1 = o.a1 != null ? o.a1 : TAU;
    const N = this.count((a1 - a0) * R * TAU * r, o);
    for (let i = 0; i < N; i++) {
      const u = a0 + ((a1 - a0) * (i + this.r())) / N, v = GA * i;
      const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      const ring = [e1[0] * cu + e2[0] * su, e1[1] * cu + e2[1] * su, e1[2] * cu + e2[2] * su];
      const n = [ring[0] * cv + ax[0] * sv, ring[1] * cv + ax[1] * sv, ring[2] * cv + ax[2] * sv];
      this.dab([c[0] + ring[0] * R + n[0] * r, c[1] + ring[1] * R + n[1] * r, c[2] + ring[2] * R + n[2] * r], n, ramp, o);
    }
  };
  // Elongated brush stroke (grass blade, seaweed, icicle).
  P.stroke = function (p, dir, len, w, ramp, o) {
    dir = norm(dir);
    this.add([p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len], dir, len, w, (o && o.n) || [0, 1, 0], ramp, o);
  };
  // Round mote (spore, snowflake, bubble).
  P.mote = function (p, s, ramp, o) { this.add(p, [0, 1, 0], s, s, null, ramp, o); };

  P.pack = function (meta) {
    const N = this.S.length, K = 16, D = new Float32Array(N * K);
    for (let i = 0; i < N; i++) D.set(this.S[i], i * K);
    const ramps = this.ramps.map((r) => { const a = new Uint8Array(r.length * 3); r.forEach((c, i) => a.set(c, i * 3)); return a; });
    const X = new Float32Array(N * 5);
    for (let i = 0; i < N; i++) X.set(this.X[i], i * 5);
    // skin weights: each splat follows bone A fully, except near a joint where it blends with bone B
    const bA = Uint8Array.from(this.Bn), bB = Uint8Array.from(this.Bn), bW = new Float32Array(N).fill(1), bones = this.bones;
    for (let i = 0; i < N; i++) {
      const a = bA[i]; if (a === 255) continue;
      let best = 1;
      const tryJoint = (j, other) => {
        const r = bones[j].blend; if (!r || other < 0) return;
        const pv = bones[j].pivot, d = Math.hypot(D[i * K] - pv[0], D[i * K + 1] - pv[1], D[i * K + 2] - pv[2]) / r;
        if (d < best) { best = d; bB[i] = other; bW[i] = 0.5 + 0.5 * d; }
      };
      tryJoint(a, bones[a].parent);
      for (let c = 0; c < bones.length; c++) if (bones[c].parent === a) tryJoint(c, c);
    }
    return Object.assign({ N, D, X, bones, bA, bB, bW, part: Uint8Array.from(this.Pt), parts: this.parts, ramps, rampNames: this.rampNames, bg: [8, 8, 14], drift: { range: 1.6, speed: 0.05, dir: 1 }, bob: 0, cy: 0 }, meta);
  };

  function Renderer(W, H) {
    this.W = W; this.H = H;
    this.out = new Uint8ClampedArray(W * H * 4);
    this.zb = new Float32Array(W * H);
    this.fb = new Uint8Array(W * H);
    this.rb = new Uint8Array(W * H); // ramp index + 1 per pixel (0 = empty)
    this.tb = new Uint8Array(W * H); // tone index per pixel
    this.pb = new Uint8Array(W * H); // part index per pixel
    this.g = new Float32Array(W * H * 3);
    this.t = new Float32Array(W * H * 3);
  }
  const LX = -0.438, LY = 0.779, LZ = 0.449; // world key light

  // opts.alpha: leave empty pixels transparent (sprite export) instead of painting sc.bg
  Renderer.prototype.draw = function (sc, cam, time, opts) {
    const W = this.W, H = this.H, out = this.out, zb = this.zb, fb = this.fb, D = sc.D, K = 16;
    const alpha = opts && opts.alpha;
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const ax = cyw, az = -syw, bx = -syw * sp, by = cp, bz = -cyw * sp, kx = syw * cp, ky = sp, kz = cyw * cp;
    const s = cam.scale, s2 = s * s, ox = W / 2;
    const lp = sc.loop, fq = (w) => (lp ? (TAU * Math.max(1, Math.round((w * lp) / TAU))) / lp : w);
    const wBob = fq(1.3), wWave = fq(1.7), wSway = fq(0.9);
    const oy = H / 2 + (sc.cy || 0) * s * cp + (sc.bob ? Math.round(Math.sin(time * wBob) * sc.bob * s) : 0);
    const bg = sc.bg;
    for (let i = 0, n = W * H; i < n; i++) { out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = alpha ? 0 : 255; }
    zb.fill(-1e9); fb.fill(0); this.rb.fill(0);
    const rb = this.rb, tb = this.tb, pb = this.pb, part = sc.part;
    const dr = sc.drift, dSpeed = lp ? Math.max(1, Math.round(dr.speed * lp)) / lp : dr.speed;
    for (let i = 0; i < sc.N; i++) {
      const o = i * K, f = D[o + 14], ph = D[o + 15];
      let x = D[o], y = D[o + 1], z = D[o + 2];
      if (f & DRIFT) {
        let fr = (time * dSpeed + ph * 0.1592) % 1;
        y += (fr - 0.5) * dr.range * dr.dir;
        x += 0.04 * Math.sin(time * wSway + ph * 3);
      }
      const X = x * ax + z * az, Y = x * bx + y * by + z * bz, Z = x * kx + y * ky + z * kz;
      const px = ox + X * s, py = oy - Y * s;
      const xx = D[o + 3], xy = D[o + 4], xz = D[o + 5], yy = D[o + 6], yz = D[o + 7], zz = D[o + 8];
      const cxx = (ax * ax * xx + 2 * ax * az * xz + az * az * zz) * s2 + 0.3;
      const cyy = (bx * bx * xx + 2 * bx * by * xy + 2 * bx * bz * xz + by * by * yy + 2 * by * bz * yz + bz * bz * zz) * s2 + 0.3;
      const cxy = -(ax * bx * xx + ax * by * xy + (ax * bz + az * bx) * xz + az * by * yz + az * bz * zz) * s2;
      const rz = Math.sqrt(Math.max(0, kx * kx * xx + 2 * kx * ky * xy + 2 * kx * kz * xz + ky * ky * yy + 2 * ky * kz * yz + kz * kz * zz));
      const det = cxx * cyy - cxy * cxy;
      if (det <= 0) continue;
      const ixx = cyy / det, ixy = -cxy / det, iyy = cxx / det;
      const rx = Math.sqrt(cxx), ry = Math.sqrt(cyy);
      const x0 = Math.max(0, Math.floor(px - rx)), x1 = Math.min(W - 1, Math.ceil(px + rx));
      const y0 = Math.max(0, Math.floor(py - ry)), y1 = Math.min(H - 1, Math.ceil(py + ry));
      if (x0 > x1 || y0 > y1) continue;
      const ramp = sc.ramps[D[o + 12]], len = ramp.length / 3;
      let v;
      if (f & E) v = D[o + 13];
      else if (f & LIT) v = (0.5 + 0.5 * (D[o + 9] * LX + D[o + 10] * LY + D[o + 11] * LZ)) * 0.92 + D[o + 13];
      else v = 0.5 + D[o + 13];
      if (f & WAVE) v += 0.2 * Math.sin(time * wWave + ph);
      let idx = Math.floor(v * len);
      idx = idx < 0 ? 0 : idx >= len ? len - 1 : idx;
      const cr = ramp[idx * 3], cg = ramp[idx * 3 + 1], cb = ramp[idx * 3 + 2], em = f & E ? 1 : 0;
      for (let yy2 = y0; yy2 <= y1; yy2++) {
        const dy = yy2 + 0.5 - py;
        for (let xx2 = x0; xx2 <= x1; xx2++) {
          const dx = xx2 + 0.5 - px, q = ixx * dx * dx + 2 * ixy * dx * dy + iyy * dy * dy;
          if (q > 1) continue;
          const zv = Z + rz * Math.sqrt(1 - q), pi = yy2 * W + xx2;
          if (zv <= zb[pi]) continue;
          zb[pi] = zv; fb[pi] = em; rb[pi] = D[o + 12] + 1; tb[pi] = idx; pb[pi] = part ? part[i] : 0;
          out[pi * 4] = cr; out[pi * 4 + 1] = cg; out[pi * 4 + 2] = cb; out[pi * 4 + 3] = 255;
        }
      }
    }
    if (sc.glow === 0) return out;
    // glow: blur emissive pixels and add them back
    const g = this.g, t = this.t, n = W * H;
    let any = false;
    for (let i = 0; i < n; i++) {
      if (fb[i]) { g[i * 3] = out[i * 4]; g[i * 3 + 1] = out[i * 4 + 1]; g[i * 3 + 2] = out[i * 4 + 2]; any = true; }
      else { g[i * 3] = 0; g[i * 3 + 1] = 0; g[i * 3 + 2] = 0; }
    }
    if (!any) return out;
    const rad = Math.max(2, Math.round(W / 56)), inv = 1 / (2 * rad + 1);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let x = -rad; x <= rad; x++) acc += g[(y * W + Math.min(W - 1, Math.max(0, x))) * 3 + c];
        for (let x = 0; x < W; x++) {
          t[(y * W + x) * 3 + c] = acc * inv;
          acc += g[(y * W + Math.min(W - 1, x + rad + 1)) * 3 + c] - g[(y * W + Math.max(0, x - rad)) * 3 + c];
        }
      }
      for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let y = -rad; y <= rad; y++) acc += t[(Math.min(H - 1, Math.max(0, y)) * W + x) * 3 + c];
        for (let y = 0; y < H; y++) {
          g[(y * W + x) * 3 + c] = acc * inv;
          acc += t[(Math.min(H - 1, y + rad + 1) * W + x) * 3 + c] - t[(Math.max(0, y - rad) * W + x) * 3 + c];
        }
      }
    }
    const gs = sc.glow || 0.7;
    for (let i = 0; i < n; i++) {
      if (fb[i]) continue;
      const lum = g[i * 3] + g[i * 3 + 1] + g[i * 3 + 2];
      if (alpha && out[i * 4 + 3] === 0) {
        // premultiplied-style halo for sprites
        if (lum > 24) { out[i * 4] = g[i * 3] * gs * 2; out[i * 4 + 1] = g[i * 3 + 1] * gs * 2; out[i * 4 + 2] = g[i * 3 + 2] * gs * 2; out[i * 4 + 3] = Math.min(160, lum * gs * 0.6); }
        continue;
      }
      out[i * 4] += g[i * 3] * gs; out[i * 4 + 1] += g[i * 3 + 1] * gs; out[i * 4 + 2] += g[i * 3 + 2] * gs;
    }
    return out;
  };

  const api = { Builder, Renderer, rng, norm, hex, TAU, GA, E, WAVE, DRIFT, LIT, LIGHT: [LX, LY, LZ] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Splat = api;
})(typeof window !== 'undefined' ? window : globalThis);
