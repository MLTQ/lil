// Lighthouse on a sea rock. Copied from lantern-gate.js and edited to the brief.
const { K, E, DRIFT } = require('../lib');

module.exports = {
  name: 'Sea Rock Lighthouse',
  seed: 33,
  bg: '#070a14',
  meta: { glow: 0.8, drift: { dir: 1, speed: 0.05, range: 1.5 } },
  build(b) {
    b.part('rock');
    const base = K.rockOutcrop(b, { rock: 'slate', cap: 'moss', rx: 0.8, rz: 0.7 });
    const y = base.topY(0, 0) - 0.02;

    b.part('tower');
    // tapered body, bone-white
    b.cyl([0, y, 0], [0, y + 0.62, 0], 0.18, 0.12, 'bone', { cap: 1 });
    // lacquer band near the top
    b.cyl([0, y + 0.42, 0], [0, y + 0.5, 0], 0.145, 0.125, 'lacquer', { s: 0.03 });
    // gallery rail and lantern room
    b.cyl([0, y + 0.62, 0], [0, y + 0.66, 0], 0.2, 0.2, 'ink', { s: 0.03 });   // wide gallery floor
    b.cyl([0, y + 0.66, 0], [0, y + 0.7, 0], 0.11, 0.11, 'stone', { s: 0.025 }); // short base of the glass room
    b.box([0, y + 0.745, 0], [0.085, 0.07, 0.085], 'lamp', { f: E, s: 0.02 });   // lamp, now clearly visible
    b.cyl([0, y + 0.8, 0], [0, y + 0.82, 0], 0.15, 0.15, 'ink', { s: 0.03 });   // roof rim
    // cone roof
    b.cyl([0, y + 0.82, 0], [0, y + 0.92, 0], 0.14, 0.02, 'lacquer', { s: 0.028, cap: 1 });

    b.part('boulders');
    K.boulder(b, [-0.5, base.topY(-0.5, 0.2) + 0.05, 0.2], { r: 0.16, rock: 'slate', cap: 'moss' });
    K.boulder(b, [0.52, base.topY(0.52, -0.25) + 0.05, -0.25], { r: 0.2, rock: 'stone', cap: 'foam' });

    b.part('sea stack');
    K.boulder(b, [0.1, base.topY(0.1, 0.5) + 0.02, 0.5], { r: 0.1, rock: 'ink' });

    b.part('reeds');
    K.reeds(b, [-0.3, base.topY(-0.3, -0.45), -0.45], { n: 9, h: 0.16, ramp: 'grass' });

    b.part('spray');
    K.motes(b, { n: 40, ramp: 'foam', rmin: 0.4, rmax: 1.0, y: 0.0, size: 0.009 });
  },
};
