// Moss Frog: a fat green frog sitting on a mossy rock, with a skeleton.
// Brief: fat frog hero (~0.6 tall) on a slate rock with a moss cap; red mushrooms and a small boulder as support.
// Warm accents (cream throat, gold eyes) against the cool slate and moss base. One glow: aqua motes.
const { K } = require('../lib');

module.exports = {
  name: 'Moss Frog',
  seed: 11,
  bg: '#060d0b',
  meta: { glow: 0.6, drift: { dir: 1, speed: 0.05, range: 1.2 } },

  build(b) {
    b.part('rock');
    const base = K.rockOutcrop(b, { rock: 'slate', cap: 'moss', drips: true });
    const top = base.topY;
    const foot = (x, z) => [x, top(x, z) - 0.02, z];
    const r = b.r;

    // ---- skeleton (parents first) ----
    b.bone('frog', [0, -0.18, 0.02], null);                                // whole animal: hops
    b.bone('body', [0, -0.16, 0], 'frog', { blend: 0 });
    b.bone('throat', [0.03, -0.02, 0.25], 'body', { stiff: 12, damp: 0.5, blend: 0.02 }); // throat sac
    for (const [s, sx] of [['R', 1], ['L', -1]]) {
      b.bone('arm' + s, [sx * 0.27, -0.06, 0.18], 'body', { stiff: 14, damp: 0.7 });
      b.bone('hand' + s, [sx * 0.36, -0.14, 0.34], 'arm' + s, { stiff: 16, damp: 0.6 });
      b.bone('leg' + s, [sx * 0.23, -0.01, -0.11], 'body', { stiff: 20 });
      b.bone('eye' + s, [sx * 0.17, 0.3, 0.2], 'body', { stiff: 14, damp: 0.5, blend: 0 });
      b.bone('lid' + s, [sx * 0.17, 0.38, 0.2], 'eye' + s, { stiff: 22, damp: 0.8, blend: 0 });
    }

    // ---- body ----
    b.part('frog body');
    b.bind('body');
    b.ellipsoid([0, 0, 0], [0.36, 0.24, 0.32], 'grass', { s: 0.03, rough: 0.04 });
    b.ellipsoid([0, 0.14, 0.12], [0.3, 0.2, 0.22], 'grass', { s: 0.03, bias: 0.04 });
    b.ellipsoid([0.2, 0.02, -0.25], [0.07, 0.05, 0.06], 'moss', { s: 0.02 });   // back spots
    b.ellipsoid([-0.18, 0.1, -0.24], [0.06, 0.05, 0.05], 'moss', { s: 0.02 });
    b.ellipsoid([0.02, 0.2, -0.12], [0.05, 0.04, 0.05], 'moss', { s: 0.02 });
    b.bind(null);

    b.part('throat');
    b.bind('throat');
    b.ellipsoid([0, -0.02, 0.22], [0.2, 0.14, 0.16], 'cream', { s: 0.03, bias: 0.05 });
    b.bind(null);

    // ---- arms and legs ----
    b.part('limbs');
    for (const [s, sx] of [['R', 1], ['L', -1]]) {
      b.bind('arm' + s);
      b.tube([[sx * 0.27, -0.06, 0.18], [sx * 0.36, -0.14, 0.34]], 0.07, 0.05, 'grass', { s: 0.025 });
      b.bind('hand' + s);
      b.ellipsoid([sx * 0.4, top(sx * 0.4, 0.44) + 0.02, 0.44], [0.1, 0.05, 0.12], 'grass', { s: 0.03 });

      b.bind('leg' + s);
      b.ellipsoid([sx * 0.3, -0.06, -0.12], [0.2, 0.16, 0.22], 'grass', { s: 0.03 });
      b.tube([[sx * 0.32, -0.14, -0.22], [sx * 0.42, top(sx * 0.42, 0.12) + 0.02, 0.06], [sx * 0.46, top(sx * 0.46, 0.3) + 0.02, 0.26]], 0.06, 0.03, 'grass', { s: 0.025 });
    }
    b.bind(null);

    // ---- eyes with lids ----
    b.part('eyes');
    for (const [s, sx] of [['R', 1], ['L', -1]]) {
      b.bind('eye' + s);
      K.eye(b, [sx * 0.17, 0.3, 0.2], { r: 0.085, white: 'gold' });
      b.bind('lid' + s);
      b.ellipsoid([sx * 0.17, 0.37, 0.22], [0.1, 0.06, 0.1], 'grass', { s: 0.02 });
    }
    b.bind(null);

    // ---- supporting pieces on the rock ----
    b.part('mushrooms');
    K.mushroom(b, foot(0.5, -0.3), { h: 0.24, r: 0.14, spots: 0, stem: "cream", gill: "cream" });
    K.mushroom(b, foot(-0.5, 0.1), { h: 0.13, r: 0.08, spots: 0, glow: true, stem: "moss", gill: "cream" });
    b.part("pine");
    K.pine(b, foot(0.6, -0.4), { k: 0.7, leaf: "moss", wood: "bark", snow: null });
    b.part("reeds");
    const cx = 0.74, cz = -0.12, cb = foot(cx, cz);
    b.cyl(cb, [cx, top(cx, cz) + 0.5, cz], 0.018, 0.012, 'moss', { cap: 1 });
    b.ellipsoid([cx, top(cx, cz) + 0.54, cz], [0.03, 0.08, 0.03], 'bark', { s: 0.015 });

    b.part('boulder');
    K.boulder(b, [-0.45, top(-0.45, -0.35) + 0.1, -0.35], { r: 0.14, rock: 'slate', cap: 'moss' });

    b.part('dressing');
    K.tufts(b, top, { n: 50, ramp: 'moss', r: 0.6 });
    K.pebbles(b, top, { n: 5, ramps: ['slate'] });

    b.part('motes');
    K.motes(b, { n: 36, ramp: 'aqua', glow: true });
  },

  // How it moves. Angles are radians: r = [tip, turn, roll]. t = [x, y, z]. A value is a number or { amp, speed, ... }.
  rig: {
    look: { eyes: ['eyeR', 'eyeL'], head: 'body' },
    idle: {
      body: { t: [0, { amp: 0.01, speed: 2 }, 0] },                       // breathing
      throat: { t: [0, 0, { amp: 0.004, speed: 2 }] },
      eyeR: { r: [{ amp: 0.04, speed: 0.9 }, 0, 0] },
      eyeL: { r: [{ amp: 0.04, speed: 0.9, phase: 1 }, 0, 0] },
    },
    gestures: {
      croak: { // throat puffs out in fast snaps, head lifts
        once: 1.4,
        throat: { t: [0, 0, { amp: 0.06, speed: 9, square: true }] },
        body: { r: [-0.08, 0, 0] },
      },
      hop: { // one hop, legs kick out, arms flung forward; plays once
        once: 0.9,
        frog: { t: [0, { pulse: 0.16, dur: 0.5 }, 0] },
        legR: { r: [{ pulse: 0.5, dur: 0.5 }, 0, 0] },
        legL: { r: [{ pulse: 0.5, dur: 0.5 }, 0, 0] },
        armR: { r: [-0.6, 0, 0] },
        armL: { r: [-0.6, 0, 0] },
      },
      blink: { // both eyes squash shut and the body dips; plays once
        once: 0.5,
        eyeR: { s: { base: 1, pulse: -0.8, dur: 0.3 } },
        eyeL: { s: { base: 1, pulse: -0.8, dur: 0.3 } },
        lidR: { r: [{ pulse: 1.1, dur: 0.25 }, 0, 0] },
        lidL: { r: [{ pulse: 1.1, dur: 0.25 }, 0, 0] },
        body: { t: [0, { pulse: -0.04, dur: 0.3 }, 0] },
      },
      wave: { // right arm up high, hand waggling, body turns toward the wave
        body: { r: [0, 0.12, 0.05] },
        armR: { r: [-1.3, 0.35, 0.1] },
        handR: { r: [0, { amp: 0.7, speed: 9 }, 0] },
      },
    },
  },
};
