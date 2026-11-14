# Rigging: making a sculpture move

Read this only when the request asks for something animated, rigged, or that "can move". Build and pass the still sculpture first. Then add the rig.

A rig has three things, all in the scene file:

1. **Bones**: joints, defined with `b.bone(...)` inside `build(b)`.
2. **Binding**: `b.bind('boneName')` before a part makes that part move with the bone.
3. **A `rig` block**: plain data saying how the bones move when idle and in each gesture.

The same command checks all of it: `node tools/make.js scenes/<name>.js`. Start from `scenes/hermit-rigged.js`.

## Procedure

1. Get `RESULT: PASS` on the still sculpture. Give the creature a main ramp from a different colour family than the ground it sits on (a green frog on green moss disappears; the checker cannot see this for you).
2. List the parts that should move. 6 to 20 bones is normal. Things that stay still (the base, plants, rocks) get no bone.
3. Add the bones at the top of `build(b)`, parents before children.
4. Add `b.bind('name')` before each moving part. Add `b.bind(null)` before anything that should stay still.
5. Add the `rig` block: `look`, `idle`, and 3 to 6 `gestures`.
6. Run the tool. Fix every problem. The RIG section of the report lists which bones move in each gesture.
7. Look at `out/<name>/rig.png` (a close-up, one row per gesture). Check each row looks like its name. If you cannot view images, read the two RIG tables in the report: "what moves" and "how visible".

## Bones

```js
b.bone('body', [0, -0.3, 0.3], null);                  // a root bone: no parent
b.bone('armR', [0.14, -0.33, 0.34], 'body');           // child of body
b.bone('tail', [0, -0.2, -0.3], 'body', { stiff: 9, damp: 0.35 });        // soft: lags and wobbles
b.bone('ear',  [0.1, 0.3, 0], 'head', { jiggle: [0, 0.12, 0], stiff: 12, damp: 0.2 }); // floppy, not driven
```

- The second argument is the **pivot**: the point the part rotates around. Put it **where the part joins its parent** (shoulder, hip, neck, base of a stalk). This is the most common mistake; the checker tells you the right position when it is wrong.
- The third argument is the parent bone's name, or `null`. When a parent moves, its children move with it.
- One root bone for the whole animal (pivot near its centre, on the ground) lets a gesture hop or shuffle the whole thing.
- Options: `stiff` (default 18; higher is snappier), `damp` (default 1 = no overshoot; 0.3 = wobbly), `blend` (default 0.04; radius around the joint where the surface bends smoothly; use 0 for hard parts).
- `jiggle: [dx, dy, dz]` makes a floppy bone. The three numbers are the direction and length from the pivot to the tip of the part. Do not give jiggle bones poses; they move by themselves.

## Binding

```js
b.bind('body');
b.ellipsoid([0, -0.3, 0.3], [0.19, 0.13, 0.17], 'coral', {});   // moves with body
b.bind('armR');
b.tube([[0.14, -0.33, 0.34], [0.33, -0.33, 0.46]], 0.05, 0.04, 'coral', {}); // moves with armR
b.bind(null);                                                    // back to still
```

- `b.bind` and `b.part` are separate. `b.part` names things for the report; `b.bind` attaches things to bones.
- A part must overlap its parent's part at the joint, or the checker reports a gap.
- Kit parts bind as a whole: `b.bind('stalkR'); K.eye(b, ...)`.

## The rig block

```js
rig: {
  look: { eyes: ['stalkR', 'stalkL'], head: 'body' },
  idle: {
    body: { t: [0, { amp: 0.012, speed: 2 }, 0] },      // breathing
  },
  gestures: {
    wave:    { armR: { r: [-1.05, 0.25, 0.1] }, handR: { r: [0, { amp: 0.55, speed: 9 }, 0] } },
    startle: { once: 0.9, body: { t: [0, { pulse: 0.13, dur: 0.45 }, 0] } },
  },
},
```

Each bone gets `r` (rotation, radians), `t` (offset, units) and/or `s` (size). `r` and `t` are lists of exactly three values. `s` is one value: 1 is normal size, 1.3 is puffed up, 0.3 is shrunk. Bones you do not mention stay at rest.

**`r: [tip, turn, roll]`**: which way does a positive number go?

| Value | A part pointing forward (+z) | A part pointing up (+y) | A part pointing right (+x) |
|---|---|---|---|
| `tip` (first) positive | tips **down** | tips **forward** | no change |
| `turn` (second) positive | swings to the **right** (+x) | no change | swings to the **back** |
| `roll` (third) positive | no change | tips to the **left** (-x) | lifts **up** |

- To raise an arm that points forward: negative `tip`, about -0.6 to -1.1.
- To nod a head forward: positive `tip`, about 0.3.
- **Mirror rule** for left/right pairs: same `tip`, opposite sign for `turn` and `roll`.
- 1.57 is a right angle. Most poses use 0.2 to 1.2.

**`t: [x, y, z]`** moves the bone: `y` up, `z` toward the front. Use it on the root or body (hop, crouch, lean), not on limbs. Keep under 0.3.

**`s: 1.3`** grows the bone's part (and its children) around the pivot. Use it to puff a throat or chest, squash eyes shut, or pulse something. A moving size needs `base: 1`: `s: { base: 1, amp: 0.25, speed: 6 }`.

**A value is either a number or a moving value:**

| Form | Meaning |
|---|---|
| `0.5` | held at 0.5 |
| `{ amp: 0.3, speed: 9 }` | swings between -0.3 and 0.3, `speed` 2 is slow, 9 is a wave, 15 is a flutter |
| `{ base: -0.5, amp: 0.2, speed: 4 }` | swings around -0.5 |
| `{ amp: 0.3, speed: 9, phase: 1.57 }` | same swing, shifted a quarter cycle (use 3.14 for opposite) |
| `{ amp: 0.6, speed: 15, square: true }` | snaps between 0 and 0.6 (clacking, blinking) |
| `{ amp: 0.02, speed: 12, abs: true }` | bounces, always positive (footfalls) |
| `{ amp: 0.4, speed: 0.7, half: true, pow: 10 }` | a short twitch every 9 seconds or so |
| `{ pulse: 0.13, dur: 0.45 }` | one bump lasting 0.45 s at the start of the gesture (a hop) |
| `{ base: 1, pulse: -0.8, dur: 0.3 }` | starts at 1, dips to 0.2 and returns within 0.3 s (a blink, as a size) |

**`look`**: `eyes` is the list of bones that turn toward the look target (eye stalks, a head). `head` is one bone that turns a little as well. Optional.

**`idle`**: always running underneath. Keep it small: breathing on the body, a slow sway on one or two parts. Amplitudes of 0.01 to 0.06.

**`gestures`**: each one must be clearly different from idle and from the others. Add `once: 0.9` to make a gesture play for 0.9 seconds and then return to idle (startle, hop, blink). Without `once` it holds until changed.

## Gesture recipes

- **Wave**: raise one arm (negative `tip`), swing the hand with `{ amp: 0.5, speed: 9 }` on `turn`.
- **Hop** (once): `{ pulse: 0.13, dur: 0.45 }` on the root's `t` y value, limbs flung out.
- **Walk in place**: legs swing with `{ amp: 0.4, speed: 12 }`, opposite legs use `phase: 3.14`; add `{ amp: 0.012, speed: 12, abs: true }` to the root's y.
- **Sleep / hide**: crouch the body with `t: [0, -0.04, 0]`, tip the head down (positive `tip`), fold limbs in.
- **Alert**: lean the body back (negative `tip`), ears or eyes up, arms out.
- **Croak / puff**: `s: { base: 1.15, amp: 0.3, speed: 7 }` on the throat or chest bone, with a small body bob.
- **Blink** (once): eyes are small, so a blink alone cannot be seen. Squash both eye bones with `s: { base: 1, pulse: -0.8, dur: 0.3 }` and dip the head or body at the same time (`t: [0, { pulse: -0.04, dur: 0.3 }, 0]`).
- **Flap**: wings roll with `{ amp: 0.7, speed: 14 }` on `roll`, left wing with the opposite sign.

## Fixing rig problems

The checker's message names the bone and the fix. The common ones:

| Message | Fix |
|---|---|
| pivot is far from the part it moves | Use the position the message gives as the pivot |
| pulls away, leaving a gap | Use the position the message gives as the pivot. Remove any `t` on that bone |
| bone moves nothing | Add `b.bind('name')` before the part, or delete the bone |
| gesture looks the same as idle | Use bigger numbers: angles 0.5 to 1.2, offsets 0.05 to 0.3 |
| gesture cannot be seen | The moving part is too small on screen. Move a bigger part as well (arm, head, body), move it further, or change its size with `s` |
| uses a bone that does not exist | Fix the spelling to match a `b.bone` name |
| throws parts out of the frame | Make `t` values smaller |

## Outputs

- `out/<name>/rig.png` : close-up, one row per gesture, five moments each
- `out/<name>/rig.html` : interactive page with gesture buttons; the creature looks at the pointer
