// Test du lien avec l'application Claude (src/lien-claude.js) : on le lance comme le ferait Claude,
// avec un faux logiciel The Deck au bout du tuyau.
// Lancer : node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

test('lien Claude : outils proposés et questions passées au logiciel', { skip: process.platform === 'win32' && 'tuyau de test Unix' }, async () => {
  const pipe = path.join(os.tmpdir(), 'deck-test-' + process.pid + '.sock');
  const asked = [];
  const srv = net.createServer(sock => {
    sock.setEncoding('utf8');
    sock.on('data', d => {
      const m = JSON.parse(d.trim()); asked.push(m);
      sock.write(JSON.stringify(m.op === 'lire' ? { id: m.id, resultat: { categories: [] } } : { id: m.id, erreur: 'Pièce introuvable' }) + '\n');
    });
  });
  await new Promise(ok => srv.listen(pipe, ok));
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'lien-claude.js')], { env: Object.assign({}, process.env, { THE_DECK_PIPE: pipe }) });
  const got = [];
  let buf = '';
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { got.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (m) => p.stdin.write(JSON.stringify(m) + '\n');
  const wait = (id) => new Promise((ok, ko) => { const t0 = Date.now(); (function f() { const r = got.find(x => x.id === id); if (r) ok(r); else if (Date.now() - t0 > 5000) ko(new Error('pas de réponse ' + id)); else setTimeout(f, 20); })(); });
  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    const init = await wait(1);
    assert.strictEqual(init.result.serverInfo.name, 'the-deck');
    assert.match(init.result.instructions, /Projet terminé/);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const names = (await wait(2)).result.tools.map(t => t.name);
    assert.deepStrictEqual(names, ['lire_stock', 'proposer_changement', 'etat_proposition'], 'lire, proposer, et rien d’autre');
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lire_stock', arguments: {} } });
    const r3 = await wait(3);
    assert.strictEqual(r3.result.isError, false);
    assert.deepStrictEqual(JSON.parse(r3.result.content[0].text), { categories: [] });
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'proposer_changement', arguments: { titre: 'X', changements: [] } } });
    const r4 = await wait(4);
    assert.strictEqual(r4.result.isError, true);
    assert.match(r4.result.content[0].text, /introuvable/);
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'supprimer_tout', arguments: {} } });
    assert.ok((await wait(5)).error, 'outil inconnu refusé');
    assert.deepStrictEqual(asked.map(a => a.op), ['lire', 'proposer']);
  } finally { p.kill(); srv.close(); }
});
