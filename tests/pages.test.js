// Tests de l'envoi des pages en images (src/deckpack.js), sans écran branché.
// Lancer : node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

function loadPack(extra) {
  const ctx = Object.assign({
    ui: {}, cfg: { look: { accent: '#FFB547' } }, console, TextEncoder,
    isSoundboard: (s) => s && s.layout === 'soundboard',
    shortcutById: (id) => id === 'sc1' ? { id: 'sc1', keys: 'Ctrl+Shift+M' } : null,
    homePages: () => 1, homeSpaces: () => [], lookFor: () => ({ accent: '#00FF00' }),
    render() {}, toast() {}
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'deckpack.js'), 'utf8') +
    '\nObject.assign(this, { keyCombo, pgZone, pgCellAction, pgBuildPack, crc32, pgList, Z, MODE });', ctx);
  return ctx;
}

test('touches : combinaisons du logiciel → codes USB', () => {
  const c = loadPack();
  assert.deepStrictEqual({ ...c.keyCombo('Ctrl+Shift+A') }, { mods: 3, code: 0x04 });
  assert.deepStrictEqual({ ...c.keyCombo('F13') }, { mods: 0, code: 0x68 });
  assert.deepStrictEqual({ ...c.keyCombo('Control+F24') }, { mods: 1, code: 0x73 });   // touches réservées
  assert.deepStrictEqual({ ...c.keyCombo('Alt+Win+Espace') }, { mods: 12, code: 0x2C });
  assert.deepStrictEqual({ ...c.keyCombo('Pavé5') }, { mods: 0, code: 0x5D });
  assert.strictEqual(c.keyCombo('Ctrl+§'), null);
  assert.strictEqual(c.keyCombo(''), null);
});

test('zones : chaque sorte de case fait la bonne chose', () => {
  const c = loadPack();
  const space = { id: 's1', name: 'Vol', pages: [{ cells: [] }, { cells: [] }] };
  const keyIndex = { 'home:0': 0, 'space:s1:0': 1, 'space:s1:1': 2 };
  const it = { kind: 'space', space, page: 0 };
  const cells = space.pages[0].cells;
  cells[0] = { name: 'Train', action: { type: 'joy', button: 7 }, behavior: { mode: 'toggle', holdMs: 1500 } };
  cells[1] = { name: 'Muet', action: { type: 'media', media: 'muet' }, behavior: { mode: 'tap' } };
  cells[2] = { name: 'OBS', action: { type: 'obs', op: 'scene', hotkey: 'Shift+F14' }, behavior: { mode: 'hold', holdMs: 2000 } };
  cells[3] = { name: 'Page 2', action: { type: 'page', page: 1 } };
  cells[4] = { name: 'Discord', action: { type: 'discord', op: 'raccourci', arg: 'sc1' } };
  cells[5] = { name: 'Son', action: { type: 'sound', mode: 'hold', route: 'fixed' } };
  cells[6] = { name: 'Bizarre', action: { type: 'key', keys: 'Ctrl+§' } };
  const r = (i) => ({ x: 10, y: 20, w: 100, h: 90, radius: 12, data: { simcell: String(i) } });
  const warn = [];
  const z = (i) => c.pgZone(it, r(i), keyIndex, warn);
  assert.strictEqual(z(0).kind, c.Z.manette); assert.strictEqual(z(0).v1, 7); assert.strictEqual(z(0).mode, c.MODE.toggle);
  assert.strictEqual(z(1).kind, c.Z.media); assert.strictEqual(z(1).v1, 0xE2);
  assert.strictEqual(z(2).kind, c.Z.touche); assert.strictEqual(z(2).v1, 2); assert.strictEqual(z(2).v2, 0x69); assert.strictEqual(z(2).hold, 2000);
  assert.strictEqual(z(3).kind, c.Z.page); assert.strictEqual(z(3).v1, 2);
  assert.strictEqual(z(4).kind, c.Z.touche); assert.strictEqual(z(4).v1, 3);
  const s = z(5);
  assert.strictEqual(s.kind, c.Z.message);
  assert.deepStrictEqual(JSON.parse(s.down), { t: 'sound', space: 's1', page: 0, cell: 5, down: true });
  assert.deepStrictEqual(JSON.parse(s.up), { t: 'sound', space: 's1', page: 0, cell: 5, down: false });
  assert.strictEqual(z(6), null); assert.strictEqual(warn.length, 1);
  assert.strictEqual(z(9), null);   // case vide
  // navigation : bouton Accueil, onglets, cartes de l'accueil ; lecteur ; clips
  assert.strictEqual(c.pgZone(it, { x: 0, y: 0, w: 50, h: 50, data: { sim: 'home' } }, keyIndex, warn).v1, 0);
  assert.strictEqual(c.pgZone(it, { x: 0, y: 0, w: 50, h: 50, data: { sim: 'page', i: '1' } }, keyIndex, warn).v1, 2);
  assert.strictEqual(c.pgZone({ kind: 'home', page: 0 }, { x: 0, y: 0, w: 50, h: 50, data: { sim: 'space', id: 's1' } }, keyIndex, warn).v1, 1);
  assert.strictEqual(c.pgZone(it, { x: 0, y: 0, w: 50, h: 50, data: { simbtn: 'play' } }, keyIndex, warn).v1, 0xCD);
  assert.strictEqual(JSON.parse(c.pgZone(it, { x: 0, y: 0, w: 50, h: 50, data: { simclip: 'rec' } }, keyIndex, warn).down).op, 'rec');
  // arrondi limité à la moitié de la case
  assert.strictEqual(c.pgZone(it, { x: 0, y: 0, w: 40, h: 40, radius: 500, data: { sim: 'home' } }, keyIndex, warn).radius, 20);
});

test('paquet : en-tête, pages, zones, textes et images à la bonne place', () => {
  const c = loadPack();
  const j1 = new Uint8Array([0xFF, 0xD8, 1, 2, 3, 0xFF, 0xD9]);
  const j2 = new Uint8Array([0xFF, 0xD8, 9, 0xFF, 0xD9]);
  const msg = '{"t":"clip","op":"clip"}';
  const pack = c.pgBuildPack([
    { jpeg: j1, accent: '#FFB547', zones: [{ x: 1, y: 2, w: 3, h: 4, radius: 5, kind: 4, mode: 0, hold: 1500, v1: 1, v2: 0, down: null, up: null }] },
    { jpeg: j2, accent: '#00AAFF', zones: [
      { x: 10, y: 20, w: 30, h: 40, radius: 6, kind: 5, mode: 0, hold: 0, v1: 0, v2: 0, down: msg, up: null },
      { x: 11, y: 21, w: 31, h: 41, radius: 6, kind: 5, mode: 0, hold: 0, v1: 0, v2: 0, down: msg, up: null }
    ] }
  ]);
  const b = Buffer.from(pack);
  assert.strictEqual(b.toString('latin1', 0, 4), 'DECK');
  assert.strictEqual(b.readUInt16LE(4), 1);
  assert.strictEqual(b.readUInt16LE(6), 2);
  const strOff = b.readUInt32LE(8), strLen = b.readUInt32LE(12), total = b.readUInt32LE(16);
  assert.strictEqual(total, b.length);
  assert.strictEqual(strOff, 24 + 2 * 20 + 3 * 28);
  assert.strictEqual(strLen, Buffer.byteLength(msg) + 1, 'texte identique gardé une seule fois');
  // page 2 : 2 zones à partir de la zone n° 1, couleur, image
  const p2 = 24 + 20;
  const jo = b.readUInt32LE(p2), jl = b.readUInt32LE(p2 + 4);
  assert.strictEqual(b.readUInt32LE(p2 + 8), 1);
  assert.strictEqual(b.readUInt16LE(p2 + 12), 2);
  assert.strictEqual(b.readUInt32LE(p2 + 16), 0x00AAFF);
  assert.deepStrictEqual([...b.subarray(jo, jo + jl)], [...j2]);
  assert.strictEqual(jo % 4, 0);
  // zone n° 1
  const z1 = 24 + 40 + 28;
  assert.deepStrictEqual([b.readUInt16LE(z1), b.readUInt16LE(z1 + 2), b.readUInt16LE(z1 + 4), b.readUInt16LE(z1 + 6)], [10, 20, 30, 40]);
  assert.strictEqual(b[z1 + 8], 5);
  assert.strictEqual(b.readUInt32LE(z1 + 20), 0);
  assert.strictEqual(b.readUInt32LE(z1 + 24), 0xFFFFFFFF);
  assert.strictEqual(b.toString('utf8', strOff, strOff + Buffer.byteLength(msg)), msg);
  assert.strictEqual(b[strOff + Buffer.byteLength(msg)], 0);
  assert.strictEqual(b.readUInt32LE(z1 + 28 + 20), b.readUInt32LE(z1 + 20), 'même texte partagé');
});

test('paquet : somme de contrôle identique à celle de zlib (et de l’écran)', () => {
  const c = loadPack();
  const data = Buffer.from(Array.from({ length: 70000 }, (_, i) => (i * 31) & 255));
  assert.strictEqual(c.crc32(new Uint8Array(data)), zlib.crc32 ? zlib.crc32(data) : c.crc32(new Uint8Array(data)));
  assert.strictEqual(c.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  // en plusieurs morceaux, comme l'écran
  const a = c.crc32(new Uint8Array(data.subarray(0, 1000)));
  assert.strictEqual(c.crc32(new Uint8Array(data.subarray(1000)), a), c.crc32(new Uint8Array(data)));
});

test('liste des pages : accueil d’abord, puis chaque page des espaces de l’accueil', () => {
  const s1 = { id: 'a', pages: [{}, {}] }, s2 = { id: 'b', pages: [{}] };
  const c = loadPack({ homePages: () => 2, homeSpaces: () => [s1, s2] });
  assert.deepStrictEqual([...c.pgList().map(x => x.key)], ['home:0', 'home:1', 'space:a:0', 'space:a:1', 'space:b:0']);
});

test('programme de l’écran : format du paquet identique des deux côtés', () => {
  const src = fs.readFileSync(path.join(ROOT, 'firmware', 'main', 'pages.c'), 'utf8');
  assert.match(src, /sizeof\(pack_hdr_t\) == 24/);
  assert.match(src, /sizeof\(pack_page_t\) == 20/);
  assert.match(src, /sizeof\(pack_zone_t\) == 28/);
  assert.match(src, /enum \{ Z_RIEN, Z_TOUCHE, Z_MANETTE, Z_MEDIA, Z_PAGE, Z_MESSAGE \}/);
  assert.match(src, /enum \{ M_APPUI, M_MAINTENIR, M_BASCULE \}/);
  const c = loadPack();
  assert.deepStrictEqual({ ...c.Z }, { rien: 0, touche: 1, manette: 2, media: 3, page: 4, message: 5 });
  assert.deepStrictEqual({ ...c.MODE }, { tap: 0, hold: 1, toggle: 2 });
});
