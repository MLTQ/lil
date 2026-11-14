---
name: pixel-splat-sculptures
description: Make small 3D pixel-art sculptures (floating islands, shrines, creatures, props) as game assets, built from gaussian splats by writing a short JavaScript scene file and running a checker. Use when asked for a pixel splat, a splat sculpture, a pixel-art diorama, or game sprites of a small 3D object.
---

# Pixel splat sculptures

You make a sculpture by writing one small JavaScript file that places prefab parts. A tool then builds it, checks it, tells you in plain text what to fix, and exports the game assets. You never draw pixels and you never edit the files in `lib/` or `tools/`.

Requirements: Node.js 16 or newer. No packages to install.

Work inside this folder so that `scenes/`, `lib/` and `tools/` sit side by side. If this folder is read-only, copy the whole folder to your working directory first and work in the copy. `examples/` holds finished renders of the four example scenes, to show the quality to aim for.

## The procedure. Follow it in order.

1. **Write the brief.** Fill in the six lines under "Brief" below. Do this before any code.
2. **Copy the closest example** from `scenes/` to `scenes/<new-name>.js`. Never start from a blank file.
   - floating nature piece: `sporecap-isle.js`
   - building or monument: `lantern-gate.js`
   - dark piece with glow: `ember-shrine.js`
   - animal or creature: `tidepool-hermit.js`
   - animal or creature that must move: `hermit-rigged.js` (then also follow "Making it move" below)
3. **Edit the copy** to match the brief. Change the name, the base, the hero, the supporting pieces, the dressing and the motes.
4. **Run the tool:** `node tools/make.js scenes/<new-name>.js`
5. **Read the first line of the output.**
   - `RESULT: PASS` : go to step 6.
   - `RESULT: BUILD ERROR` : the message names the scene line. Fix that line. Go to step 4.
   - `RESULT: FIX n PROBLEMS` : fix every numbered problem using the fix written in the problem. Go to step 4.
6. **Look at the result.** If you can view images, open `out/<new-name>/sheet.png`. If you cannot, read the two text pictures in the report. Check the four points under "Final look". Fix anything wrong and go to step 4.
7. **Stop.** Report the name, the splat count and the output folder. Do not keep polishing after a pass.

If the piece still fails after 5 runs, stop and report the remaining problems. Do not loosen the checker.

## Brief

Write these six lines first.

```
Subject:   one sentence. Example: "A ruined lighthouse on a sea rock."
Base:      one of floatingIsland, rockOutcrop, sandbar, slab
Hero:      the one big thing. 0.6 to 0.9 tall. It is what the piece is "of".
Support:   2 to 6 smaller things, each a different size
Ramps:     5 to 9 names from the ramp table. Exactly one or two GLOW ramps.
Motion:    motes rising (dir 1) or falling (dir -1), and their ramp
```

## Recipe

Every good piece has these five layers, in this order. Call `b.part('name')` before each one.

1. **Base.** Exactly one. It returns `base.topY(x, z)`, the height of the ground at that spot.
2. **Hero.** One large subject, near the centre but not exactly on it. Offset it by 0.05 to 0.15.
3. **Support.** Two to six smaller things around the hero, at clearly different sizes. Put the largest of them on the opposite side from where the hero leans. Do not place things in a mirror-image pattern.
4. **Dressing.** Small ground detail: `K.tufts`, `K.pebbles`, `K.reeds`, `K.boulder`.
5. **Motes.** One call to `K.motes`.

Rules that make the difference:

- **One glow accent.** One small glowing thing (lantern, flame, glowing mushroom or crystal, glowing motes). Not zero, and not more than about a fifth of the piece.
- **Warm against cool.** If the base is cool (snow, slate, water, moss), make the hero or the glow warm (lacquer, cap, coral, lamp, ember). If the base is warm, do the reverse.
- **Uneven silhouette.** Something tall, something that hangs below the base, things of different heights. A round lump fails the check.
- **Stand things on the ground.** For anything on the base use `y = base.topY(x, z) - 0.02`. The `- 0.02` sinks it slightly so it does not float.
- **Background.** `bg` is a very dark colour tinted toward the main ramp. Use one from the examples.

## Space and sizes

- Units: the whole piece fits in a box from -1 to 1 on every axis.
- `y` is up. `+z` is the front (toward the camera in the first sprite). `+x` is the viewer's right.
- A position is `[x, y, z]`.
- The base top is near `y = -0.3`. The tallest point should be below `y = 0.95`.
- Keep `x` and `z` of everything between -0.75 and 0.75, except motes.
- Angles are in radians. `TAU` is a full turn. A quarter turn is `TAU / 4`.
- Do not pass the `s` option unless an example does. Splat size is chosen for you.

## Kit: the parts you can use

Every call starts with `b`. Options go in a final `{ }` and all are optional. Full option lists are in `references/API.md`; read it when you need an option not shown here.

**Bases** (use one; each returns `{ topY }`)

| Call | What it is |
|---|---|
| `K.floatingIsland(b, { top: 'grass', under: 'soil' })` | Earth clod with roots hanging below |
| `K.rockOutcrop(b, { rock: 'slate', cap: 'snow' })` | Lumpy rock. `cap: null` for bare rock |
| `K.sandbar(b, { sand: 'sand', water: 'water' })` | Sand bar ringed by moving water |
| `K.slab(b, { top: 'stone', side: 'slate', drips: 'ember', dripGlow: true })` | Round platform, optional glowing drips |

**Props** (`p` is the foot position)

| Call | What it is |
|---|---|
| `K.mushroom(b, p, { h: 0.3, r: 0.17, glow: false })` | Mushroom. `glow: true` makes a small glowing one |
| `K.pine(b, p, { k: 1, snow: 'snow' })` | Conifer. `k` is scale. 0.86 tall at `k: 1` |
| `K.tree(b, p, { h: 0.7, leaf: 'leaf' })` | Round leafy tree |
| `K.crystal(b, p, { h: 0.4, glow: true, ramp: 'violet', lean: 0.2 })` | Pointed crystal |
| `K.boulder(b, p, { r: 0.2, cap: 'snow' })` | Rock. `p` is its centre |
| `K.column(b, p, { h: 0.6, broken: false })` | Stone column. Returns `{ top }` |
| `K.gate(b, p, { w: 0.42, h: 0.82, cap: 'snow' })` | Two-post gate. Returns `{ hang }` |
| `K.lantern(b, hangPoint, { tassel: 'lacquer' })` | Glowing lantern hanging from a point |
| `K.steps(b, p, { n: 3 })` | Steps going down toward the front |
| `K.flame(b, p, { h: 0.14 })` | Flickering flame |
| `K.vine(b, pointA, pointB, { sag: 0.12 })` | Hanging vine between two points |
| `K.spiralShell(b)` | Conch shell at the origin; wrap in `b.at` to place it |
| `K.eye(b, p, { r: 0.05, look: [0, 0, 1] })` | Eyeball with pupil. `p` is its centre |

**Dressing and motion**

| Call | What it is |
|---|---|
| `K.tufts(b, base.topY, { n: 90, ramp: 'grass' })` | Grass blades over the base |
| `K.pebbles(b, base.topY, { n: 7, ramps: ['stone'] })` | Small stones or shells |
| `K.reeds(b, p, { ramp: 'leaf' })` | Clump of tall blades |
| `K.lightPool(b, p, { r: 0.24 })` | Lit patch of ground under a lamp or fire |
| `K.motes(b, { n: 45, ramp: 'aqua', glow: true })` | Drifting particles |

**Primitives**, for shapes the kit does not have (see `tidepool-hermit.js`)

| Call | What it is |
|---|---|
| `b.ellipsoid(centre, [rx, ry, rz], 'ramp', {})` | Ball or egg. A single number makes a sphere |
| `b.tube([p1, p2, p3], r0, r1, 'ramp', {})` | Limb, branch, tentacle. Radius goes from `r0` to `r1` |
| `b.cyl(a, c, r0, r1, 'ramp', { cap: 1 })` | Straight cylinder or cone from `a` to `c` |
| `b.box(centre, [hx, hy, hz], 'ramp', {})` | Box. Sizes are half-widths |
| `b.torus(centre, axis, R, r, 'ramp', {})` | Ring |
| `b.at(pos, ry, rx, rz, () => { ... })` | Move and rotate everything built inside the braces |

Add `{ f: E }` to a primitive to make it glow. Half a ball: `{ keep: (u) => u[1] > 0 }` keeps the top half.

## Ramps

A ramp is a named set of colours from dark to light. Use names only. Never write hex colours for parts.

| Group | Names |
|---|---|
| Ground and plants | grass, moss, leaf, pine, soil, root, bark, sand |
| Stone, snow, water | slate, stone, ash, snow, ice, water, foam |
| Built things | lacquer (red), blood, rust, bronze, verdigris, gold, plum, navy, ink (black) |
| Creatures and small things | cap (red-orange), coral (orange), shell (pink-purple), sea (teal), rose, pearl, bone, cream, reed, white |
| Lit ground | candlelit |
| GLOW | lamp (warm yellow), ember (fire), peach, aqua, violet, venom (green) |

Palettes that work together:

- Forest: grass, soil, root, bone, cap, cream + GLOW aqua
- Winter: slate, snow, pine, bark, lacquer, ink + GLOW lamp
- Shore: sand, water, foam, shell, sea, coral, leaf
- Ruin: slate, ash, ink, bronze, moss + GLOW ember
- Crypt: stone, ink, plum, bone, verdigris + GLOW violet
- Swamp: moss, soil, bark, reed, verdigris + GLOW venom

## Making it move

Only when the request asks for something animated, rigged or movable. Read `references/RIGGING.md` and follow its procedure. In short: pass the still sculpture first, then add bones with `b.bone`, attach parts with `b.bind`, and add a `rig` block of plain data with `idle` and 3 to 6 `gestures`. The same command checks the rig and writes `rig.png` and `rig.html`.

## Final look

After a pass, check these four things in `sheet.png` or the text pictures:

1. Can you name the subject from the front view alone? If not, make the hero bigger.
2. Is the hero the largest thing above the base? In the report's PARTS table it should have the largest share after the base.
3. Do the supporting pieces sit on the ground, not inside the hero? In the text picture their letters should appear beside the hero's letter, not only inside it.
4. Is there a glow line in MEASUREMENTS between 0.5% and 20%?

## Outputs

Everything goes to `out/<name>/`:

- `sheet.png` : four views, for review
- `sprites.png` + `sprites.json` : game sprites with a transparent background, one column per direction
- `<name>.ply` : standard 3D gaussian splat file
- `viewer.html` : turntable page, opens in any browser
- `report.txt` : the report you saw
- `rig.png`, `rig.html` : only for rigged scenes; gesture sheet and interactive page

Options: `--res 128|192|256` sprite size, `--dirs 8` number of directions, `--frames 12 --loop 8` animated frames that loop seamlessly over 8 seconds.

## Do not

- Do not edit `lib/` or `tools/`.
- Do not invent kit functions or ramp names. If it is not in the tables, build it from primitives.
- Do not use more than one base.
- Do not write loops that place more than about 12 props. Dressing calls already scatter for you.
- Do not change the checker's limits to get a pass.
