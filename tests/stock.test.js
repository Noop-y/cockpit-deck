// Tests du stock d'électronique (src/stock.js), sans fenêtre.
// Lancer : node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = { ACTIONS: {}, ui: {}, cfg: null, console, document: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'stock.js'), 'utf8') +
    '\nObject.assign(this, { stockNorm, stockNormItem, stockState, stockToggleSub, stockItemsOf, stockAll, stockCounts });', ctx);
  return ctx;
}
const J = (o) => JSON.parse(JSON.stringify(o));

test('stock : une ancienne configuration (sans stock) donne un stock vide', () => {
  const c = load();
  assert.deepStrictEqual(J(c.stockNorm(undefined)), { cats: [], history: [] });
  assert.deepStrictEqual(J(c.stockNorm({ cats: 'n’importe quoi' })), { cats: [], history: [] });
});

test('stock : les valeurs abîmées sont corrigées', () => {
  const c = load();
  const s = c.stockNorm({ cats: [{ id: 'a', name: 'Cartes', color: '#123456', sub: 1, subs: [{ id: 's', name: 'ESP32', items: [{ id: 'i', name: 'S3', q: '-4', low: '2.7', link: 'javascript:alert(1)' }] }] }, null] });
  assert.strictEqual(s.cats.length, 1);
  const cat = s.cats[0];
  assert.strictEqual(cat.color, '#FFB547', 'couleur inconnue → ambre');
  assert.strictEqual(cat.sub, true);
  assert.deepStrictEqual(J(cat.subs[0].items[0]), { id: 'i', name: 'S3', q: 0, low: 2, link: '' });
  assert.strictEqual(c.stockNormItem({ link: ' https://exemple.fr/x ' }).link, 'https://exemple.fr/x');
});

test('stock : état d’une pièce (épuisée, stock bas, ok)', () => {
  const c = load();
  assert.strictEqual(c.stockState({ q: 0, low: 0 }), 'out');
  assert.strictEqual(c.stockState({ q: 2, low: 3 }), 'low');
  assert.strictEqual(c.stockState({ q: 3, low: 3 }), 'ok');
  assert.strictEqual(c.stockState({ q: 1, low: 0 }), 'ok', 'sans seuil : jamais en stock bas');
  assert.deepStrictEqual(J(c.stockCounts([{ q: 0, low: 0 }, { q: 1, low: 5 }, { q: 9, low: 5 }])), { out: 1, low: 1 });
});

test('stock : l’interrupteur « sous-catégories » ne perd aucune pièce', () => {
  const c = load();
  const cat = { sub: false, subs: [], items: [{ id: '1', name: 'LiPo', q: 2 }, { id: '2', name: 'TP4056', q: 6 }] };
  c.stockToggleSub(cat);
  assert.strictEqual(cat.sub, true); assert.strictEqual(cat.subs.length, 1); assert.strictEqual(cat.items.length, 0);
  assert.deepStrictEqual(J(cat.subs[0].items.map(i => i.name)), ['LiPo', 'TP4056']);
  cat.subs.push({ id: 'x', name: 'Câbles', items: [{ id: '3', name: 'USB-C', q: 3 }] });
  c.stockToggleSub(cat);
  assert.strictEqual(cat.sub, false); assert.strictEqual(cat.subs.length, 0);
  assert.deepStrictEqual(J(cat.items.map(i => i.name)), ['LiPo', 'TP4056', 'USB-C']);
});

test('stock : où vont les pièces, et la liste complète avec le chemin', () => {
  const c = load();
  const st = c.stockNorm({ cats: [
    { id: 'a', name: 'Composants', sub: true, subs: [{ id: 'r', name: 'Résistances', items: [{ id: 'r1', name: '220 Ω', q: 85 }] }, { id: 't', name: 'Transistors', items: [] }] },
    { id: 'b', name: 'Alimentation', sub: false, items: [{ id: 'l', name: 'LiPo', q: 0 }] }] });
  assert.strictEqual(c.stockItemsOf(st.cats[0], 't'), st.cats[0].subs[1].items);
  assert.strictEqual(c.stockItemsOf(st.cats[0], 'inconnu'), st.cats[0].subs[0].items, 'par défaut : la première');
  assert.strictEqual(c.stockItemsOf(st.cats[1], null), st.cats[1].items);
  assert.deepStrictEqual(J(c.stockAll(st).map(x => [x.path, x.item.name])), [['Composants › Résistances', '220 Ω'], ['Alimentation', 'LiPo']]);
});

test('écran : une page par vue (catégorie, tiroir ouvert, suite de 12)', () => {
  const c = load();
  c.cfg = { stock: c.stockNorm({ cats: [
    { name: 'Composants', sub: true, subs: [{ name: 'Résistances', items: Array.from({ length: 13 }, (_, i) => ({ name: 'R' + i, q: 1 })) }, { name: 'Vide', items: [] }] },
    { name: 'Alimentation', sub: false, items: [{ name: 'LiPo', q: 0 }] }] }) };
  vm.runInContext('this.stockViews = stockViews; this.stockViewKey = stockViewKey; this.stockClampView = stockClampView;', c);
  const keys = c.stockViews().map(v => c.stockViewKey('S', v));
  assert.deepStrictEqual([...keys], ['stock:S:0:-:0', 'stock:S:0:0:0', 'stock:S:0:0:1', 'stock:S:0:1:0', 'stock:S:1:-:0']);
  assert.deepStrictEqual(J(c.stockClampView({ cat: 9, sub: 5, part: 7 })), { cat: 1, sub: null, part: 0, parts: 1 });
  c.cfg.stock = c.stockNorm({});
  assert.deepStrictEqual([...c.stockViews().map(v => c.stockViewKey('S', v))], ['stock:S:0:-:0'], 'stock vide : une page qui explique quoi faire');
});
