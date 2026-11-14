// Skeleton runtime for pixel splats. Works in Node and in a browser (global: SplatRig).
//   const rig = new Rig(scene);            // scene from lib.load(), with bones
//   rig.update(targets, dt);               // targets: { boneName: { r: [rx, ry, rz], t: [x, y, z] } }
//   renderer.draw(rig.scene, cam, time);   // rig.scene is the posed copy
// Driven bones chase their target rotation on a spring (stiff = rigid, soft + low damp = elastic).
// Jiggle bones are not driven: their tip is a point mass dragged along by the parent.
(function (root) {
  const K = 16;
  function euler(rx, ry, rz, m, o) { // R = Ry * Rx * Rz, written into m at offset o
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
    m[o] = cy * cz + sy * sx * sz; m[o + 1] = -cy * sz + sy * sx * cz; m[o + 2] = sy * cx;
    m[o + 3] = cx * sz; m[o + 4] = cx * cz; m[o + 5] = -sx;
    m[o + 6] = -sy * cz + cy * sx * sz; m[o + 7] = sy * sz + cy * sx * cz; m[o + 8] = cy * cx;
  }
  function mul(a, ao, b, bo, c, co) { // c = a * b (3x3)
    const t = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) t[i * 3 + j] = a[ao + i * 3] * b[bo + j] + a[ao + i * 3 + 1] * b[bo + 3 + j] + a[ao + i * 3 + 2] * b[bo + 6 + j];
    for (let i = 0; i < 9; i++) c[co + i] = t[i];
  }
  function fromTo(a, b, m) { // rotation taking unit vector a to unit vector b
    const kx = a[1] * b[2] - a[2] * b[1], ky = a[2] * b[0] - a[0] * b[2], kz = a[0] * b[1] - a[1] * b[0];
    const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], s2 = kx * kx + ky * ky + kz * kz;
    if (s2 < 1e-10) { m[0] = m[4] = m[8] = 1; m[1] = m[2] = m[3] = m[5] = m[6] = m[7] = 0; return; }
    const f = (1 - c) / s2;
    m[0] = 1 + f * (-ky * ky - kz * kz); m[1] = -kz + f * kx * ky; m[2] = ky + f * kx * kz;
    m[3] = kz + f * kx * ky; m[4] = 1 + f * (-kx * kx - kz * kz); m[5] = -kx + f * ky * kz;
    m[6] = -ky + f * kx * kz; m[7] = kx + f * ky * kz; m[8] = 1 + f * (-kx * kx - ky * ky);
  }
  function Rig(sc) {
    this.src = sc; this.B = sc.bones; const n = this.B.length;
    this.q = new Float32Array(n * 6); this.v = new Float32Array(n * 6); // per bone: rx ry rz tx ty tz
    this.R = new Float32Array(n * 9); this.o = new Float32Array(n * 3);
    this.sq = new Float32Array(n).fill(1); this.sv = new Float32Array(n); this.S = new Float32Array(n).fill(1); // per-bone scale
    this.jx = new Float32Array(n * 3); this.jv = new Float32Array(n * 3); this.started = false;
    this.D = new Float32Array(sc.D);
    this.scene = Object.assign({}, sc, { D: this.D });
    this.index = {}; this.B.forEach((b, i) => { this.index[b.name] = i; });
  }
  Rig.prototype.update = function (targets, dt) {
    const B = this.B, n = B.length, q = this.q, v = this.v, R = this.R, o = this.o, tmp = new Float32Array(9), I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    dt = Math.min(dt, 0.05);
    // 1. springs toward the target pose
    const sub = 2, h = dt / sub;
    for (let i = 0; i < n; i++) {
      const b = B[i]; if (b.jiggle) continue;
      const tg = targets[b.name] || {}, r = tg.r || [0, 0, 0], t = tg.t || [0, 0, 0], w = b.stiff, z = b.damp;
      { const goal = tg.s == null ? 1 : tg.s; for (let s = 0; s < sub; s++) { this.sv[i] += (w * w * (goal - this.sq[i]) - 2 * z * w * this.sv[i]) * h; this.sq[i] += this.sv[i] * h; } }
      for (let k = 0; k < 6; k++) {
        const goal = k < 3 ? r[k] : t[k - 3];
        for (let s = 0; s < sub; s++) { v[i * 6 + k] += (w * w * (goal - q[i * 6 + k]) - 2 * z * w * v[i * 6 + k]) * h; q[i * 6 + k] += v[i * 6 + k] * h; }
      }
    }
    // 2. world transform per bone, parents first:  p' = o + R (p - pivot)
    for (let i = 0; i < n; i++) {
      const b = B[i], p = b.parent, Rp = p < 0 ? I : R, po = p < 0 ? 0 : p * 9;
      const lx = b.pivot[0] - (p < 0 ? 0 : B[p].pivot[0]) + q[i * 6 + 3], ly = b.pivot[1] - (p < 0 ? 0 : B[p].pivot[1]) + q[i * 6 + 4], lz = b.pivot[2] - (p < 0 ? 0 : B[p].pivot[2]) + q[i * 6 + 5];
      o[i * 3] = (p < 0 ? 0 : o[p * 3]) + Rp[po] * lx + Rp[po + 1] * ly + Rp[po + 2] * lz;
      o[i * 3 + 1] = (p < 0 ? 0 : o[p * 3 + 1]) + Rp[po + 3] * lx + Rp[po + 4] * ly + Rp[po + 5] * lz;
      o[i * 3 + 2] = (p < 0 ? 0 : o[p * 3 + 2]) + Rp[po + 6] * lx + Rp[po + 7] * ly + Rp[po + 8] * lz;
      this.S[i] = (p < 0 ? 1 : this.S[p]) * (b.jiggle ? 1 : this.sq[i]);
      if (!b.jiggle) { euler(q[i * 6], q[i * 6 + 1], q[i * 6 + 2], tmp, 0); for (let k = 0; k < 9; k++) tmp[k] *= this.sq[i]; mul(Rp, po, tmp, 0, R, i * 9); continue; }
      // jiggle bone: drag a point mass toward where the tip would be if the bone were rigid
      const j = b.jiggle, L = Math.hypot(j[0], j[1], j[2]);
      const rx = Rp[po] * j[0] + Rp[po + 1] * j[1] + Rp[po + 2] * j[2], ry = Rp[po + 3] * j[0] + Rp[po + 4] * j[1] + Rp[po + 5] * j[2], rz = Rp[po + 6] * j[0] + Rp[po + 7] * j[1] + Rp[po + 8] * j[2];
      const goal = [o[i * 3] + rx, o[i * 3 + 1] + ry, o[i * 3 + 2] + rz], x = this.jx, jv = this.jv, w = b.stiff, z = b.damp;
      if (!this.started) for (let k = 0; k < 3; k++) x[i * 3 + k] = goal[k];
      for (let k = 0; k < 3; k++) for (let s = 0; s < sub; s++) { jv[i * 3 + k] += (w * w * (goal[k] - x[i * 3 + k]) - 2 * z * w * jv[i * 3 + k]) * h; x[i * 3 + k] += jv[i * 3 + k] * h; }
      let dx = x[i * 3] - o[i * 3], dy = x[i * 3 + 1] - o[i * 3 + 1], dz = x[i * 3 + 2] - o[i * 3 + 2]; const dl = Math.hypot(dx, dy, dz) || 1;
      const rl = Math.hypot(rx, ry, rz) || 1;
      fromTo([rx / rl, ry / rl, rz / rl], [dx / dl, dy / dl, dz / dl], tmp); mul(tmp, 0, Rp, po, R, i * 9);
    }
    this.started = true;
    // 3. skin the splats: position blends two bones, shape and normal follow the main bone
    const S = this.src.D, D = this.D, bA = this.src.bA, bB = this.src.bB, bW = this.src.bW, N = this.src.N;
    for (let i = 0; i < N; i++) {
      const a = bA[i]; if (a === 255) continue;
      const e = i * K, px = S[e], py = S[e + 1], pz = S[e + 2], w = bW[i], pa = B[a].pivot, ao = a * 9;
      let dx = px - pa[0], dy = py - pa[1], dz = pz - pa[2];
      let X = o[a * 3] + R[ao] * dx + R[ao + 1] * dy + R[ao + 2] * dz, Y = o[a * 3 + 1] + R[ao + 3] * dx + R[ao + 4] * dy + R[ao + 5] * dz, Z = o[a * 3 + 2] + R[ao + 6] * dx + R[ao + 7] * dy + R[ao + 8] * dz;
      if (w < 1) {
        const b = bB[i], pb = B[b].pivot, bo = b * 9; dx = px - pb[0]; dy = py - pb[1]; dz = pz - pb[2];
        X = w * X + (1 - w) * (o[b * 3] + R[bo] * dx + R[bo + 1] * dy + R[bo + 2] * dz);
        Y = w * Y + (1 - w) * (o[b * 3 + 1] + R[bo + 3] * dx + R[bo + 4] * dy + R[bo + 5] * dz);
        Z = w * Z + (1 - w) * (o[b * 3 + 2] + R[bo + 6] * dx + R[bo + 7] * dy + R[bo + 8] * dz);
      }
      D[e] = X; D[e + 1] = Y; D[e + 2] = Z;
      // covariance: C' = R C R^T
      const xx = S[e + 3], xy = S[e + 4], xz = S[e + 5], yy = S[e + 6], yz = S[e + 7], zz = S[e + 8];
      const r0 = R[ao], r1 = R[ao + 1], r2 = R[ao + 2], r3 = R[ao + 3], r4 = R[ao + 4], r5 = R[ao + 5], r6 = R[ao + 6], r7 = R[ao + 7], r8 = R[ao + 8];
      const m0 = r0 * xx + r1 * xy + r2 * xz, m1 = r0 * xy + r1 * yy + r2 * yz, m2 = r0 * xz + r1 * yz + r2 * zz;
      const m3 = r3 * xx + r4 * xy + r5 * xz, m4 = r3 * xy + r4 * yy + r5 * yz, m5 = r3 * xz + r4 * yz + r5 * zz;
      const m6 = r6 * xx + r7 * xy + r8 * xz, m7 = r6 * xy + r7 * yy + r8 * yz, m8 = r6 * xz + r7 * yz + r8 * zz;
      D[e + 3] = m0 * r0 + m1 * r1 + m2 * r2; D[e + 4] = m0 * r3 + m1 * r4 + m2 * r5; D[e + 5] = m0 * r6 + m1 * r7 + m2 * r8;
      D[e + 6] = m3 * r3 + m4 * r4 + m5 * r5; D[e + 7] = m3 * r6 + m4 * r7 + m5 * r8; D[e + 8] = m6 * r6 + m7 * r7 + m8 * r8;
      const nx = S[e + 9], ny = S[e + 10], nz = S[e + 11];
      const is = 1 / (this.S[a] || 1);
      D[e + 9] = (r0 * nx + r1 * ny + r2 * nz) * is; D[e + 10] = (r3 * nx + r4 * ny + r5 * nz) * is; D[e + 11] = (r6 * nx + r7 * ny + r8 * nz) * is;
    }
    return this.scene;
  };
  // ---- declarative controller ----
  // A channel is a number, or an object:
  //   { base, amp, speed, phase }      base + amp * sin(speed * t + phase)
  //   + square: true                   on/off instead of smooth (amp or 0)
  //   + abs: true                      always positive bounce
  //   + half: true                     only the positive half; add pow: 10 for a short occasional twitch
  //   { pulse: 0.13, dur: 0.45 }       one bump at the start of the gesture, then 0 (add base: 1 for a scale)
  function chan(c, t, p, k) {
    if (typeof c === 'number') return c;
    if (!c) return 0;
    if (c.pulse != null) return (c.base || 0) + (p < (c.dur || 0.5) ? c.pulse * Math.sin((p / (c.dur || 0.5)) * Math.PI) : 0);
    let w = Math.sin((c.speed || 1) * t + (c.phase || 0));
    if (c.square) w = w > 0 ? 1 : 0; else if (c.abs) w = Math.abs(w); else if (c.half) w = Math.pow(Math.max(0, w), c.pow || 1);
    return (c.base || 0) + (c.amp || 0) * w * k;
  }
  // spec = { look: { eyes: [bones], yaw, pitch, head: bone, headYaw }, idle: { bone: { r, t } }, gestures: { name: { once?, bone: { r, t } } } }
  function makeController(spec) {
    spec = spec || {};
    return function (t, intent) {
      const e = intent.energy == null ? 0.5 : intent.energy, k = 0.4 + 1.2 * e, p = intent.since || 0, look = intent.look || [0, 0], P = {};
      const layer = (pose, kk) => {
        for (const n in pose) {
          if (n === 'once') continue;
          const b = pose[n] || {}, cur = P[n] || (P[n] = { r: [0, 0, 0], t: [0, 0, 0] });
          if (b.r) cur.r = b.r.map((c) => chan(c, t, p, kk));
          if (b.t) cur.t = b.t.map((c) => chan(c, t, p, kk));
          if (b.s != null) cur.s = chan(b.s, t, p, kk);
        }
      };
      layer(spec.idle || {}, k);
      const g = (spec.gestures || {})[intent.gesture];
      if (g && !(g.once && p > g.once)) layer(g, 1);
      const L = spec.look;
      if (L) {
        for (const n of L.eyes || []) { const c = P[n] || (P[n] = { r: [0, 0, 0], t: [0, 0, 0] }); c.r[0] -= look[1] * (L.pitch == null ? 0.45 : L.pitch); c.r[1] += look[0] * (L.yaw == null ? 0.6 : L.yaw); }
        if (L.head) { const c = P[L.head] || (P[L.head] = { r: [0, 0, 0], t: [0, 0, 0] }); c.r[1] += look[0] * (L.headYaw == null ? 0.25 : L.headYaw); }
      }
      return P;
    };
  }
  const api = { Rig, makeController };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SplatRig = api;
})(typeof window !== 'undefined' ? window : globalThis);
