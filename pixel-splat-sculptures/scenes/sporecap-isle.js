// Example 1 — built entirely from kit parts. Study this one first.
const { K } = require('../lib');

module.exports = {
  name: 'Sporecap Isle',
  seed: 7,
  bg: '#0b0814',
  meta: { bob: 0.02, glow: 0.75, drift: { dir: 1, speed: 0.045, range: 1.7 } },
  build(b) {
    b.part('island');
    const base = K.floatingIsland(b, { top: 'grass', under: 'soil', rootRamp: 'root' });
    const foot = (x, z) => [x, base.topY(x, z) - 0.02, z];

    b.part('big mushroom');
    K.mushroom(b, foot(0, 0), { h: 0.78, r: 0.58, stemW: 0.15, lean: 0.04, spots: 13 });

    b.part('small mushrooms');
    K.mushroom(b, foot(-0.46, 0.22), { h: 0.3, r: 0.17, spots: 0 });
    K.mushroom(b, foot(0.55, 0.12), { h: 0.1, r: 0.07, spots: 0 });
    K.mushroom(b, foot(0.44, -0.3), { h: 0.22, r: 0.13, glow: true });
    K.mushroom(b, foot(0.34, 0.44), { h: 0.15, r: 0.09, glow: true });
    K.mushroom(b, foot(-0.22, -0.5), { h: 0.2, r: 0.11, glow: true });
    K.mushroom(b, foot(-0.58, -0.2), { h: 0.09, r: 0.06, glow: true });

    b.part('grass');
    K.tufts(b, base.topY, { n: 90, r: 0.72 });

    b.part('spores');
    K.motes(b, { n: 46, ramp: 'aqua', glow: true });
  },
};
