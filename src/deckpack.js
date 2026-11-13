// The Deck — envoi des pages en images (étape 3, voir PROTOCOLE.md « Pages en images » et docs/adr/0005)
//
// 1. Chaque page (accueil et espaces) est dessinée comme dans « Aperçu de l'écran », à 1024 × 600,
//    dans une fenêtre invisible du logiciel (main.js, deck:render), qui renvoie une image JPEG
//    et la place des zones à toucher.
// 2. Chaque zone reçoit ce qu'elle doit faire sur l'écran : touche, manette, touche multimédia,
//    changement de page, ou message pour le logiciel (sons, clips).
// 3. Le tout part dans un seul paquet binaire, envoyé par morceaux (pg-begin, pg-data, pg-end).
'use strict';

const PG_VERSION_MIN = '0.4.0';           // programme de l'écran qui sait recevoir les pages
const PG_CHUNK = 8192;
const PG_W = 1024, PG_H = 600;

// ---------- touches ----------
const HID_MODS = { Ctrl: 1, Control: 1, Shift: 2, Alt: 4, Win: 8 };
const HID_KEYS = (() => {
  const k = {};
  for (let i = 0; i < 26; i++) k[String.fromCharCode(65 + i)] = 0x04 + i;
  for (let i = 1; i <= 9; i++) k[String(i)] = 0x1E + i - 1;
  k['0'] = 0x27;
  for (let i = 1; i <= 12; i++) k['F' + i] = 0x3A + i - 1;
  for (let i = 13; i <= 24; i++) k['F' + i] = 0x68 + i - 13;
  Object.assign(k, { 'Entrée': 0x28, 'Échap': 0x29, Retour: 0x2A, Tab: 0x2B, Espace: 0x2C, Inser: 0x49, 'Début': 0x4A, PageHaut: 0x4B, Suppr: 0x4C, Fin: 0x4D, PageBas: 0x4E, Droite: 0x4F, Gauche: 0x50, Bas: 0x51, Haut: 0x52 });
  for (let i = 1; i <= 9; i++) k['Pavé' + i] = 0x59 + i - 1;
  Object.assign(k, { 'Pavé0': 0x62, 'PavéDecimal': 0x63, 'PavéEnter': 0x58, 'PavéAdd': 0x57, 'PavéSubtract': 0x56, 'PavéMultiply': 0x55, 'PavéDivide': 0x54 });
  return k;
})();
// « Ctrl+Shift+A » → { mods: 3, code: 0x04 } ; null si une touche est inconnue
function keyCombo(str) {
  const parts = String(str || '').split('+').map(x => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  let mods = 0, code = 0;
  for (const p of parts) {
    if (HID_MODS[p]) mods |= HID_MODS[p];
    else if (HID_KEYS[p] && !code) code = HID_KEYS[p];
    else return null;
  }
  return { mods, code };
}
const MEDIA_USAGE = { volplus: 0xE9, volmoins: 0xEA, muet: 0xE2, lecture: 0xCD, suivante: 0xB5, precedente: 0xB6 };
const PLAYER_MEDIA = { prev: 'precedente', next: 'suivante', play: 'lecture', vmoins: 'volmoins', vplus: 'volplus' };

// ---------- ce que fait chaque zone ----------
const Z = { rien: 0, touche: 1, manette: 2, media: 3, page: 4, message: 5 };
const MODE = { tap: 0, hold: 1, toggle: 2 };

function pgList() {
  const list = [];
  for (let h = 0; h < homePages(); h++) list.push({ key: 'home:' + h, kind: 'home', page: h });
  homeSpaces().forEach(s => s.pages.forEach((p, i) => list.push({ key: `space:${s.id}:${i}`, kind: 'space', space: s, page: i })));
  return list;
}

// action d'une case → zone (sans la position), ou null
function pgCellAction(space, pi, ci, c, keyIndex, warn) {
  const a = c && c.action;
  if (!a || a.type === 'none') return null;
  const b = c.behavior || {};
  const z = { kind: Z.rien, mode: MODE[b.mode] || 0, hold: b.holdMs || 1500, v1: 0, v2: 0, down: null, up: null };
  const key = (combo, label) => {
    const k = keyCombo(combo);
    if (!k) { warn.push(`« ${c.name || 'case'} » (${space.name}) : touche ${label || combo || 'non choisie'} pas encore prise en charge`); return null; }
    return Object.assign(z, { kind: Z.touche, v1: k.mods, v2: k.code });
  };
  if (isSoundboard(space) || a.type === 'sound') {
    const msg = { t: 'sound', space: space.id, page: pi, cell: ci };
    return Object.assign(z, { kind: Z.message, mode: MODE.tap, down: JSON.stringify(Object.assign({}, msg, { down: true })), up: a.mode === 'hold' ? JSON.stringify(Object.assign({}, msg, { down: false })) : null });
  }
  if (a.type === 'joy') return Object.assign(z, { kind: Z.manette, v1: Math.max(1, Math.min(32, +a.button || 1)) });
  if (a.type === 'key') return key(a.keys);
  if (a.type === 'media') return MEDIA_USAGE[a.media] ? Object.assign(z, { kind: Z.media, v1: MEDIA_USAGE[a.media] }) : null;
  if (a.type === 'discord' && a.op === 'raccourci') { const sc = shortcutById(a.arg); return key(sc && sc.keys, sc ? sc.keys : 'du raccourci Discord'); }
  if (a.type === 'app' || a.type === 'obs' || a.type === 'discord' || a.type === 'clip') {
    if (!a.hotkey) { warn.push(`« ${c.name || 'case'} » : plus de touche réservée libre (48 au plus)`); return null; }
    return key(a.hotkey);
  }
  if (a.type === 'page') {
    const target = a.page === 'home' ? 'home:0' : `space:${space.id}:${Math.min(+a.page || 0, space.pages.length - 1)}`;
    return keyIndex[target] == null ? null : Object.assign(z, { kind: Z.page, v1: keyIndex[target] });
  }
  return null;
}

// zone repérée dans la page dessinée → zone complète, ou null
function pgZone(item, r, keyIndex, warn) {
  const d = r.data || {};
  let z = null;
  const go = (target) => keyIndex[target] == null ? null : { kind: Z.page, mode: MODE.tap, v1: keyIndex[target] };
  if (d.simcell != null && item.kind === 'space') {
    const ci = +d.simcell;
    const p = item.space.pages[item.page];
    z = pgCellAction(item.space, item.page, ci, p && p.cells[ci], keyIndex, warn);
  } else if (d.sim === 'home') z = go('home:0');
  else if (d.sim === 'page' && item.kind === 'space') z = go(`space:${item.space.id}:${+d.i || 0}`);
  else if (d.sim === 'space') z = go(`space:${d.id}:0`);
  else if (d.simbtn && PLAYER_MEDIA[d.simbtn]) z = { kind: Z.media, mode: MODE.tap, v1: MEDIA_USAGE[PLAYER_MEDIA[d.simbtn]] };
  else if (d.simclip) z = { kind: Z.message, mode: MODE.tap, down: JSON.stringify({ t: 'clip', op: d.simclip }) };
  if (!z) return null;
  return Object.assign({ hold: 1500, v1: 0, v2: 0, down: null, up: null }, z, {
    x: r.x, y: r.y, w: r.w, h: r.h, radius: Math.max(0, Math.min(255, Math.round(r.radius || 0), Math.floor(Math.min(r.w, r.h) / 2)))
  });
}

// HTML d'une page, dessinée comme dans l'aperçu (sans animation ni bandeau de clip)
function pgHtml(item) {
  const sim = { screen: item.kind, spaceId: item.space ? item.space.id : null, page: item.page, homePage: item.page, cells: {}, render: true };
  const toast = ui.clipToast; ui.clipToast = null;
  try { return item.kind === 'home' ? deckHome(sim, item.page) : deckPage(item.space, item.page, sim); }
  finally { ui.clipToast = toast; }
}

// ---------- paquet binaire ----------
function crc32(u8, c) {
  c = ~(c || 0) >>> 0;
  for (let i = 0; i < u8.length; i++) { c ^= u8[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
const hexColor = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '')); return m ? parseInt(m[1], 16) : 0xFFB547; };

// pages : [{ jpeg: Uint8Array, zones: [...], accent: '#RRGGBB' }]
function pgBuildPack(pages) {
  const enc = new TextEncoder();
  const strs = [], strIdx = new Map();
  let strLen = 0;
  const str = (s) => {
    if (s == null) return 0xFFFFFFFF;
    if (strIdx.has(s)) return strIdx.get(s);
    const b = enc.encode(s); const off = strLen;
    strs.push(b); strLen += b.length + 1; strIdx.set(s, off);
    return off;
  };
  const zones = [];
  pages.forEach(p => p.zones.forEach(z => zones.push(z)));
  const zOff = 24 + 20 * pages.length;
  const sOff = zOff + 28 * zones.length;
  zones.forEach(z => { z._d = str(z.down); z._u = str(z.up); });
  let jOff = (sOff + strLen + 3) & ~3;
  const jpegAt = pages.map(p => { const o = jOff; jOff = (jOff + p.jpeg.length + 3) & ~3; return o; });
  const total = jOff;
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  buf.set(enc.encode('DECK'), 0);
  dv.setUint16(4, 1, true); dv.setUint16(6, pages.length, true);
  dv.setUint32(8, sOff, true); dv.setUint32(12, strLen, true); dv.setUint32(16, total, true); dv.setUint32(20, 0, true);
  let zi = 0;
  pages.forEach((p, i) => {
    const o = 24 + 20 * i;
    dv.setUint32(o, jpegAt[i], true); dv.setUint32(o + 4, p.jpeg.length, true); dv.setUint32(o + 8, zi, true);
    dv.setUint16(o + 12, p.zones.length, true); dv.setUint16(o + 14, 0, true); dv.setUint32(o + 16, hexColor(p.accent), true);
    buf.set(p.jpeg, jpegAt[i]);
    zi += p.zones.length;
  });
  zones.forEach((z, i) => {
    const o = zOff + 28 * i;
    [z.x, z.y, z.w, z.h].forEach((v, k) => dv.setUint16(o + 2 * k, Math.max(0, Math.min(0xFFFF, Math.round(v))), true));
    dv.setUint8(o + 8, z.kind); dv.setUint8(o + 9, z.mode || 0); dv.setUint8(o + 10, z.radius || 0); dv.setUint8(o + 11, 0);
    dv.setUint16(o + 12, Math.max(0, Math.min(0xFFFF, z.hold || 0)), true); dv.setUint16(o + 14, z.v1 || 0, true); dv.setUint16(o + 16, z.v2 || 0, true); dv.setUint16(o + 18, 0, true);
    dv.setUint32(o + 20, z._d, true); dv.setUint32(o + 24, z._u, true);
    delete z._d; delete z._u;
  });
  let so = sOff;
  strs.forEach(b => { buf.set(b, so); so += b.length + 1; });
  return buf;
}

// ---------- tout préparer, puis envoyer ----------
const pgSet = (state, msg, pct) => { ui.pg = { state, msg: msg || '', pct: pct || 0 }; if (ui.view === 'appareil') render(); };

async function pgPrepare() {
  const list = pgList();
  const keyIndex = {};
  list.forEach((it, i) => { keyIndex[it.key] = i; });
  const shots = await api.deckRender(list.map(pgHtml));
  if (!shots || shots.length !== list.length) throw new Error('impossible de dessiner les pages');
  const warn = [];
  const pages = list.map((it, i) => ({
    jpeg: new Uint8Array(shots[i].jpeg),
    accent: (it.kind === 'home' ? cfg.look : lookFor(it.space)).accent,
    zones: shots[i].zones.map(r => pgZone(it, r, keyIndex, warn)).filter(Boolean)
  }));
  return { pack: pgBuildPack(pages), count: pages.length, warn };
}

async function pgSend(pack) {
  const isPg = (t) => (m) => m.t === t || m.t === 'pg-err';
  const crc = crc32(pack);
  deckWrite({ t: 'pg-begin', size: pack.length, crc, count: 0 });
  let m = await fwWaitMsg(isPg('pg-ack'), 10000);
  if (!m) throw new Error('l’écran ne répond pas');
  if (m.t === 'pg-err') throw new Error(m.msg || 'refusé par l’écran');
  let off = m.off || 0, tries = 0;
  while (off < pack.length) {
    deckWrite({ t: 'pg-data', off, b64: fwB64(pack.subarray(off, Math.min(off + PG_CHUNK, pack.length))) });
    m = await fwWaitMsg(isPg('pg-ack'), 8000);
    if (!m) { if (++tries > 3) throw new Error('la liaison s’est arrêtée'); continue; }
    if (m.t === 'pg-err') throw new Error(m.msg || 'refusé par l’écran');
    tries = 0; off = m.off;
    const p = Math.floor(off / pack.length * 100);
    if (p !== ui.pg.pct) pgSet('send', 'Envoi des pages…', p);
  }
  deckWrite({ t: 'pg-end' });
  m = await fwWaitMsg(isPg('pg-done'), 15000);
  if (!m) throw new Error('l’écran n’a pas confirmé');
  if (m.t === 'pg-err') throw new Error(m.msg || 'refusé par l’écran');
  return m.count;
}

// bouton « Envoyer sur l'écran »
async function deckSendPages() {
  if (ui.pg && (ui.pg.state === 'draw' || ui.pg.state === 'send')) return false;
  if (!ui.deckFw) { deckHello(); await fwWaitMsg(m => m.t === 'hello', 2500); }   // version du programme de l'écran
  if (!ui.deckFw || fwOlder(ui.deckFw, PG_VERSION_MIN)) {
    toast(ui.deckFw ? `Le programme de l’écran (${ui.deckFw}) est trop ancien pour recevoir les pages : mettez-le à jour dans la page Appareil.` : 'L’écran ne répond pas. Vérifiez que le câble est sur la prise « USB » de l’écran.', 'err', 8000);
    return false;
  }
  try {
    pgSet('draw', 'Préparation des pages…', 0);
    toast('Préparation des pages…');
    const { pack, count, warn } = await pgPrepare();
    pgSet('send', 'Envoi des pages…', 0);
    await pgSend(pack);
    pgSet('done', `${count} page${count > 1 ? 's' : ''} envoyée${count > 1 ? 's' : ''} (${Math.round(pack.length / 1024)} Ko).`, 100);
    if (warn.length) toast('Envoyé, mais certaines cases ne feront rien : ' + warn.slice(0, 3).join(' ; ') + (warn.length > 3 ? '…' : ''), 'err', 9000);
    return true;
  } catch (e) {
    console.error(e);
    pgSet('err', 'L’envoi n’a pas abouti : ' + (e && e.message ? e.message : e) + '.', 0);
    toast('L’envoi n’a pas abouti : ' + (e && e.message ? e.message : e) + '.', 'err', 8000);
    return false;
  }
}
