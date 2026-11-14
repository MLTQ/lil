// Example 3 — a creature. The crab has no prefab, so it is built from primitives:
// b.ellipsoid for body masses, b.tube for limbs, K.eye for eyes. Use this as the pattern for animals.
const { K, TAU } = require('../lib');

module.exports = {
  name: 'Tidepool Hermit',
  seed: 5,
  bg: '#050c14',
  meta: { glow: 0, drift: { dir: 1, speed: 0.07, range: 1.0 } },
  build(b) {
    const r = b.r;
    b.part('sandbar');
    const base = K.sandbar(b);
    const sandY = base.topY;

    b.part('shell');
    b.at([0.02, -0.33, -0.12], 0.25, -0.62, 0.08, () => {
      K.spiralShell(b);
      for (let i = 0; i < 9; i++) // tuft of weed on the tip
        b.stroke([(r() - 0.5) * 0.05, 0.8, (r() - 0.5) * 0.05], [(r() - 0.5) * 0.9, 1, (r() - 0.5) * 0.9], 0.05 + r() * 0.05, 0.016, 'leaf', { bias: r() * 0.2 });
    });
    b.torus([0, -0.3, 0.2], [0, 0.35, 1], 0.2, 0.045, 'pearl', { s: 0.035, a0: -0.4, a1: Math.PI + 0.4 }); // shell lip

    b.part('crab body');
    b.ellipsoid([0, -0.3, 0.3], [0.19, 0.13, 0.17], 'coral', { s: 0.035 });
    b.ellipsoid([0, -0.26, 0.4], [0.12, 0.08, 0.09], 'coral', { s: 0.03, bias: 0.06 });

    b.part('claws');
    const claw = (sx, k) => { // sx: -1 left, 1 right. k: size.
      b.tube([[sx * 0.14, -0.33, 0.34], [sx * 0.33, -0.33, 0.46], [sx * 0.4, -0.26, 0.58]], 0.055 * k, 0.05 * k, 'coral', { s: 0.03 });
      b.ellipsoid([sx * 0.42, -0.24, 0.67], [0.12 * k, 0.1 * k, 0.14 * k], 'coral', { s: 0.035, bias: 0.04 });
      b.ellipsoid([sx * 0.4, -0.16, 0.8], [0.04 * k, 0.035 * k, 0.09 * k], 'coral', { s: 0.025, bias: 0.1 });
      b.ellipsoid([sx * 0.44, -0.29, 0.8], [0.04 * k, 0.03 * k, 0.08 * k], 'coral', { s: 0.025, bias: -0.05 });
    };
    claw(1, 1.15); // one big claw, one small: asymmetry reads better than a mirror image
    claw(-1, 0.72);

    b.part('legs and eyes');
    for (const sx of [-1, 1]) {
      b.tube([[sx * 0.16, -0.32, 0.26], [sx * 0.4, -0.2, 0.3], [sx * 0.56, sandY(sx * 0.56, 0.36) + 0.02, 0.36]], 0.04, 0.014, 'coral', { s: 0.025 });
      b.tube([[sx * 0.16, -0.32, 0.16], [sx * 0.42, -0.2, 0.1], [sx * 0.6, sandY(sx * 0.6, 0.08) + 0.02, 0.08]], 0.038, 0.014, 'coral', { s: 0.025 });
      b.cyl([sx * 0.06, -0.22, 0.42], [sx * 0.09, -0.03, 0.5], 0.02, 0.018, 'coral', { s: 0.02 }); // eye stalk
      K.eye(b, [sx * 0.09, -0.01, 0.5], { r: 0.052 });
      b.stroke([sx * 0.03, -0.2, 0.46], [sx * 0.5, 0.6, 1], 0.07, 0.008, 'coral', { bias: 0.2 }); // antenna
    }

    b.part('beach');
    b.at([-0.46, sandY(-0.46, 0.36) + 0.01, 0.36], 0.4, 0, 0, () => { // starfish: five arms around a centre
      for (let k = 0; k < 5; k++) b.at([0, 0, 0], (k / 5) * TAU, 0, 0, () => b.ellipsoid([0.06, 0, 0], [0.075, 0.022, 0.03], 'rose', { s: 0.022 }));
      b.ellipsoid([0, 0.005, 0], [0.035, 0.025, 0.035], 'rose', { s: 0.022, bias: 0.1 });
    });
    K.pebbles(b, sandY, { n: 7, ramps: ['pearl', 'sea'] });
    for (const [x, z] of [[0.5, -0.3], [-0.45, -0.38], [0.3, -0.55]]) K.reeds(b, [x, sandY(x, z), z]);

    b.part('spray');
    K.motes(b, { n: 30, ramp: 'foam', rmin: 0.5, rmax: 1.05, y: -0.1, size: 0.009 });
  },
};
