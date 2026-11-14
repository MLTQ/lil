// Entry point for scene files:  const { K, E, WAVE, DRIFT, TAU } = require('../lib');
const S = require('./core.js');
const palettes = require('./palettes.js');
const K = require('./kit.js');
const { Rig, makeController } = require('./rig.js');

// Turn a scene module ({ name, seed, bg, meta, ramps, build }) into a packed scene.
function load(def) {
  if (!def || typeof def.build !== 'function') throw new Error('The scene file must export an object with a build(b) function. Copy scenes/_template.js.');
  const b = new S.Builder(def.seed || 1, Object.assign({}, palettes, def.ramps || {}));
  def.build(b);
  if (!b.S.length) throw new Error('build(b) added nothing. Call kit functions such as K.floatingIsland(b).');
  const meta = Object.assign({}, def.meta || {});
  meta.name = def.name || 'Untitled';
  meta.bg = S.hex(def.bg || '#08080e');
  if (meta.drift) meta.drift = Object.assign({ range: 1.6, speed: 0.05, dir: 1 }, meta.drift);
  const sc = b.pack(meta);
  if (def.rig) sc.rig = def.rig;
  if (sc.bones.length) sc.controller = def.controller || makeController(def.rig);
  return sc;
}

module.exports = { K, palettes, load, Rig, makeController, Builder: S.Builder, Renderer: S.Renderer, TAU: S.TAU, E: S.E, WAVE: S.WAVE, DRIFT: S.DRIFT, LIGHT: S.LIGHT };
