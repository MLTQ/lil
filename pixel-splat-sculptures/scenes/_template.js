// Copy this file, rename it, and fill in build(). Run:  node tools/make.js scenes/<your-file>.js
const { K, E, WAVE, DRIFT, TAU } = require('../lib');

module.exports = {
  name: 'My Sculpture',       // shown in the viewer and used for output file names
  seed: 1,                    // change this number to reshuffle the random details
  bg: '#0a0912',              // very dark background, tinted toward the piece's main colour
  meta: {
    bob: 0,                   // 0.02 makes a floating piece bob gently; 0 for grounded pieces
    glow: 0.75,               // halo strength around glowing parts; 0 turns halos off
    drift: { dir: 1, speed: 0.05, range: 1.7 }, // motes: dir 1 = rise, -1 = fall
  },
  build(b) {
    b.part('base');
    const base = K.floatingIsland(b);                 // 1. exactly one base

    b.part('hero');
    K.mushroom(b, [0, base.topY(0, 0) - 0.02, 0], { h: 0.75, r: 0.55 }); // 2. one big hero

    b.part('support');                                // 3. two to six smaller supporting pieces
    K.mushroom(b, [0.45, base.topY(0.45, -0.3) - 0.02, -0.3], { h: 0.22, glow: true });

    b.part('dressing');                               // 4. ground dressing
    K.tufts(b, base.topY, { n: 90 });

    b.part('motes');                                  // 5. drifting motes
    K.motes(b, { n: 45, ramp: 'aqua', glow: true });
  },
};
