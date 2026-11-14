// Example 2 — a structure on a rock. Kit parts only.
const { K } = require('../lib');

module.exports = {
  name: 'Lantern Gate',
  seed: 21,
  bg: '#080914',
  meta: { glow: 0.8, drift: { dir: -1, speed: 0.06, range: 1.9 } },
  build(b) {
    b.part('rock');
    const base = K.rockOutcrop(b, { rock: 'slate', cap: 'snow' });
    K.boulder(b, [-0.72, -0.34, 0.24], { r: 0.2, cap: 'snow' });
    K.boulder(b, [0.68, -0.36, -0.28], { r: 0.24, cap: 'snow' });
    K.boulder(b, [0.5, -0.3, 0.42], { r: 0.12, cap: 'snow' });

    b.part('gate');
    const gate = K.gate(b, [0, -0.2, 0], { w: 0.42, h: 0.82, cap: 'snow' });

    b.part('lantern');
    K.lantern(b, gate.hang, { tassel: 'lacquer' });
    K.lightPool(b, [0, -0.175, 0.04], { r: 0.24 });

    b.part('steps');
    K.steps(b, [0, -0.2, 0.42], { n: 3 });

    b.part('pines');
    K.pine(b, [-0.5, -0.22, -0.3], { k: 1, snow: 'snow' });
    K.pine(b, [0.2, -0.22, -0.45], { k: 0.62, snow: 'snow' });

    b.part('snowfall');
    K.motes(b, { n: 70, ramp: 'white', rmin: 0, rmax: 1.1, y: 0.1, size: 0.008 });
  },
};
