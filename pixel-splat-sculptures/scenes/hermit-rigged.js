// The hermit crab with a skeleton. Same shapes as tidepool-hermit.js, plus:
//   b.bone(name, pivot, parent, opts)  defines a joint
//   b.bind(name)                       makes what follows move with that bone
//   rig: { look, idle, gestures }      says how it moves, as plain data
const { K, TAU } = require('../lib');

module.exports = {
  name: 'Rigged Hermit',
  seed: 5,
  bg: '#050c14',
  meta: { glow: 0, drift: { dir: 1, speed: 0.07, range: 1.0 } },

  build(b) {
    const r = b.r;
    b.part('sandbar');
    const base = K.sandbar(b);
    const sandY = base.topY;

    // ---- skeleton (parents first) ----
    b.bone('crab', [0, -0.4, 0.1], null);                                  // whole animal: hops, scuttles
    b.bone('shell', [0, -0.34, 0.05], 'crab', { stiff: 9, damp: 0.35, blend: 0 }); // elastic: lags and wobbles
    b.bone('body', [0, -0.3, 0.3], 'crab', { blend: 0 });
    for (const [s, sx] of [['R', 1], ['L', -1]]) {
      b.bone('arm' + s, [sx * 0.14, -0.33, 0.34], 'body', { stiff: 14, damp: 0.7 });
      b.bone('hand' + s, [sx * 0.4, -0.26, 0.58], 'arm' + s, { stiff: 16, damp: 0.6 });
      b.bone('pinch' + s, [sx * 0.41, -0.2, 0.7], 'hand' + s, { stiff: 30, blend: 0.02 });
      b.bone('legF' + s, [sx * 0.16, -0.32, 0.26], 'body', { stiff: 26 });
      b.bone('legB' + s, [sx * 0.16, -0.32, 0.16], 'body', { stiff: 26 });
      b.bone('stalk' + s, [sx * 0.06, -0.22, 0.42], 'body', { stiff: 12, damp: 0.45, blend: 0.02 });
      b.bone('ant' + s, [sx * 0.03, -0.2, 0.46], 'body', { jiggle: [sx * 0.056, 0.067, 0.112], stiff: 13, damp: 0.18, blend: 0 });
    }

    b.part('shell');
    b.bind('shell');
    b.at([0.02, -0.33, -0.12], 0.25, -0.62, 0.08, () => {
      K.spiralShell(b);
      b.bone('tuft', [0, 0.78, 0], 'shell', { jiggle: [0, 0.1, 0], stiff: 10, damp: 0.15, blend: 0 });
      b.bind('tuft');
      for (let i = 0; i < 9; i++)
        b.stroke([(r() - 0.5) * 0.05, 0.8, (r() - 0.5) * 0.05], [(r() - 0.5) * 0.9, 1, (r() - 0.5) * 0.9], 0.05 + r() * 0.05, 0.016, 'leaf', { bias: r() * 0.2 });
    });
    b.bind('shell');
    b.torus([0, -0.3, 0.2], [0, 0.35, 1], 0.2, 0.045, 'pearl', { s: 0.035, a0: -0.4, a1: Math.PI + 0.4 });

    b.part('crab body');
    b.bind('body');
    b.ellipsoid([0, -0.3, 0.3], [0.19, 0.13, 0.17], 'coral', { s: 0.035 });
    b.ellipsoid([0, -0.26, 0.4], [0.12, 0.08, 0.09], 'coral', { s: 0.03, bias: 0.06 });

    b.part('claws');
    const claw = (s, sx, k) => {
      b.bind('arm' + s);
      b.tube([[sx * 0.14, -0.33, 0.34], [sx * 0.33, -0.33, 0.46], [sx * 0.4, -0.26, 0.58]], 0.055 * k, 0.05 * k, 'coral', { s: 0.03 });
      b.bind('hand' + s);
      b.ellipsoid([sx * 0.42, -0.24, 0.67], [0.12 * k, 0.1 * k, 0.14 * k], 'coral', { s: 0.035, bias: 0.04 });
      b.ellipsoid([sx * 0.44, -0.29, 0.8], [0.04 * k, 0.03 * k, 0.08 * k], 'coral', { s: 0.025, bias: -0.05 });
      b.bind('pinch' + s);
      b.ellipsoid([sx * 0.4, -0.16, 0.8], [0.04 * k, 0.035 * k, 0.09 * k], 'coral', { s: 0.025, bias: 0.1 });
    };
    claw('R', 1, 1.15);
    claw('L', -1, 0.72);

    b.part('legs and eyes');
    for (const [s, sx] of [['R', 1], ['L', -1]]) {
      b.bind('legF' + s);
      b.tube([[sx * 0.16, -0.32, 0.26], [sx * 0.4, -0.2, 0.3], [sx * 0.56, sandY(sx * 0.56, 0.36) + 0.02, 0.36]], 0.04, 0.014, 'coral', { s: 0.025 });
      b.bind('legB' + s);
      b.tube([[sx * 0.16, -0.32, 0.16], [sx * 0.42, -0.2, 0.1], [sx * 0.6, sandY(sx * 0.6, 0.08) + 0.02, 0.08]], 0.038, 0.014, 'coral', { s: 0.025 });
      b.bind('stalk' + s);
      b.cyl([sx * 0.06, -0.22, 0.42], [sx * 0.09, -0.03, 0.5], 0.02, 0.018, 'coral', { s: 0.02 });
      K.eye(b, [sx * 0.09, -0.01, 0.5], { r: 0.052 });
      b.bind('ant' + s);
      b.stroke([sx * 0.03, -0.2, 0.46], [sx * 0.5, 0.6, 1], 0.07, 0.008, 'coral', { bias: 0.2 });
    }
    b.bind(null);

    b.part('beach');
    b.at([-0.46, sandY(-0.46, 0.36) + 0.01, 0.36], 0.4, 0, 0, () => {
      for (let k = 0; k < 5; k++) b.at([0, 0, 0], (k / 5) * TAU, 0, 0, () => b.ellipsoid([0.06, 0, 0], [0.075, 0.022, 0.03], 'rose', { s: 0.022 }));
      b.ellipsoid([0, 0.005, 0], [0.035, 0.025, 0.035], 'rose', { s: 0.022, bias: 0.1 });
    });
    K.pebbles(b, sandY, { n: 7, ramps: ['pearl', 'sea'] });
    for (const [x, z] of [[0.5, -0.3], [-0.45, -0.38], [0.3, -0.55]]) K.reeds(b, [x, sandY(x, z), z]);

    b.part('spray');
    K.motes(b, { n: 30, ramp: 'foam', rmin: 0.5, rmax: 1.05, y: -0.1, size: 0.009 });
  },

  // How it moves. Angles are radians: r = [tip forward/back, turn left/right, roll sideways]. t = [x, y, z] offset.
  // A value is a number (held still) or { amp, speed, ... } (keeps moving). See references/RIGGING.md.
  rig: {
    look: { eyes: ['stalkR', 'stalkL'], head: 'body' },
    idle: {
      body: { r: [{ amp: 0.03, speed: 1.7 }, 0, { amp: 0.03, speed: 1.1 }], t: [0, { amp: 0.012, speed: 2 }, 0] }, // breathing
      shell: { r: [0, 0, { amp: 0.02, speed: 0.9, phase: 1 }] },
      armR: { r: [{ base: -0.08, amp: 0.06, speed: 1.3 }, 0, 0] },
      armL: { r: [{ base: -0.05, amp: 0.06, speed: 1.5, phase: 2 }, 0, 0] },
      pinchR: { r: [{ amp: -0.5, speed: 0.7, half: true, pow: 10 }, 0, 0] }, // a pincer click now and then
      pinchL: { r: [{ amp: -0.3, speed: 0.7, half: true, pow: 10 }, 0, 0] },
      stalkR: { r: [{ amp: 0.04, speed: 1.9 }, 0, { amp: 0.05, speed: 0.8 }] },
      stalkL: { r: [{ amp: 0.04, speed: 2.3, phase: 1 }, 0, { amp: -0.05, speed: 0.8 }] },
    },
    gestures: {
      wave: { // raise the big claw and wag it
        body: { r: [0, 0, -0.1] }, armR: { r: [-1.05, 0.25, 0.1] }, handR: { r: [0, { amp: 0.55, speed: 9 }, 0] }, pinchR: { r: [-0.45, 0, 0] },
      },
      snap: { // both claws forward, pincers clacking
        armR: { r: [-0.5, -0.15, 0] }, armL: { r: [-0.5, 0.15, 0] }, body: { t: [0, 0, 0.03] },
        pinchR: { r: [{ amp: -0.65, speed: 15, square: true }, 0, 0] }, pinchL: { r: [{ amp: -0.65, speed: 15, square: true }, 0, 0] },
      },
      scuttle: { // sideways shuffle: legs paddle in opposite pairs
        crab: { r: [0, { amp: 0.1, speed: 2.2, phase: 1.57 }, 0], t: [{ amp: 0.11, speed: 2.2 }, { amp: 0.012, speed: 15, abs: true }, 0] },
        legFR: { r: [0, { amp: 0.4, speed: 15 }, { amp: 0.25, speed: 15, phase: 1.57, half: true }] },
        legBR: { r: [0, { amp: -0.4, speed: 15 }, { amp: 0.25, speed: 15, phase: -1.57, half: true }] },
        legFL: { r: [0, { amp: 0.4, speed: 15 }, { amp: -0.25, speed: 15, phase: -1.57, half: true }] },
        legBL: { r: [0, { amp: -0.4, speed: 15 }, { amp: -0.25, speed: 15, phase: 1.57, half: true }] },
      },
      hide: { // pull back under the shell, claws folded across the front, eyes down
        body: { r: [0.1, 0, 0], t: [0, -0.02, -0.3] }, shell: { r: [0.08, 0, 0] },
        armR: { r: [0.15, -0.9, 0] }, armL: { r: [0.15, 0.9, 0] }, handR: { r: [0, -0.7, 0] }, handL: { r: [0, 0.7, 0] },
        stalkR: { r: [1.25, 0, 0.2] }, stalkL: { r: [1.25, 0, -0.2] },
        legFR: { r: [0, -1.1, 0.2] }, legBR: { r: [0, -1.3, 0.2] }, legFL: { r: [0, 1.1, -0.2] }, legBL: { r: [0, 1.3, -0.2] },
      },
      startle: { // one hop, claws flung wide, eyes up; plays once, then back to idle
        once: 0.9,
        crab: { t: [0, { pulse: 0.13, dur: 0.45 }, 0] },
        armR: { r: [-0.7, 0.5, 0] }, armL: { r: [-0.7, -0.5, 0] }, pinchR: { r: [-0.7, 0, 0] }, pinchL: { r: [-0.7, 0, 0] },
        stalkR: { r: [-0.5, 0, 0.3] }, stalkL: { r: [-0.5, 0, -0.3] },
      },
    },
  },
};
