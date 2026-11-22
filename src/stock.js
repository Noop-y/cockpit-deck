// The Deck — stock d'électronique (onglet « Stock » du logiciel)
//
// cfg.stock = { cats: [catégorie], history: [] }
//   catégorie : { id, name, place, color, sub, subs: [{ id, name, items }], items }
//     sub = true : les pièces sont rangées dans des sous-catégories (les tiroirs) ; false : directement dans la catégorie
//   pièce : { id, name, q (quantité), low (stock bas en dessous de… ; 0 = jamais), link (lien d'achat) }
// Chargé après app.js : ajoute la vue « stock » et ses actions. Voir docs/fonctionnalites.md (« Stock »).
'use strict';

const STOCK_COLORS = [['ambre', '#FFB547'], ['vert', '#3FB97A'], ['bleu', '#5CC8FF'], ['rose', '#FF7EB6'], ['violet', '#8E9BFF'], ['gris', '#8E9BA8']];
const stockId = () => Math.random().toString(36).slice(2, 10);
if (typeof ui !== 'undefined') ui.stock = ui.stock || {};
const stockInt = (v) => Math.max(0, Math.min(999999, Math.floor(+v || 0)));

// ---------- données (fonctions pures, testées dans tests/stock.test.js) ----------
function stockNormItem(it) {
  it = it && typeof it === 'object' ? it : {};
  return { id: String(it.id || stockId()), name: String(it.name == null ? 'Pièce' : it.name).slice(0, 80), q: stockInt(it.q), low: stockInt(it.low),
    link: typeof it.link === 'string' && /^https?:\/\//i.test(it.link.trim()) ? it.link.trim().slice(0, 500) : '' };
}
function stockNorm(st) {
  const s = st && typeof st === 'object' ? st : {};
  const items = (a) => (Array.isArray(a) ? a : []).map(stockNormItem);
  const cats = (Array.isArray(s.cats) ? s.cats : []).filter(c => c && typeof c === 'object').map(c => ({
    id: String(c.id || stockId()), name: String(c.name == null ? 'Catégorie' : c.name).slice(0, 60), place: String(c.place || '').slice(0, 80),
    color: STOCK_COLORS.some(x => x[1] === c.color) ? c.color : STOCK_COLORS[0][1],
    sub: !!c.sub,
    subs: (Array.isArray(c.subs) ? c.subs : []).filter(x => x && typeof x === 'object').map(x => ({ id: String(x.id || stockId()), name: String(x.name == null ? 'Tiroir' : x.name).slice(0, 60), items: items(x.items) })),
    items: items(c.items)
  }));
  return { cats, history: Array.isArray(s.history) ? s.history.slice(-200) : [] };
}
// 'out' épuisé, 'low' stock bas, 'ok'
function stockState(it) { return it.q === 0 ? 'out' : it.low > 0 && it.q < it.low ? 'low' : 'ok'; }
// interrupteur « sous-catégories » : rien n'est perdu dans un sens comme dans l'autre
function stockToggleSub(c) {
  if (c.sub) { c.items = c.items.concat(...c.subs.map(s => s.items)); c.subs = []; c.sub = false; }
  else { c.subs = [{ id: stockId(), name: 'Tiroir 1', items: c.items }]; c.items = []; c.sub = true; }
  return c;
}
// liste où vont les pièces : celle de la sous-catégorie choisie, ou de la catégorie
function stockItemsOf(c, subId) {
  if (!c) return null;
  if (!c.sub) return c.items;
  const s = c.subs.find(x => x.id === subId) || c.subs[0];
  return s ? s.items : null;
}
// toutes les pièces, avec leur chemin (pour Claude, l'écran, la liste de courses)
function stockAll(stock) {
  const out = [];
  stock.cats.forEach(c => {
    if (c.sub) c.subs.forEach(s => s.items.forEach(it => out.push({ cat: c, sub: s, item: it, path: `${c.name} › ${s.name}` })));
    else c.items.forEach(it => out.push({ cat: c, sub: null, item: it, path: c.name }));
  });
  return out;
}
function stockCounts(items) {
  let out = 0, low = 0;
  items.forEach(it => { const st = stockState(it); if (st === 'out') out++; else if (st === 'low') low++; });
  return { out, low };
}

// ---------- écran du logiciel ----------
function stockSel() {
  const st = cfg.stock;
  ui.stock = ui.stock || {};
  let c = st.cats.find(x => x.id === ui.stock.cat) || st.cats[0] || null;
  if (c) ui.stock.cat = c.id;
  let s = c && c.sub ? (c.subs.find(x => x.id === ui.stock.sub) || c.subs[0] || null) : null;
  ui.stock.sub = s ? s.id : null;
  return { c, s };
}
const stockColor = (st) => st === 'out' ? 'var(--red)' : st === 'low' ? 'var(--amber)' : 'var(--fg)';

function viewStock() {
  const st = cfg.stock, { c, s } = stockSel();
  const all = stockAll(st).map(x => x.item), tot = stockCounts(all);
  const head = `<div class="head"><div><h1 class="disp">Stock</h1><div class="muted" style="margin-top:4px">Vos composants : des catégories, des sous-catégories (les tiroirs) si vous en voulez, puis les pièces et leur quantité.</div></div>
    <div class="small muted">${all.length} pièce${all.length > 1 ? 's' : ''}${tot.out ? ` · <span style="color:var(--red)">${tot.out} épuisée${tot.out > 1 ? 's' : ''}</span>` : ''}${tot.low ? ` · <span style="color:var(--amber)">${tot.low} en stock bas</span>` : ''}</div></div>`;
  const cats = st.cats.map(x => {
    const n = x.sub ? `${x.subs.length} sous-catégorie${x.subs.length > 1 ? 's' : ''}` : `${x.items.length} pièce${x.items.length > 1 ? 's' : ''}`;
    const k = stockCounts(x.sub ? [].concat(...x.subs.map(y => y.items)) : x.items);
    return `<button class="stcat${c && x.id === c.id ? ' on' : ''}" data-act="stock-cat" data-id="${esc(x.id)}"><span class="stdot" style="background:${x.color}"></span><span class="grow"><b>${esc(x.name) || 'Sans nom'}</b><span class="small muted">${n}</span></span>${k.out + k.low ? `<span class="stbadge${k.out ? ' out' : ''}">${k.out + k.low}</span>` : ''}</button>`;
  }).join('');
  const col1 = `<div class="stcol1"><div class="lab">Catégories</div>${cats}<button class="btn sm stadd" data-act="stock-cat-add">+ Ajouter une catégorie</button></div>`;
  if (!c) {
    return head + `<div class="stwrap">${col1}<div class="panel grow"><div class="muted">Commencez par créer une catégorie, par exemple « Composants électroniques », « Capteurs » ou « Cartes ». Vous pourrez la diviser en sous-catégories (les tiroirs) si vous voulez.</div><div><button class="btn pri" data-act="stock-cat-add">+ Ajouter une catégorie</button></div></div></div>`;
  }
  const subs = c.sub ? `<div class="lab">Sous-catégories (tiroirs)</div>${c.subs.map((x, k) => `<div class="stsub${s && x.id === s.id ? ' on' : ''}"><button class="stsubpick" data-act="stock-sub" data-id="${esc(x.id)}" aria-label="Choisir">${String.fromCharCode(65 + k)}</button><input class="inp" value="${esc(x.name)}" id="st-sub-${esc(x.id)}" data-stock="sub-name" data-id="${esc(x.id)}" aria-label="Nom de la sous-catégorie"><span class="small muted">${x.items.length}</span><button class="iconbtn" data-act="stock-sub-del" data-id="${esc(x.id)}" aria-label="Supprimer la sous-catégorie">✕</button></div>`).join('')}<button class="btn sm stadd" data-act="stock-sub-add">+ Ajouter une sous-catégorie</button>` : '';
  const col2 = `<div class="panel stcol2"><div class="lab">Réglages de la catégorie</div>
    <label class="small muted">Nom affiché sur l’écran<input class="inp" value="${esc(c.name)}" id="st-cat-name" data-stock="cat-name" maxlength="60"></label>
    <label class="small muted">Où c’est rangé en vrai (facultatif)<input class="inp" value="${esc(c.place)}" id="st-cat-place" data-stock="cat-place" placeholder="Boîte 1, bac sous le bureau…" maxlength="80"></label>
    <div class="small muted">Couleur<div class="row" style="gap:8px;margin-top:6px">${STOCK_COLORS.map(([l, col]) => `<button class="stsw${c.color === col ? ' on' : ''}" style="background:${col}" data-act="stock-color" data-color="${col}" aria-label="Couleur ${l}"></button>`).join('')}</div></div>
    <button class="sttoggle${c.sub ? ' on' : ''}" data-act="stock-sub-toggle"><span class="sw"><span></span></span><span><b>Diviser en sous-catégories</b><span class="small muted">${c.sub ? 'Oui : chaque sous-catégorie est un tiroir sur l’écran.' : 'Non : les pièces sont rangées directement dans la catégorie.'}</span></span></button>
    ${subs}
    <button class="btn sm danger" data-act="stock-cat-del">Supprimer la catégorie</button></div>`;
  const list = stockItemsOf(c, s && s.id) || [];
  const rows = list.map(it => {
    const stt = stockState(it);
    return `<div class="strow"><input class="inp" value="${esc(it.name)}" id="st-item-name-${esc(it.id)}" data-stock="item-name" data-id="${esc(it.id)}" aria-label="Nom de la pièce" maxlength="80">
      <div class="stq"><button class="btn sm" data-act="stock-q" data-id="${esc(it.id)}" data-d="-1" aria-label="Enlever 1">−</button><input class="inp mono" value="${it.q}" id="st-item-q-${esc(it.id)}" data-stock="item-q" data-id="${esc(it.id)}" inputmode="numeric" aria-label="Quantité" style="color:${stockColor(stt)}"><button class="btn sm" data-act="stock-q" data-id="${esc(it.id)}" data-d="1" aria-label="Ajouter 1">+</button></div>
      <input class="inp mono" value="${it.low || ''}" id="st-item-low-${esc(it.id)}" data-stock="item-low" data-id="${esc(it.id)}" inputmode="numeric" placeholder="—" aria-label="Stock bas en dessous de">
      <input class="inp" value="${esc(it.link)}" id="st-item-link-${esc(it.id)}" data-stock="item-link" data-id="${esc(it.id)}" placeholder="https://…" aria-label="Lien d’achat">
      <button class="iconbtn" data-act="stock-item-del" data-id="${esc(it.id)}" aria-label="Supprimer la pièce">✕</button></div>`;
  }).join('');
  const where = c.sub ? (s ? `${esc(c.name)} › ${esc(s.name)}` : esc(c.name)) : esc(c.name);
  const col3 = `<div class="panel stcol3"><div><div class="lab">Pièces</div><h2 class="disp" style="margin:2px 0 0">${where}</h2></div>
    ${c.sub && !s ? '<div class="muted">Ajoutez une sous-catégorie pour y ranger des pièces.</div>' : `
    ${list.length ? `<div class="strow sthead small muted"><span>Pièce</span><span>Quantité</span><span>Stock bas</span><span>Lien d’achat</span><span></span></div>${rows}` : '<div class="muted">Aucune pièce ici pour l’instant.</div>'}
    <div><button class="btn sm" data-act="stock-item-add">+ Ajouter une pièce</button></div>
    <div class="small muted">« Stock bas » : la quantité passe en orange en dessous de ce nombre (vide = jamais). À 0, elle passe en rouge.</div>`}</div>`;
  return head + `<div class="stwrap">${col1}${col2}${col3}</div>`;
}

// ---------- actions ----------
const stockCur = () => stockSel().c;
function stockFindItem(id) {
  for (const x of stockAll(cfg.stock)) if (x.item.id === id) return x;
  return null;
}
function stockListOf(id) {
  for (const c of cfg.stock.cats) {
    if (c.items.some(i => i.id === id)) return c.items;
    for (const s of c.subs) if (s.items.some(i => i.id === id)) return s.items;
  }
  return null;
}
Object.assign(ACTIONS, {
  'stock-cat': (d) => { ui.stock.cat = d.id; ui.stock.sub = null; render(); },
  'stock-cat-add': () => {
    const c = { id: stockId(), name: 'Nouvelle catégorie', place: '', color: STOCK_COLORS[cfg.stock.cats.length % STOCK_COLORS.length][1], sub: false, subs: [], items: [] };
    cfg.stock.cats.push(c); ui.stock = { cat: c.id, sub: null }; commit();
    setTimeout(() => { const el = document.getElementById('st-cat-name'); if (el) { el.focus(); el.select(); } }, 0);
  },
  'stock-cat-del': () => {
    const c = stockCur(); if (!c) return;
    const n = c.sub ? c.subs.reduce((a, s) => a + s.items.length, 0) : c.items.length;
    confirmBox('Supprimer « ' + c.name + ' » ?', n ? `Ses ${n} pièce${n > 1 ? 's' : ''} seront supprimées aussi.` : 'Elle est vide.', 'Supprimer', true, () => {
      cfg.stock.cats = cfg.stock.cats.filter(x => x !== c); ui.stock.cat = null; commit();
    });
  },
  'stock-color': (d) => { const c = stockCur(); if (c) { c.color = d.color; commit(); } },
  'stock-sub-toggle': () => {
    const c = stockCur(); if (!c) return;
    const go = () => { stockToggleSub(c); ui.stock.sub = null; commit(); };
    if (c.sub && c.subs.length > 1) confirmBox('Ne plus utiliser de sous-catégories ?', `Les pièces de vos ${c.subs.length} sous-catégories seront rangées directement dans « ${c.name} ». Aucune pièce n’est perdue.`, 'D’accord', false, go);
    else go();
  },
  'stock-sub': (d) => { ui.stock.sub = d.id; render(); },
  'stock-sub-add': () => {
    const c = stockCur(); if (!c) return;
    const s = { id: stockId(), name: 'Tiroir ' + (c.subs.length + 1), items: [] };
    c.subs.push(s); ui.stock.sub = s.id; commit();
    setTimeout(() => { const el = document.querySelector(`[data-stock="sub-name"][data-id="${s.id}"]`); if (el) { el.focus(); el.select(); } }, 0);
  },
  'stock-sub-del': (d) => {
    const c = stockCur(); const s = c && c.subs.find(x => x.id === d.id); if (!s) return;
    const del = () => { c.subs = c.subs.filter(x => x !== s); if (ui.stock.sub === s.id) ui.stock.sub = null; commit(); };
    if (s.items.length) confirmBox('Supprimer « ' + s.name + ' » ?', `Ses ${s.items.length} pièce${s.items.length > 1 ? 's' : ''} seront supprimées aussi.`, 'Supprimer', true, del);
    else del();
  },
  'stock-item-add': () => {
    const { c, s } = stockSel(); const list = stockItemsOf(c, s && s.id); if (!list) return;
    const it = stockNormItem({ name: 'Nouvelle pièce', q: 0 }); list.push(it); commit();
    setTimeout(() => { const el = document.querySelector(`[data-stock="item-name"][data-id="${it.id}"]`); if (el) { el.focus(); el.select(); } }, 0);
  },
  'stock-item-del': (d) => {
    const list = stockListOf(d.id); if (!list) return;
    const it = list.find(i => i.id === d.id);
    confirmBox('Supprimer « ' + it.name + ' » ?', 'Elle disparaît du stock.', 'Supprimer', true, () => { list.splice(list.indexOf(it), 1); commit(); });
  },
  'stock-q': (d) => { const x = stockFindItem(d.id); if (!x) return; x.item.q = stockInt(x.item.q + +d.d); commit(); }
});

// champs : enregistrés au fil de la frappe, sans redessiner (le curseur reste en place)
document.addEventListener('input', (ev) => {
  const el = ev.target; const k = el && el.dataset && el.dataset.stock;
  if (!k || !cfg) return;
  const c = stockCur(); const v = el.value;
  if (k === 'cat-name' && c) c.name = v.slice(0, 60);
  else if (k === 'cat-place' && c) c.place = v.slice(0, 80);
  else if (k === 'sub-name' && c) { const s = c.subs.find(x => x.id === el.dataset.id); if (s) s.name = v.slice(0, 60); }
  else {
    const x = stockFindItem(el.dataset.id); if (!x) return;
    if (k === 'item-name') x.item.name = v.slice(0, 80);
    else if (k === 'item-q') x.item.q = stockInt(v);
    else if (k === 'item-low') x.item.low = stockInt(v);
    else if (k === 'item-link') x.item.link = /^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 500) : '';
  }
  commit(true);
});
// en quittant un champ : on redessine (couleurs, compteurs, noms dans la liste). Si on quitte le champ en cliquant
// sur un bouton, on attend la fin du clic : redessiner pendant le clic le ferait disparaître sous le doigt.
let stockPending = false, stockPointer = false;
const stockFlush = () => { if (stockPending && !stockPointer && ui.view === 'stock') { stockPending = false; render(); } };
document.addEventListener('change', (ev) => { if (ev.target && ev.target.dataset && ev.target.dataset.stock) { stockPending = true; setTimeout(stockFlush, 0); } });
document.addEventListener('pointerdown', () => { stockPointer = true; }, true);
document.addEventListener('pointerup', () => { stockPointer = false; setTimeout(stockFlush, 30); }, true);
