// Example 4 — a dark, glowing piece. Shows the slab base, columns, crystals, vines and a flame.
const { K, E } = require('../lib');

module.exports = {
  name: 'Ember Shrine',
  seed: 12,
  bg: '#0c0709',
  meta: { bob: 0.02, glow: 0.8, drift: { dir: 1, speed: 0.06, range: 1.6 } },
  build(b) {
    b.part('slab');
    const base = K.slab(b, { r: 0.72, y: -0.3, top: 'slate', side: 'ink', drips: 'ember', dripGlow: true, nDrips: 16 });
    const y = base.topY();

    b.part('columns');
    const c1 = K.column(b, [-0.42, y, -0.18], { h: 0.95, r: 0.075, ramp: 'ash' });
    const c2 = K.column(b, [0.4, y, -0.26], { h: 0.72, r: 0.075, ramp: 'ash' });
    K.column(b, [0.3, y, 0.36], { h: 0.3, r: 0.075, ramp: 'ash', broken: true });

    b.part('vines');
    K.vine(b, c1.top, c2.top, { sag: 0.22, ramp: 'moss' });

    b.part('brazier');
    b.cyl([0, y, 0.05], [0, y + 0.14, 0.05], 0.07, 0.04, 'bronze', {});       // stem
    b.ellipsoid([0, y + 0.25, 0.05], [0.2, 0.13, 0.2], 'bronze', { keep: (u) => u[1] < 0.15 }); // bowl: lower half of a ball
    b.fill([0, y + 0.262, 0.05], [0, 1, 0], 0.19, 'ember', { f: E, s: 0.03 });  // coals
    K.flame(b, [0, y + 0.22, 0.05], { h: 0.36 });
    K.lightPool(b, [0, y + 0.012, 0.05], { r: 0.34 });

    b.part('crystals');
    K.crystal(b, [-0.2, y, 0.42], { h: 0.3, glow: true, ramp: 'ember', lean: 0.2 });
    K.crystal(b, [-0.32, y, 0.36], { h: 0.18, glow: true, ramp: 'ember', leanZ: 0.3 });
    K.crystal(b, [0.56, y, 0.02], { h: 0.22, glow: true, ramp: 'ember', leanZ: -0.25 });

    b.part('rubble');
    K.pebbles(b, base.topY, { n: 9, ramps: ['ash', 'ink'], rmin: 0.2, rmax: 0.62 });

    b.part('embers');
    K.motes(b, { n: 40, ramp: 'ember', glow: true, rmax: 0.9 });
  },
};
