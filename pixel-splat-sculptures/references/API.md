# API reference

All options are optional. Defaults are shown after `=`. Ramp options take a ramp name.

## Scene file

```js
const { K, E, WAVE, DRIFT, TAU } = require('../lib');
module.exports = {
  name: 'Name',            // display name
  seed: 1,                 // any whole number; changes random details
  bg: '#0a0912',           // background colour (the only hex colour you write)
  meta: {
    bob: 0,                // 0.02 = gentle bobbing, for floating pieces
    glow: 0.75,            // halo strength, 0 = off
    drift: { dir: 1, speed: 0.05, range: 1.7 },  // motes: dir 1 up, -1 down; range = travel distance
  },
  build(b) { /* parts go here */ },
};
```

The piece is centred in the frame automatically.

## Builder

- `b.part('name')` : names everything built after it, until the next `b.part`.
- `b.r()` : random number from 0 to 1. Repeats exactly for the same `seed`.
- `b.at(pos, ry, rx, rz, () => { ... })` : inside the braces, `[0, 0, 0]` means `pos`, and everything is rotated by `ry` (turn left/right), `rx` (tip forward/back), `rz` (tip sideways).

## Bases

`K.floatingIsland(b, o)` returns `{ R, topY(x, z) }`
- `r = 0.78` radius, `y = -0.32` height of the rim, `depth = 0.5` how far the underside hangs
- `top = 'grass'`, `under = 'soil'`, `rootRamp = under`
- `roots = 11` number of hanging roots, `rim = true` growth hanging over the edge

`K.rockOutcrop(b, o)` returns `{ topY(x, z) }`
- `rx = 0.86`, `rz = 0.72` half-widths, `y = -0.56`
- `rock = 'slate'`, `cap = 'snow'` (ramp for the blanket on top; `null` = bare), `drips = true` icicles off the cap

`K.sandbar(b, o)` returns `{ R, topY(x, z) }`
- `r = 0.74`, `y = -0.62`, `waterR = 1.12`
- `sand = 'sand'`, `water = 'water'`, `foam = 'foam'` (`null` = no foam ring)

`K.slab(b, o)` returns `{ R, topY() }`
- `r = 0.7`, `y = -0.3` top surface, `h = 0.14` thickness
- `top = 'stone'`, `side = 'slate'`
- `drips` ramp for drips off the edge (none by default), `dripGlow = false`, `nDrips = 14`

## Props

`K.mushroom(b, p, o)` returns `{ top }`
- `h = 0.3` height, `r = h * 0.55` cap radius, `stemW` stem radius, `dome = 0.68` cap roundness, `lean`
- `cap = 'cap'`, `stem = 'bone'`, `gill = 'peach'`, `spot = 'cream'`, `spots` count (0 = none)
- `glow = false` : true makes the cap glow (default ramps become `aqua` cap, `reed` stem)

`K.pine(b, p, o)` : `k = 1` scale, `leaf = 'pine'`, `wood = 'bark'`, `snow` ramp for snow on branches (none by default)

`K.tree(b, p, o)` returns `{ top }` : `h = 0.7`, `r = h * 0.38` canopy radius, `leaf = 'leaf'`, `wood = 'bark'`

`K.crystal(b, p, o)` : `h = 0.4`, `r = h * 0.2`, `glow = false`, `ramp` (`violet` if glowing, else `ice`), `lean`, `leanZ` tilt in radians, `ry`

`K.boulder(b, centre, o)` : `r = 0.2`, `rock = 'slate'`, `cap` ramp (none by default)

`K.column(b, p, o)` returns `{ top }` : `h = 0.6`, `r = 0.07`, `ramp = 'stone'`, `broken = false` (true: no capital, and a fallen piece beside it)

`K.gate(b, p, o)` returns `{ hang }` : `w = 0.42` half-width, `h = 0.82`, `post = 'lacquer'`, `roof = 'ink'`, `cap` ramp for snow or moss on top (none by default), `ry` turn

`K.lantern(b, hangPoint, o)` : `k = 1` scale, `frame = 'ink'`, `light = 'lamp'`, `tassel` ramp (none by default). It hangs 0.3 below `hangPoint`.

`K.lightPool(b, p, o)` : `r = 0.24`, `ramp = 'candlelit'`. Put `p` about 0.01 above the ground.

`K.steps(b, p, o)` : `n = 3`, `w = 0.2` half-width, `ramp = 'stone'`, `footing = 'slate'` rock under the steps (`false` = none)

`K.flame(b, p, o)` : `h = 0.14`, `ramp = 'ember'`

`K.vine(b, a, c, o)` : `sag = 0.12`, `ramp = 'leaf'`

`K.spiralShell(b, o)` : `k = 1` scale, `ramp = 'shell'`, `band = 'sea'`, `knob = 'pearl'`, `knobs = true`

`K.eye(b, centre, o)` : `r = 0.05`, `look = [0, 0, 1]`, `white = 'white'`, `pupil = 'ink'`

## Dressing

`K.tufts(b, topY, o)` : `n = 90`, `r = 0.7` scatter radius, `len = 0.05`, `w = 0.014`, `ramp = 'grass'`

`K.pebbles(b, topY, o)` : `n = 7`, `ramps = ['stone']`, `rmin = 0.35`, `rmax = 0.65` distance from centre

`K.reeds(b, p, o)` : `n = 7`, `h = 0.11`, `ramp = 'leaf'`

`K.motes(b, o)` : `n = 45`, `ramp = 'white'`, `glow = false`, `rmin = 0.15`, `rmax = 1.0` distance from centre, `y = 0.15` middle height, `size = 0.011`

## Primitives

Shared options for all primitives:
- `f: E` glow. `f: WAVE` shimmer. `f: E | WAVE` both.
- `bias: 0.1` lighter overall; `bias: -0.1` darker. Range -0.3 to 0.3.
- `rough: 0.1` bumpy surface (ellipsoid only).
- `cov: 2.4` denser coverage, if the checker reports pinholes.
- `keep: (u) => u[1] > 0` (ellipsoid only) keeps part of the ball. `u` is the direction from the centre: `u[1] > 0` top half, `u[1] < 0` bottom half, `u[2] > 0` front half.

`b.ellipsoid(centre, radius, ramp, o)` : `radius` is a number or `[rx, ry, rz]`.
`b.tube(points, r0, r1, ramp, o)` : `points` is a list of 2 or more positions. Use 3 or 4 for a bend.
`b.cyl(a, c, r0, r1, ramp, o)` : `cap: 1` closes the `c` end, `cap: 2` closes both.
`b.box(centre, [hx, hy, hz], ramp, o)`
`b.torus(centre, axis, R, r, ramp, o)` : `axis` is the direction the hole faces, `[0, 1, 0]` for a ring lying flat. `a0`, `a1` make a partial ring.
`b.fill(centre, normal, r, ramp, o)` : flat disc facing `normal`.
`b.stroke(p, direction, halfLength, width, ramp, o)` : one blade or spike starting at `p`.
`b.mote(p, size, ramp, o)` : one round dot.

## Building a creature from primitives

1. Body: one or two overlapping `b.ellipsoid` calls.
2. Limbs: `b.tube` from a point inside the body to a point on the ground (`base.topY(x, z) + 0.02`).
3. Head features on the `+z` side so the creature faces the front: `K.eye` twice, mirrored in `x`.
4. Make left and right different sizes somewhere (one bigger claw, one bent ear).
5. Parts must overlap their neighbours. A gap makes the checker report a floating piece.

## Using the outputs in a game

- `sprites.png`: columns are directions (see `yawDegrees` in `sprites.json`), rows are animation frames. Draw with nearest-neighbour filtering.
- `<name>.ply`: loads in standard gaussian splat viewers and engine plugins. Y is up. Standard viewers draw soft-edged splats, so it looks smoother than the pixel render.
- For the exact pixel look at runtime, `lib/core.js` is a dependency-free renderer that runs in a browser or Node: `new Renderer(w, h).draw(scene, { yaw, pitch: 0.48, scale: w / 2.55 }, timeSeconds)` returns RGBA pixels. `viewer.html` shows how to load a scene into it.
