// Tests du découpage des sons (src/soundcut.js), sans son ni fenêtre.
// Lancer : node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = { ACTIONS: {}, SOUND: { onChange() {}, isPlaying: () => false }, ui: {}, cfg: { audio: {} }, console, document: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'soundcut.js'), 'utf8') + '\nObject.assign(this, { cutFmt, cutClamp, cutPeaks });', ctx);
  return ctx;
}

test('découpe : temps lisibles', () => {
  const c = load();
  assert.strictEqual(c.cutFmt(0), '0:00,00');
  assert.strictEqual(c.cutFmt(3.5), '0:03,50');
  assert.strictEqual(c.cutFmt(62.35), '1:02,35');
});

test('découpe : le passage reste dans le son et dure au moins 0,1 s', () => {
  const c = load();
  const j = (o) => JSON.parse(JSON.stringify(o));
  assert.deepStrictEqual(j(c.cutClamp(0, null, 10)), { start: 0, end: 10 });          // son entier
  assert.deepStrictEqual(j(c.cutClamp(2, 5, 10)), { start: 2, end: 5 });
  assert.deepStrictEqual(j(c.cutClamp(-1, 50, 10)), { start: 0, end: 10 });           // hors du son
  assert.deepStrictEqual(j(c.cutClamp(4, 4, 10)), { start: 4, end: 4.1 });            // trop court
  assert.deepStrictEqual(j(c.cutClamp(10, null, 10)), { start: 9.9, end: 10 });       // début tout au bout
  assert.deepStrictEqual(j(c.cutClamp(1.23456, 2.98765, 10)), { start: 1.23, end: 2.99 });
});

test('découpe : forme du son (niveaux par colonne, le plus fort vaut 1)', () => {
  const c = load();
  const rate = 1000, d = new Float32Array(4000);           // 4 s : silence, puis fort, puis moyen
  for (let i = 1000; i < 2000; i++) d[i] = i % 2 ? 0.8 : -0.8;
  for (let i = 3000; i < 4000; i++) d[i] = 0.4;
  const p = Array.from(c.cutPeaks([d], rate, 0, 4, 4));
  assert.deepStrictEqual(p.map(v => Math.round(v * 100) / 100), [0, 1, 0, 0.5]);
  const z = Array.from(c.cutPeaks([d], rate, 1, 2, 10));  // zoom sur la 2e seconde
  assert.ok(z.every(v => v === 1));
});
