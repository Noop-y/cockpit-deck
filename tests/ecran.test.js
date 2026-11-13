// Tests du programme de l'écran et de son installation (sans écran branché).
// Lancer : node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// charge src/flasher.js comme dans le logiciel, avec le strict nécessaire autour
function loadFlasher() {
  const ctx = {
    ui: { view: 'appareil' }, ACTIONS: {}, console, window: {},
    esc: (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    render() {}, toast() {}, api: { fwInfo: async () => null, fwRead: async () => null }, deckLink: { port: null }, deckClose: async () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'flasher.js'), 'utf8') + '\nthis.fwFileFor = fwFileFor; this.flasherPanel = flasherPanel;', ctx);
  return ctx;
}

test('installation : le bon fichier selon la version de la puce', () => {
  const c = loadFlasher();
  const info = { version: '0.1.0', files: { rev3: { file: 'ecran-rev3.bin' }, rev1: { file: 'ecran-rev1.bin' } } };
  assert.strictEqual(c.fwFileFor(info, 300).file, 'ecran-rev3.bin');   // puce v3.0
  assert.strictEqual(c.fwFileFor(info, 301).file, 'ecran-rev3.bin');   // v3.1
  assert.strictEqual(c.fwFileFor(info, 103).file, 'ecran-rev1.bin');   // v1.3
  assert.strictEqual(c.fwFileFor(info, 100).file, 'ecran-rev1.bin');   // v1.0
  assert.ok(c.ACTIONS['fw-install'], 'action fw-install');
});

test('installation : panneau de la page Appareil', () => {
  const c = loadFlasher();
  c.ui.fw.info = false;   // logiciel lancé sans le programme de l'écran (npm start)
  let h = c.flasherPanel();
  assert.match(h, /seulement dans celle fabriquée par GitHub/);
  assert.match(h, /data-act="fw-install" disabled/);
  c.ui.fw.info = { version: '0.1.0', files: {} };
  c.ui.fw.state = 'write'; c.ui.fw.pct = 42;
  h = c.flasherPanel();
  assert.match(h, /0\.1\.0/);
  assert.match(h, /width:42%/);
  assert.match(h, /Installation en cours/);
  c.ui.fw.state = 'err'; c.ui.fw.msg = 'MANUEL'; c.ui.fw.portId = '1A86:55D3';
  h = c.flasherPanel();
  assert.match(h, /BOOT/); assert.match(h, /RESET/); assert.match(h, /1A86:55D3/);
  c.ui.fw.state = 'err'; c.ui.fw.msg = '<b>x</b>';
  h = c.flasherPanel();
  assert.ok(!h.includes('<b>x</b>'), 'message échappé');
});

test('programme de l’écran : table des partitions dans 32 Mo, sans trou ni chevauchement', () => {
  const rows = fs.readFileSync(path.join(ROOT, 'firmware', 'partitions.csv'), 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(',').map(x => x.trim()));
  let end = 0x9000;
  for (const [name, , , off, size] of rows) {
    const o = parseInt(off, 16), s = parseInt(size, 16);
    const isApp = rows.find(r => r[0] === name)[1] === 'app';
    if (isApp) {
      assert.ok(o >= end && o - end < 0x10000, `${name} après la précédente (trou d'alignement seulement)`);
      assert.strictEqual(o % 0x10000, 0, `${name} aligné sur 64 Ko`);
    } else assert.strictEqual(o, end, `${name} commence juste après la précédente`);
    end = o + s;
  }
  assert.ok(end <= 32 * 1024 * 1024, 'tient dans 32 Mo');
  const apps = rows.filter(r => r[1] === 'app').map(r => r[0]);
  assert.deepStrictEqual(apps, ['ota_0', 'ota_1'], 'deux emplacements pour les mises à jour');
});

test('programme de l’écran : numéro de version lisible', () => {
  const v = fs.readFileSync(path.join(ROOT, 'firmware', 'version.txt'), 'utf8').trim();
  assert.match(v, /^\d+\.\d+\.\d+$/);
});
