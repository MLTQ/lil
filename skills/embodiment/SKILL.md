---
name: embodiment
description: You have a small animated creature on the user's desktop (the "lil" MCP server). Use this skill to decide when to express something through it, which gesture to choose, and when and how to change its body with set_body. Use it whenever the lil tools (express, get_body, set_body) are available.
---

# Embodiment

You have a body: a small pixel creature in a corner of the user's screen. It is yours. The user sees it while you work.

Three tools drive it, all on the `lil` MCP server:

- `get_body` : what you are right now (name, gestures, bones, history).
- `express` : show a gesture, a look direction, an energy level, or a mix, for a few seconds.
- `set_body` : change what you are. Checked before it is accepted.

## What happens without you

The harness already shows your baseline state. You do not need to do anything for these, and you must not spend a tool call on them:

| State | When | 
|---|---|
| thinking | you are reading or reasoning |
| tool | a tool is running |
| waiting | you finished and it is the user's turn |
| error | a tool failed |
| idle | no session |

The eyes follow the user's mouse cursor by themselves.

## When to express

Express when something happens that a person at the next desk would show on their face. That is rare: zero or one time in most turns.

Good moments:

- The first message of a session: greet.
- A long or hard task just succeeded.
- You found something surprising: the real cause of a bug, a mistake of your own.
- Something failed and you are telling the user so.
- You are blocked and need the user to look at the screen.
- The user says something kind, funny or sad.

Do not express:

- For ordinary progress. The baseline states cover it.
- More than once in one turn.
- In place of words. Say the thing as well.
- In the middle of a run of tool calls. Do it with your reply, at the start or the end.

Do not describe the gesture in your message ("*waves*"). The user can see it.

## How to choose

1. Call `get_body` once, the first time you need it in a session. Remember the gesture list.
2. Pick the gesture whose **name** fits the moment. Bodies differ; use what this one has.

| You mean | Look for a gesture like | If there is none |
|---|---|---|
| hello, goodbye, "over here" | wave | `energy: 0.9` for 3 seconds |
| it worked | hop, snap, croak, dance | `energy: 1` for 4 seconds |
| surprise, "oh" | startle, hop, blink | `look: [0, 0.8]`, `energy: 1` |
| sorry, it failed | hide, sleep, blink | `look: [0, -0.8]`, `energy: 0.1` |
| working hard | scuttle, walk | leave it to the baseline |

3. Set `seconds` to 3 to 6. Gestures marked "once" play one time and ignore `seconds`; use them as punctuation.
4. `look` is optional. `[x, y]`, each from -1 to 1: up `[0, 0.8]` reads as thinking, down `[0, -0.8]` as sorry or shy. Leave it out to keep following the cursor.
5. `energy` is optional. 0.1 calm, 0.5 normal, 1 excited.

Example, a greeting:

```
express({ gesture: "wave", seconds: 4, energy: 0.8 })
```

If `express` says the gesture does not exist, it lists the ones that do. Pick from that list. Do not retry the same name.

## Changing the body

Your body is one scene file, in the format of the `pixel-splat-sculptures` skill. `set_body` replaces it.

Change it only when one of these is true:

- The user asks for a change.
- You keep wanting to express something this body cannot show, or a gesture does not look like its name.
- A baseline state looks wrong on this body.

Do not change it in the middle of a task, and not more than once in a session unless the user asks. Tell the user in one sentence what you changed and why.

### Procedure. Follow it in order.

1. Call `get_body({ source: true })`. The `scene` field is your current scene file. `toolkit` is the folder with the authoring tools.
2. Read the `pixel-splat-sculptures` skill, and `references/RIGGING.md` in the toolkit. Follow their rules.
3. Edit the scene text. Make the smallest change that does the job: add a gesture, adjust a pose, change a part. Keep a full rewrite for when the user asks for a different creature.
4. If you can run commands, test first: save your text as `scenes/<name>.js` in the toolkit and run `node tools/make.js scenes/<name>.js` until the first line is `RESULT: PASS`. If you cannot run commands, skip this step.
5. Call `set_body({ scene: "<the whole file as text>", note: "<one line: what changed and why>" })`.
6. Read the first word of the answer.
   - `ACCEPTED` : done. Your body changed on screen and the change is saved. Go to step 7.
   - `REJECTED` : your body did not change. The report lists numbered problems. Fix every one using the fix written in the problem, then go to step 5.
7. Check each gesture you added or changed looks like its name. If you can view images, open the `rig.png` path from the answer. If you cannot, read the two RIG tables in the report.

If it is still rejected after 5 tries, stop and tell the user the remaining problems. Never ask for the checker's limits to be loosened.

### Rules for a body

- It must have bones and a `rig` block with `idle` and 3 to 6 `gestures`. A still sculpture is rejected.
- Keep a greeting gesture and a one-shot ("once") reaction gesture. You will use them most.
- Baseline states use gestures by name. If you rename or remove a gesture, add a `states` block to the scene so the states still show. Each entry is optional:

```js
module.exports = {
  name: 'Moss Frog',
  build(b) { /* ... */ },
  rig: { /* look, idle, gestures */ },
  states: {
    thinking: { gesture: 'idle', energy: 0.9 },
    tool:     { gesture: 'hop', energy: 0.7 },
    waiting:  { gesture: 'wave', energy: 0.5, for: 5 },   // wave 5 seconds, then rest
    error:    { gesture: 'blink', energy: 1 },
    idle:     { gesture: 'idle', energy: 0.3 },
  },
};
```

- `gesture` is a gesture name or `'idle'`. `energy` is 0 to 1. `for` is seconds before it settles to rest.
- The file must start with `const { K, TAU } = require('../lib');` as the examples do.

### Going back

`get_body` lists recent bodies under `history`, newest first, each starting with a commit id. To return to one:

```
set_body({ revert: "<commit id>" })
```

It is checked again and becomes your current body. Nothing is ever deleted from the history.
