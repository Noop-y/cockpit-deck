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
// phrases convenues avec Claude (rappelées sur l'écran : case « Aide », et dans Paramètres)
const STOCK_PHRASES = [
  ['Projet terminé : <nom>', 'Claude liste les pièces utilisées, vous corrigez, puis la proposition de retrait arrive sur l’écran.'],
  ['Commande reçue : …', 'Claude propose d’ajouter les pièces reçues.'],
  ['Annule la dernière validation', 'Claude propose l’inverse de la dernière proposition validée.'],
  ['Qu’est-ce que je dois commander ?', 'Claude liste les pièces épuisées ou en stock bas (rien ne change).'],
  ['Rappelle-moi les phrases du stock', 'Claude redonne ces phrases.']
];
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
  const prop = s.prop && typeof s.prop === 'object' && s.prop.id && Array.isArray(s.prop.changes) ? s.prop : null;
  return { cats, history: (Array.isArray(s.history) ? s.history : []).filter(h => h && typeof h === 'object' && h.id).slice(-200), prop };
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

// ---------- propositions de Claude (fonctions pures, testées) ----------
// cfg.stock.prop : la proposition qui attend VALIDER / REFUSER (une seule à la fois)
//   { id, at, title, changes: [{ id (pièce existante) | add: { name, cat, sub } (nouvelle pièce), name, path, d }] }
// cfg.stock.history : ce qui a été décidé { id, prop, at, title, status: 'ok' | 'non' | 'remplacee', undone, changes: [{ id, name, path, d (vraiment appliqué) }] }
function stockFindIn(stock, id) { return stockAll(stock).find(x => x.item.id === id) || null; }
function stockPropBuild(stock, args) {
  args = args && typeof args === 'object' ? args : {};
  const title = String(args.titre || '').trim().slice(0, 60);
  if (!title) return { erreur: 'Il manque le titre de la proposition.' };
  const list = Array.isArray(args.changements) ? args.changements : [];
  if (!list.length || list.length > 40) return { erreur: 'Il faut entre 1 et 40 changements.' };
  const changes = [];
  for (const ch of list) {
    const d = Math.trunc(+(ch && ch.quantite));
    if (!d || Math.abs(d) > 100000) return { erreur: 'Quantité invalide (un nombre entier, positif pour ajouter, négatif pour retirer).' };
    if (ch.piece_id) {
      const x = stockFindIn(stock, String(ch.piece_id));
      if (!x) return { erreur: `Pièce introuvable : ${ch.piece_id}. Relisez le stock avec lire_stock.` };
      if (changes.some(c => c.id === x.item.id)) return { erreur: `La pièce « ${x.item.name} » apparaît deux fois : additionnez les quantités.` };
      changes.push({ id: x.item.id, name: x.item.name, path: x.path, d });
    } else if (ch.nouvelle_piece && typeof ch.nouvelle_piece === 'object') {
      const n = ch.nouvelle_piece, name = String(n.nom || '').trim().slice(0, 80);
      const c = stock.cats.find(k => k.id === String(n.categorie_id));
      if (!name || !c) return { erreur: 'Nouvelle pièce : il faut un nom et une categorie_id existante.' };
      const sub = c.sub ? c.subs.find(k => k.id === String(n.tiroir_id || '')) : null;
      if (c.sub && !sub) return { erreur: `La catégorie « ${c.name} » a des tiroirs : donnez tiroir_id.` };
      if (d < 0) return { erreur: 'Une nouvelle pièce ne peut être qu’ajoutée.' };
      changes.push({ add: { name, cat: c.id, sub: sub ? sub.id : null }, name, path: sub ? `${c.name} › ${sub.name}` : c.name, d });
    } else return { erreur: 'Chaque changement doit avoir piece_id ou nouvelle_piece.' };
  }
  return { prop: { id: 'p' + stockId(), at: Date.now(), title, changes } };
}
// applique une proposition validée ; renvoie la ligne d'historique
function stockPropApply(stock, prop) {
  const done = [];
  prop.changes.forEach(ch => {
    if (ch.add) {
      const c = stock.cats.find(k => k.id === ch.add.cat); if (!c) return;
      const list = c.sub ? (c.subs.find(k => k.id === ch.add.sub) || {}).items : c.items; if (!list) return;
      let it = list.find(i => i.name.toLowerCase() === ch.add.name.toLowerCase());
      if (!it) { it = stockNormItem({ name: ch.add.name, q: 0 }); list.push(it); }
      const before = it.q; it.q = stockInt(before + ch.d);
      done.push({ id: it.id, name: it.name, path: ch.path, d: it.q - before });
    } else {
      const x = stockFindIn(stock, ch.id); if (!x) return;
      const before = x.item.q; x.item.q = stockInt(before + ch.d);
      done.push({ id: ch.id, name: x.item.name, path: x.path, d: x.item.q - before });
    }
  });
  return { id: 'h' + stockId(), prop: prop.id, at: Date.now(), title: prop.title, status: 'ok', undone: false, changes: done };
}
// annule une proposition validée (remet les quantités d'avant)
function stockUndo(stock, hid) {
  const h = stock.history.find(x => x.id === hid);
  if (!h || h.status !== 'ok' || h.undone) return false;
  h.changes.forEach(ch => { const x = stockFindIn(stock, ch.id); if (x) x.item.q = stockInt(x.item.q - ch.d); });
  h.undone = true;
  return true;
}
// ce que Claude lit (pas de lien d'achat inutile, ni rien d'autre que le stock)
function stockForClaude(stock) {
  const piece = (it) => ({ id: it.id, nom: it.name, quantite: it.q, stock_bas_sous: it.low || null, etat: { out: 'épuisée', low: 'stock bas', ok: 'ok' }[stockState(it)] });
  return {
    categories: stock.cats.map(c => Object.assign({ id: c.id, nom: c.name, rangement: c.place || null },
      c.sub ? { tiroirs: c.subs.map(s => ({ id: s.id, nom: s.name, pieces: s.items.map(piece) })) } : { pieces: c.items.map(piece) })),
    proposition_en_attente: stock.prop ? { id: stock.prop.id, titre: stock.prop.title } : null,
    historique: stock.history.slice(-8).map(h => ({ id: h.prop || h.id, titre: h.title, date: new Date(h.at).toISOString().slice(0, 16), etat: h.undone ? 'annulée' : { ok: 'validée', non: 'refusée', remplacee: 'remplacée' }[h.status] || h.status,
      changements: (h.changes || []).map(c => ({ piece_id: c.id, nom: c.name, quantite: c.d })) }))
  };
}
function stockPropState(stock, id) {
  if (stock.prop && stock.prop.id === id) return 'en attente : l’utilisateur n’a pas encore appuyé sur VALIDER ou REFUSER';
  const h = stock.history.slice().reverse().find(x => x.prop === id);
  if (!h) return 'inconnue';
  return h.undone ? 'validée puis annulée' : { ok: 'validée : le stock a été mis à jour', non: 'refusée : rien n’a changé', remplacee: 'remplacée par une proposition plus récente' }[h.status] || h.status;
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
  return head + stockPropBanner() + `<div class="stwrap">${col1}${col2}${col3}</div>` + stockHistoryPanel();
}
function stockPropBanner() {
  const p = cfg.stock.prop; if (!p) return '';
  const rows = p.changes.map(ch => {
    const x = ch.id ? stockFindItem(ch.id) : null, before = x ? x.item.q : 0;
    return `<div class="row small" style="justify-content:space-between;gap:12px"><span><b>${esc(ch.name)}</b> <span class="muted">${esc(ch.path)}${ch.add ? ' · nouvelle pièce' : ''}</span></span><span class="mono">${ch.d > 0 ? '+' : '−'}${Math.abs(ch.d)} <span class="muted">(${before} → ${stockInt(before + ch.d)})</span></span></div>`;
  }).join('');
  return `<div class="panel stprop"><div class="row" style="justify-content:space-between"><div><div class="lab" style="margin:0">Proposition de Claude · en attente</div><h2 class="disp" style="margin:2px 0 0">${esc(p.title)}</h2></div>
    <div class="row"><button class="btn" data-act="stock-prop" data-ok="0">Refuser</button><button class="btn pri" data-act="stock-prop" data-ok="1">Valider</button></div></div>${rows}
    <div class="small muted">Elle s’affiche aussi sur l’écran (espace Stock). Rien ne change tant que personne n’a appuyé sur VALIDER.</div></div>`;
}
function stockHistoryPanel() {
  const h = cfg.stock.history.slice(-10).reverse(); if (!h.length) return '';
  const st = (x) => x.undone ? '<span class="muted">annulée</span>' : x.status === 'ok' ? '<span style="color:var(--green)">validée</span>' : x.status === 'non' ? '<span class="muted">refusée</span>' : '<span class="muted">remplacée</span>';
  return `<div class="panel" style="margin-top:16px"><div class="lab">Historique des propositions de Claude</div>${h.map(x => `<div class="row" style="justify-content:space-between;gap:12px"><span><b>${esc(x.title)}</b> <span class="small muted">${new Date(x.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${(x.changes || []).length} pièce${(x.changes || []).length > 1 ? 's' : ''}</span></span><span class="row small">${st(x)}${x.status === 'ok' && !x.undone ? `<button class="btn sm" data-act="stock-undo" data-id="${esc(x.id)}">Annuler</button>` : ''}</span></div>`).join('')}</div>`;
}

// ---------- actions ----------
// après un changement dans le logiciel : l'écran suit (pages du stock redessinées, voir deckpack.js)
const stockSaved = () => { if (typeof pgLiveRefresh === 'function') pgLiveRefresh(1200); };
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
    cfg.stock.cats.push(c); ui.stock = { cat: c.id, sub: null }; commit(); stockSaved();
    setTimeout(() => { const el = document.getElementById('st-cat-name'); if (el) { el.focus(); el.select(); } }, 0);
  },
  'stock-cat-del': () => {
    const c = stockCur(); if (!c) return;
    const n = c.sub ? c.subs.reduce((a, s) => a + s.items.length, 0) : c.items.length;
    confirmBox('Supprimer « ' + c.name + ' » ?', n ? `Ses ${n} pièce${n > 1 ? 's' : ''} seront supprimées aussi.` : 'Elle est vide.', 'Supprimer', true, () => {
      cfg.stock.cats = cfg.stock.cats.filter(x => x !== c); ui.stock.cat = null; commit(); stockSaved();
    });
  },
  'stock-color': (d) => { const c = stockCur(); if (c) { c.color = d.color; commit(); stockSaved(); } },
  'stock-sub-toggle': () => {
    const c = stockCur(); if (!c) return;
    const go = () => { stockToggleSub(c); ui.stock.sub = null; commit(); stockSaved(); };
    if (c.sub && c.subs.length > 1) confirmBox('Ne plus utiliser de sous-catégories ?', `Les pièces de vos ${c.subs.length} sous-catégories seront rangées directement dans « ${c.name} ». Aucune pièce n’est perdue.`, 'D’accord', false, go);
    else go();
  },
  'stock-sub': (d) => { ui.stock.sub = d.id; render(); },
  'stock-sub-add': () => {
    const c = stockCur(); if (!c) return;
    const s = { id: stockId(), name: 'Tiroir ' + (c.subs.length + 1), items: [] };
    c.subs.push(s); ui.stock.sub = s.id; commit(); stockSaved();
    setTimeout(() => { const el = document.querySelector(`[data-stock="sub-name"][data-id="${s.id}"]`); if (el) { el.focus(); el.select(); } }, 0);
  },
  'stock-sub-del': (d) => {
    const c = stockCur(); const s = c && c.subs.find(x => x.id === d.id); if (!s) return;
    const del = () => { c.subs = c.subs.filter(x => x !== s); if (ui.stock.sub === s.id) ui.stock.sub = null; commit(); stockSaved(); };
    if (s.items.length) confirmBox('Supprimer « ' + s.name + ' » ?', `Ses ${s.items.length} pièce${s.items.length > 1 ? 's' : ''} seront supprimées aussi.`, 'Supprimer', true, del);
    else del();
  },
  'stock-item-add': () => {
    const { c, s } = stockSel(); const list = stockItemsOf(c, s && s.id); if (!list) return;
    const it = stockNormItem({ name: 'Nouvelle pièce', q: 0 }); list.push(it); commit(); stockSaved();
    setTimeout(() => { const el = document.querySelector(`[data-stock="item-name"][data-id="${it.id}"]`); if (el) { el.focus(); el.select(); } }, 0);
  },
  'stock-item-del': (d) => {
    const list = stockListOf(d.id); if (!list) return;
    const it = list.find(i => i.id === d.id);
    confirmBox('Supprimer « ' + it.name + ' » ?', 'Elle disparaît du stock.', 'Supprimer', true, () => { list.splice(list.indexOf(it), 1); commit(); stockSaved(); });
  },
  'stock-prop': (d) => stockPropAnswer(d.ok === '1', cfg.stock.prop && cfg.stock.prop.id),
  'stock-undo': (d) => {
    const h = cfg.stock.history.find(x => x.id === d.id); if (!h) return;
    confirmBox('Annuler « ' + h.title + ' » ?', 'Les quantités reviennent comme avant cette validation.', 'Annuler la validation', false, () => {
      if (stockUndo(cfg.stock, d.id)) { commit(); stockSaved(); toast('Validation annulée.', 'ok'); }
    });
  },
  'stock-q': (d) => { const x = stockFindItem(d.id); if (!x) return; x.item.q = stockInt(x.item.q + +d.d); commit(); stockSaved(); }
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
  commit(true); stockSaved();
});
// en quittant un champ : on redessine (couleurs, compteurs, noms dans la liste). Si on quitte le champ en cliquant
// sur un bouton, on attend la fin du clic : redessiner pendant le clic le ferait disparaître sous le doigt.
let stockPending = false, stockPointer = false;
const stockFlush = () => { if (stockPending && !stockPointer && ui.view === 'stock') { stockPending = false; render(); } };
document.addEventListener('change', (ev) => { if (ev.target && ev.target.dataset && ev.target.dataset.stock) { stockPending = true; setTimeout(stockFlush, 0); } });
document.addEventListener('pointerdown', () => { stockPointer = true; }, true);
document.addEventListener('pointerup', () => { stockPointer = false; setTimeout(stockFlush, 30); }, true);

// ---------- sur l'écran : espace « Stock » ----------
// Une vue = { cat, sub, part } : catégorie n° cat ; sub = n° du tiroir ouvert (ou null) ; part = morceau de 12 (tiroirs ou pièces)
const isStock = (s) => !!s && s.layout === 'stock';
const STOCK_PER = 12;
function stockClampView(v) {
  const cats = cfg.stock.cats;
  const cat = Math.max(0, Math.min((v && v.cat) || 0, cats.length - 1));
  const c = cats[cat];
  let sub = v && v.sub != null && c && c.sub && c.subs[v.sub] ? v.sub : null;
  const n = !c ? 0 : c.sub ? (sub != null ? c.subs[sub].items.length : c.subs.length) : c.items.length;
  const parts = Math.max(1, Math.ceil(n / STOCK_PER));
  const part = Math.max(0, Math.min((v && v.part) || 0, parts - 1));
  return { cat, sub, part, parts, aide: !!(v && v.aide) };
}
// toutes les vues d'un espace Stock (une page d'image chacune sur l'écran)
function stockViews() {
  const out = [];
  const cats = cfg.stock.cats;
  if (!cats.length) return [{ cat: 0, sub: null, part: 0 }, { cat: 0, sub: null, part: 0, aide: true }];
  cats.forEach((c, i) => {
    const n0 = c.sub ? c.subs.length : c.items.length;
    for (let p = 0; p < Math.max(1, Math.ceil(n0 / STOCK_PER)); p++) out.push({ cat: i, sub: null, part: p });
    if (c.sub) c.subs.forEach((s, j) => { for (let p = 0; p < Math.max(1, Math.ceil(s.items.length / STOCK_PER)); p++) out.push({ cat: i, sub: j, part: p }); });
  });
  out.push({ cat: 0, sub: null, part: 0, aide: true });   // page « Aide » : les phrases pour Claude
  return out;
}
const stockViewKey = (spaceId, v) => v.aide ? `stock:${spaceId}:aide` : `stock:${spaceId}:${v.cat}:${v.sub == null ? '-' : v.sub}:${v.part || 0}`;

function deckStock(space, sim, view) {
  const look = lookFor(space);
  const cats = cfg.stock.cats;
  const v = stockClampView(view || {});
  const prop = cfg.stock.prop && !v.aide && v.cat === 0 && v.sub == null && v.part === 0 ? cfg.stock.prop : null;   // proposition : sur la 1re vue
  const popOpen = !!(cats[v.cat] && cats[v.cat].sub && v.sub != null) || !!prop || v.aide;
  const S = (attrs) => sim && !popOpen ? attrs : '';   // tiroir ouvert : seules ses lignes se touchent
  const P = (attrs) => sim ? attrs : '';
  const all = stockAll(cfg.stock).map(x => x.item), tot = stockCounts(all);
  const sum = !cats.length ? '' : tot.out || tot.low ? `<span style="color:${tot.out ? '#FF8A95' : '#FFB547'}">${tot.out ? tot.out + ' épuisée' + (tot.out > 1 ? 's' : '') : ''}${tot.out && tot.low ? ' · ' : ''}${tot.low ? tot.low + ' en stock bas' : ''}</span>` : `${all.length} pièce${all.length > 1 ? 's' : ''}`;
  const top = `<div class="dtop"><div class="dtabs">${popOpen ? homeBtn(look, false) : homeBtn(look, sim)}<div class="dtab disp" style="border-color:${look.accent};color:${look.accent}">${esc(space.name).toUpperCase()}</div></div><div class="dstright2"><div class="dstsum">${sum}</div><div class="dsthelp disp" ${S('data-simstock="aide"')}>AIDE</div></div></div>`;
  const extra = v.aide ? stockAidePop(look, P) : prop ? stockPropPop(prop, P) : '';
  if (!cats.length) return deckFrame(look, top + '<div class="dstempty">Ajoutez vos catégories et vos pièces dans le logiciel, menu « Stock ».</div>' + extra, '', spaceOverlay(space, sim));
  const c = cats[v.cat];
  const color = (st) => st === 'out' ? '#FF8A95' : st === 'low' ? '#FFB547' : '#3FB97A';
  const left = cats.slice(0, 7).map((x, i) => {
    const k = stockCounts(x.sub ? [].concat(...x.subs.map(y => y.items)) : x.items);
    const on = i === v.cat;
    return `<div class="dstcat${on ? ' on' : ''}" style="${on ? `border-color:${look.accent};color:${look.accent}` : ''}" ${S(`data-simstock="cat" data-i="${i}"`)}><span class="dstbar" style="background:${x.color}"></span><span class="dstcn"><span class="disp">${esc(x.name)}</span><span class="dstcs">${esc(x.place || (x.sub ? x.subs.length + ' tiroir' + (x.subs.length > 1 ? 's' : '') : x.items.length + ' pièce' + (x.items.length > 1 ? 's' : '')))}</span></span>${k.out + k.low ? `<span class="dstbadge" style="background:${k.out ? '#FF6B78' : '#FFB547'}">${k.out + k.low}</span>` : ''}</div>`;
  }).join('');
  const pager = (parts, part, A) => (A = A || S, parts > 1) ? `<div class="dstpager"><div class="dstpg${part > 0 ? '' : ' off'}" ${part > 0 ? A(`data-simstock="part" data-p="${part - 1}"`) : ''}>‹</div><span>${part + 1} / ${parts}</span><div class="dstpg${part < parts - 1 ? '' : ' off'}" ${part < parts - 1 ? A(`data-simstock="part" data-p="${part + 1}"`) : ''}>›</div></div>` : '';
  const rowsOf = (items, part, A) => (A = A || S, items).slice(part * STOCK_PER, part * STOCK_PER + STOCK_PER).map(it => {
    const st = stockState(it);
    return `<div class="dstrow" style="${st === 'out' ? 'border-color:#FF4D5E' : ''}"><span class="dstrn">${esc(it.name)}</span><div class="dstbtn m" style="border-color:${look.accent};color:${look.accent}" ${A(`data-simstock="q" data-id="${esc(it.id)}" data-d="-1"`)}>−</div><span class="dstq mono" style="color:${st === 'ok' ? '#E6EDF3' : color(st)}" ${A(`data-simstock="n" data-id="${esc(it.id)}" data-q="${it.q}" data-low="${it.low}"`)}>${it.q}</span><div class="dstbtn" ${A(`data-simstock="q" data-id="${esc(it.id)}" data-d="1"`)}>+</div></div>`;
  }).join('');
  let right;
  if (c.sub) {
    const tiles = c.subs.slice(v.part * STOCK_PER, v.part * STOCK_PER + STOCK_PER).map((s, k) => {
      const j = v.part * STOCK_PER + k, n = stockCounts(s.items);
      const st = n.out ? 'out' : n.low ? 'low' : 'ok';
      const txt = !s.items.length ? 'vide' : n.out ? `${n.out} épuisée${n.out > 1 ? 's' : ''}` : n.low ? `${n.low} en stock bas` : 'tout va bien';
      return `<div class="dsttile" style="border-color:${st === 'out' ? '#FF4D5E' : st === 'low' ? '#7A5A2A' : '#26303A'}" ${S(`data-simstock="sub" data-j="${j}"`)}><span class="dstid mono">Tiroir ${String.fromCharCode(65 + (j % 26))}</span><span class="dsttn">${esc(s.name)}</span><span class="dstts">${s.items.length > 1 ? s.items.length + ' sortes' : s.items.length ? esc(s.items[0].name) : ''}</span><span class="dstst" style="color:${s.items.length ? color(st) : '#8E9BA8'}">${txt}</span></div>`;
    });
    while (tiles.length < STOCK_PER) tiles.push('<div class="dsttile empty"></div>');
    const drawerParts = Math.max(1, Math.ceil(c.subs.length / STOCK_PER));
    right = `<div class="dstright"><div class="dstgrid">${c.subs.length ? tiles.join('') : '<div class="dstempty">Aucun tiroir : ajoutez-en dans le logiciel.</div>'}</div>${v.sub == null ? pager(drawerParts, v.part) : ''}</div>`;
  } else {
    right = `<div class="dstright"><div class="dsthead disp">${esc(c.name)}</div><div class="dstrows">${c.items.length ? rowsOf(c.items, v.part) : '<div class="dstempty">Aucune pièce : ajoutez-en dans le logiciel.</div>'}</div>${pager(v.parts, v.part)}</div>`;
  }
  let pop = '';
  if (c.sub && v.sub != null) {
    const s = c.subs[v.sub];
    pop = `<div class="dstdim" ${P('data-simstock="close"')}></div><div class="dstpop" style="border-color:${look.accent}"><div class="dstph"><div><div class="dstpw">${esc(c.name)} · Tiroir ${String.fromCharCode(65 + (v.sub % 26))}</div><div class="disp dstpt">${esc(s.name)}</div></div><div class="dstx" ${P('data-simstock="close"')}>✕</div></div><div class="dstrows">${s.items.length ? rowsOf(s.items, v.part, P) : '<div class="dstempty">Tiroir vide.</div>'}</div>${pager(v.parts, v.part, P)}</div>`;
  }
  return deckFrame(look, `${top}<div class="dstbody"><div class="dstleft">${left}</div>${right}</div>${extra ? '' : pop}${extra}`, '', spaceOverlay(space, sim));
}
// fenêtre « Proposition de Claude » (VALIDER / REFUSER)
function stockPropPop(p, P) {
  const MAX = 7;
  const rows = p.changes.slice(0, MAX).map(ch => {
    const x = ch.id ? stockFindItem(ch.id) : null, before = x ? x.item.q : 0;
    return `<div class="dstprow"><span class="dstrn">${esc(ch.name)}<span class="dstcs"> ${esc(ch.path)}</span></span><span class="mono" style="color:${ch.d > 0 ? '#3FB97A' : '#FFB547'}">${ch.d > 0 ? '+' : '−'}${Math.abs(ch.d)}</span><span class="mono dstcs">${before} → ${stockInt(before + ch.d)}</span></div>`;
  }).join('') + (p.changes.length > MAX ? `<div class="dstcs">+ ${p.changes.length - MAX} autre${p.changes.length - MAX > 1 ? 's' : ''} (voir le logiciel, onglet Stock)</div>` : '');
  return `<div class="dstdim"></div><div class="dstpop" style="border-color:#8E9BFF"><div class="dstph"><div><div class="dstpw" style="color:#8E9BFF">Proposition de Claude</div><div class="disp dstpt">${esc(p.title)}</div></div></div>
    <div class="dstplist">${rows}</div>
    <div class="dstpbtns"><div class="dstpbtn no disp" ${P(`data-simstock="prop" data-op="non" data-id="${esc(p.id)}"`)}>REFUSER</div><div class="dstpbtn ok disp" ${P(`data-simstock="prop" data-op="ok" data-id="${esc(p.id)}"`)}>VALIDER</div></div></div>`;
}
// fenêtre « Aide » : les phrases à écrire à Claude
function stockAidePop(look, P) {
  return `<div class="dstdim" ${P('data-simstock="close"')}></div><div class="dstpop" style="border-color:${look.accent}"><div class="dstph"><div><div class="dstpw">Stock · Claude</div><div class="disp dstpt">Les phrases à écrire à Claude</div></div><div class="dstx" ${P('data-simstock="close"')}>✕</div></div>
    <div class="dstplist">${STOCK_PHRASES.map(([a, b]) => `<div class="dstaide"><span class="mono" style="color:${look.accent}">« ${esc(a)} »</span><span class="dstcs">${esc(b)}</span></div>`).join('')}</div>
    <div class="dstcs">Claude ne fait que proposer : rien ne change dans le stock sans VALIDER sur cet écran.</div></div>`;
}

// ---------- quantités changées depuis l'écran (ou l'aperçu) ----------
function stockDelta(id, d) {
  const x = stockFindItem(String(id)); if (!x) return null;
  const before = x.item.q;
  x.item.q = stockInt(before + (+d || 0));
  return x.item.q !== before ? x : null;
}
function stockFromDeck(m) {
  const x = stockDelta(m.id, m.d);
  if (!x) {
    if (!stockFindItem(String(m.id))) toast('L’écran montre une pièce qui n’existe plus : cliquez sur « Envoyer sur l’écran ».', 'err', 7000);
    return;
  }
  toast(`${x.item.name} : ${x.item.q}`, 'ok', 1500);   // on voit dans le logiciel que l'appui est arrivé
  commit(ui.view !== 'stock');   // l'onglet Stock ouvert : on le redessine pour voir le nouveau nombre
  if (ui.view === 'stock') render();
  if (typeof pgLiveRefresh === 'function') pgLiveRefresh();
}
// aperçu de l'écran : mêmes gestes
function simStock(m, d) {
  const v = stockClampView(m.stock || {});
  if (d.simstock === 'aide') m.stock = { cat: 0, sub: null, part: 0, aide: true };
  else if (d.simstock === 'prop') stockPropAnswer(d.op === 'ok', d.id);
  else if (d.simstock === 'cat') m.stock = { cat: +d.i, sub: null, part: 0 };
  else if (d.simstock === 'sub') m.stock = { cat: v.cat, sub: +d.j, part: 0 };
  else if (d.simstock === 'close') m.stock = { cat: v.cat, sub: null, part: 0 };
  else if (d.simstock === 'part') m.stock = { cat: v.cat, sub: v.sub, part: +d.p };
  else if (d.simstock === 'q') { if (stockDelta(d.id, d.d)) { commit(true); if (typeof pgLiveRefresh === 'function') pgLiveRefresh(); } }
}

// ---------- Claude : questions arrivées par le lien (main.js → claude-ask) ----------
function stockClaudeOp(op, args) {
  const st = cfg && cfg.stock; if (!st) return { erreur: 'The Deck démarre encore.' };
  if (op === 'lire') return { resultat: stockForClaude(st) };
  if (op === 'etat') return { resultat: { id: String(args.id || ''), etat: stockPropState(st, String(args.id || '')) } };
  if (op === 'proposer') {
    const r = stockPropBuild(st, args); if (r.erreur) return r;
    if (st.prop) st.history.push({ id: 'h' + stockId(), prop: st.prop.id, at: Date.now(), title: st.prop.title, status: 'remplacee', undone: false, changes: [] });
    st.prop = r.prop;
    commit(ui.view !== 'stock'); if (ui.view === 'stock') render();
    toast('Claude propose : « ' + r.prop.title + ' ». À valider sur l’écran.', 'ok', 6000);
    stockShowProp();
    const warn = r.prop.changes.filter(ch => { const x = ch.id && stockFindItem(ch.id); return x && x.item.q + ch.d < 0; }).map(ch => `« ${ch.name} » : il n’en reste que ${stockFindItem(ch.id).item.q}, la quantité s’arrêtera à 0.`);
    return { resultat: { id: r.prop.id, etat: 'affichée sur The Deck : en attente de VALIDER ou REFUSER (rien n’est encore changé)', avertissements: warn } };
  }
  return { erreur: 'Demande inconnue.' };
}
if (typeof api !== 'undefined' && api.onClaudeAsk) api.onClaudeAsk((q) => {
  let r; try { r = stockClaudeOp(q.op, q.args || {}); } catch (e) { r = { erreur: String(e && e.message || e) }; }
  api.claudeAnswer(q.rid, r);
});
// montre la proposition sur l'écran : redessine la page, puis l'affiche (programme de l'écran 0.5.2 : pg-show)
function stockShowProp() {
  if (typeof pgLiveRefresh === 'function') pgLiveRefresh(0);
  const sp = homeSpaces().find(isStock);
  const sent = ui.pgSent;
  if (!sp || !sent || !ui.deckLinked || !ui.deckFw || fwOlder(ui.deckFw, '0.5.2')) return;
  const i = sent.keys.indexOf(stockViewKey(sp.id, { cat: 0, sub: null, part: 0 }));
  if (i >= 0) deckWrite({ t: 'pg-show', page: i });
}
// VALIDER / REFUSER (écran, aperçu ou logiciel)
function stockPropAnswer(ok, id) {
  const st = cfg.stock, p = st.prop;
  if (!p || (id && id !== p.id)) { toast('Cette proposition n’est plus en attente.', 'err'); if (typeof pgLiveRefresh === 'function') pgLiveRefresh(); return; }
  st.prop = null;
  if (ok) { st.history.push(stockPropApply(st, p)); toast('Stock mis à jour : ' + p.title, 'ok', 4000); }
  else { st.history.push({ id: 'h' + stockId(), prop: p.id, at: Date.now(), title: p.title, status: 'non', undone: false, changes: [] }); toast('Proposition refusée : rien n’a changé.', 'ok', 3000); }
  if (st.history.length > 200) st.history.splice(0, st.history.length - 200);
  commit(); stockSaved();
}
