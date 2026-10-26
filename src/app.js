// The Deck — interface du logiciel
'use strict';

// ---------------------------------------------------------------------------
// Accès au système (logiciel installé) ou repli « navigateur » pour l'aperçu
// ---------------------------------------------------------------------------
const api = window.deck || (() => {
  const KEY = 'cockpit-deck-config';
  const download = (name, text) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; a.click();
  };
  return {
    browser: true,
    loadConfig: async () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    saveConfig: async (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* trop gros ou bloqué */ } return true; },
    createBackup: async () => null,
    listBackups: async () => [],
    readBackup: async () => null,
    openBackupsFolder: async () => null,
    exportSpace: async (space) => { download((space.name || 'espace') + '.deck', JSON.stringify({ format: 'cockpit-deck-espace', version: 1, space })); return space.name + '.deck'; },
    importSpace: () => new Promise((resolve) => {
      const inp = document.getElementById('file-import');
      inp.onchange = () => {
        const f = inp.files[0]; inp.value = '';
        if (!f) { resolve(null); return; }
        f.text().then(t => { try { const d = JSON.parse(t); resolve(d.space || { error: 'Ce fichier n\u2019est pas un espace The Deck.' }); } catch (e) { resolve({ error: 'Fichier illisible.' }); } });
      };
      inp.click();
    }),
    chooseExe: async () => null,
    runApp: async () => ({ ok: false, message: 'Disponible dans le logiciel installé sur Windows.' }),
    version: async () => 'aperçu',
    env: async () => ({}),
    setStartWithWindows: async (on) => on,
    setShortcuts: async () => ({}),
    onShortcut: () => {},
    discordConnect: async () => ({ status: 'error', message: 'Disponible dans le logiciel installé sur Windows.' }),
    discordDisconnect: async () => ({ status: 'off', message: '' }),
    discordState: async () => ({ status: 'off', message: '' }),
    mediaWatch: async () => true,
    mediaKey: async () => false,
    onMediaState: () => {},
    discordRun: async () => ({ ok: false, message: 'Disponible dans le logiciel installé sur Windows.' }),
    onDiscordState: () => {}
  };
})();

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
function svg(key, size, color, sw) {
  const p = PICTOS[key] ? PICTOS[key][3] : PICTOS.plus[3];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p}"/></svg>`;
}
// Logo The Deck (piste 2 « Profil ») : le flanc du pied à lamelles et l'écran incliné
const LOGO_BODY = 'M16 88H86V18Z M41.5 72H76.5A3.5 3.5 0 0 1 76.5 79H41.5A3.5 3.5 0 0 1 41.5 72Z M53.5 60H76.5A3.5 3.5 0 0 1 76.5 67H53.5A3.5 3.5 0 0 1 53.5 60Z M65.5 48H76.5A3.5 3.5 0 0 1 76.5 55H65.5A3.5 3.5 0 0 1 65.5 48Z';
function logoMark(size, fg, acc, label) {
  const sw = size < 40 ? 9 : 8;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" ${label ? 'role="img" aria-label="The Deck"' : 'aria-hidden="true"'}><path d="${LOGO_BODY}" fill="${fg}" fill-rule="evenodd"/><path d="M9 81L79 11" fill="none" stroke="${acc}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
}
function logoLockup(size, fg, acc, fontSize) {
  return `${logoMark(size, fg, acc, true)}<span class="disp" style="font-size:${fontSize};letter-spacing:.12em;white-space:nowrap"><span style="color:${acc}">THE</span> DECK</span>`;
}
function toast(msg, kind, ms) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms || 4200);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PC_KEYS = (() => {
  const list = [];
  ['', 'Shift+', 'Control+', 'Alt+'].forEach(m => { for (let i = 13; i <= 24; i++) list.push(m + 'F' + i); });
  return list;
})();

function newSpace(category, tpl, name, exe, scenes) {
  const pages = tpl.pages(scenes).map(p => ({ id: uid(), name: p.name, cells: p.cells.map(c => c ? clone(c) : null) }));
  const sp = { id: uid(), name: name || tpl.name, category, icon: tpl.icon || catOf(category).icon, onHome: true, autoExe: exe || '', look: null, pages };
  if (tpl.layout === 'player') { sp.layout = 'player'; sp.player = { volume: true, coverBg: true }; }
  return sp;
}

function defaultConfig() {
  const sc = newSpace('jeu', TEMPLATES.jeu[0], 'Star Citizen', 'StarCitizen.exe');
  const bu = newSpace('bureau', TEMPLATES.bureau[0], 'Bureau', '');
  const st = newSpace('stream', TEMPLATES.stream[0], 'Stream', 'obs64.exe');
  const dc = newSpace('discord', TEMPLATES.discord[0], 'Discord', '');
  const sp = newSpace('spotify', TEMPLATES.spotify[0], 'Spotify', '');
  return {
    format: 'cockpit-deck', version: 1,
    spaces: [sc, bu, st, dc, sp],
    homeOrder: [sc.id, bu.id, st.id, dc.id, sp.id],
    discordSpaceAdded: true,
    spotifySpaceAdded: true,
    cats: [],
    look: clone(DEFAULT_LOOK),
    obs: { host: '127.0.0.1', port: 4455, password: '', autoConnect: false },
    discord: { clientId: '', clientSecret: '', autoConnect: false, shortcuts: [] },
    device: { brightness: 80, sleepMin: 10, swipe: true, loop: false },
    settings: { startWithWindows: true }
  };
}

let cfg = null;
const ui = { view: 'espaces', spaceId: null, page: 0, cell: null, menu: null, modal: null, catFilter: 'Tous', search: '' };
let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { api.saveConfig(cfg); }, 400);
}
function commit(noRender) { assignHotkeys(); scheduleSave(); if (typeof updateMediaWatch === 'function') updateMediaWatch(); if (!noRender) render(); }

const spaceById = (id) => cfg.spaces.find(s => s.id === id);
const curSpace = () => spaceById(ui.spaceId);
const curPage = () => { const s = curSpace(); return s ? s.pages[Math.min(ui.page, s.pages.length - 1)] : null; };
const curCell = () => { const p = curPage(); return p && ui.cell != null ? p.cells[ui.cell] : null; };
// Catégories : les quatre d'origine + celles créées par l'utilisateur
const catOf = (k) => CATEGORIES[k] || ((cfg && cfg.cats) || []).find(c => c.id === k) || CATEGORIES.jeu;
const catKeys = () => Object.keys(CATEGORIES).concat(((cfg && cfg.cats) || []).map(c => c.id));
const isCustomCat = (k) => !CATEGORIES[k];
const tplsOf = (k) => TEMPLATES[k] || [{ key: 'vide', name: 'Grille vide', desc: 'Une page vide à remplir comme vous voulez', icon: catOf(k).icon, exe: '', pages: () => [{ name: 'PAGE 1', cells: pad([]) }] }];
const HOME_PER_PAGE = 5;
const homeSpaces = () => cfg.homeOrder.map(spaceById).filter(s => s && s.onHome);
const homePages = () => Math.max(1, Math.ceil(homeSpaces().length / HOME_PER_PAGE));
const shortcutById = (id) => (cfg.discord.shortcuts || []).find(x => x.id === id);
const DSTATE0 = { status: 'off', message: '', mute: false, deaf: false, outVolume: 100, inputId: '', outputId: '', inputs: [], outputs: [] };
let dstate = Object.assign({}, DSTATE0);
const setD = (st) => { dstate = Object.assign({}, DSTATE0, st || {}); };
const lookFor = (space) => (space && space.look) ? space.look : cfg.look;

// Touches réservées (F13…F24) pour les actions faites par le PC : ouvrir une appli, OBS
function assignHotkeys() {
  const used = new Set();
  const needs = [];
  cfg.spaces.forEach(s => s.pages.forEach(p => p.cells.forEach(c => {
    if (!c || !c.action) return;
    const pc = c.action.type === 'app' || c.action.type === 'obs' || (c.action.type === 'discord' && c.action.op !== 'raccourci');
    if (!pc) { delete c.action.hotkey; return; }
    if (c.action.hotkey && !used.has(c.action.hotkey) && PC_KEYS.includes(c.action.hotkey)) used.add(c.action.hotkey);
    else { delete c.action.hotkey; needs.push(c); }
  })));
  needs.forEach(c => { const k = PC_KEYS.find(x => !used.has(x)); if (k) { c.action.hotkey = k; used.add(k); } });
  const list = [];
  cfg.spaces.forEach(s => s.pages.forEach((p, pi) => p.cells.forEach((c, ci) => {
    if (c && c.action && c.action.hotkey) list.push({ accel: c.action.hotkey, id: `${s.id}|${pi}|${ci}` });
  })));
  api.setShortcuts(list);
}

api.onShortcut((id) => {
  const [sid, pi, ci] = id.split('|');
  const s = spaceById(sid);
  const c = s && s.pages[+pi] && s.pages[+pi].cells[+ci];
  if (c) runPcAction(c, false);
});

async function runPcAction(c, fromTest) {
  const a = c.action;
  if (a.type === 'app') {
    const r = await api.runApp(resolveApp(a));
    if (fromTest || !r.ok) toast(r.message, r.ok ? 'ok' : 'err');
  } else if (a.type === 'obs') {
    try { await OBS.run(a); if (fromTest) toast('OBS : action envoyée.', 'ok'); }
    catch (e) { toast('OBS : ' + e.message, 'err'); }
  } else if (a.type === 'discord') {
    const r = await api.discordRun(a.op, a.arg);
    if (fromTest || !r.ok) toast('Discord : ' + r.message, r.ok ? 'ok' : 'err');
  }
}
function resolveApp(a) {
  const p = APP_PRESETS[a.preset] || APP_PRESETS.autre;
  return { exe: a.exe || p.exe, args: a.args || p.args || '', processName: a.processName || p.processName || '', screen: a.screen, position: a.position, ifOpen: a.ifOpen };
}

// ---------------------------------------------------------------------------
// Rendu : écran tactile (aperçu et simulateur)
// ---------------------------------------------------------------------------
function cellSub(c) {
  const a = c.action || {};
  if (a.type === 'joy') return 'JOY ' + (a.button || '?');
  if (a.type === 'key') return a.keys || 'Touche';
  if (a.type === 'media') return 'MÉDIA';
  if (a.type === 'app') return 'APPLI';
  if (a.type === 'obs') return 'OBS';
  if (a.type === 'discord') { if (a.op !== 'raccourci') return 'DISCORD'; const sc = shortcutById(a.arg); return sc ? (sc.keys || 'DISCORD') : 'DISCORD'; }
  if (a.type === 'page') return 'PAGE';
  return '';
}
function deckCell(c, look, opts) {
  if (!c) return '<div class="dempty"></div>';
  const on = opts && opts.on;
  const prog = opts && opts.prog;
  const photoBg = look.bgType === 'photo' && look.bgPhoto;
  const light = !photoBg && ['#D9CBB0', '#DDE3E9', '#F5F7FA'].includes(look.bgColor);
  const fill = photoBg ? 'rgba(10,12,22,.6)' : (light ? 'rgba(255,255,255,.78)' : '#11161C');
  const idleTxt = light ? '#1B232C' : '#E6EDF3';
  const im = c.image || {};
  const edge = on ? `2px solid ${look.accent}` : `1.5px solid ${photoBg && look.idleEdge === '#26303A' ? 'rgba(201,214,226,.28)' : look.idleEdge}`;
  const txt = on ? look.accent : idleTxt;
  const icoCol = on ? look.accent : (im.color || '#9FB0C0');
  let inner = '';
  if (im.type === 'photo' && im.photo) {
    inner += `<div class="ph" style="background-image:url('${im.photo}')"></div>`;
    if (im.showName !== false) inner += `<div class="shade" style="opacity:${0.4 + (im.dim || 0)}"></div>`;
    inner += '<span></span>';
    if (im.showName !== false) inner += `<div><div class="dnm disp" style="color:${on ? look.accent : '#fff'}">${esc(c.name)}</div></div>`;
  } else {
    inner += im.type === 'text' ? '<span></span>' : `<div class="dico">${svg(im.icon || 'plus', 24, icoCol)}</div>`;
    inner += `<div><div class="dnm disp" style="color:${txt}${im.type === 'text' ? ';font-size:calc(var(--u) * 2.6)' : ''}">${esc(c.name)}</div></div>`;
  }
  if (prog != null) inner += `<div class="bar" style="width:${prog}%;background:${look.accent}"></div>`;
  return `<div class="dcell" style="background:${fill};border:${edge}${photoBg ? ';backdrop-filter:blur(6px)' : ''}" ${opts && opts.attrs ? opts.attrs : ''}>${inner}</div>`;
}
function deckFrame(look, inner, extra) {
  let bg = extra || '';
  if (!extra && look.bgType === 'photo' && look.bgPhoto) bg = `<div class="bgph" style="background-image:url('${look.bgPhoto}')"></div><div class="bgdim" style="opacity:${look.bgDim || 0}"></div>`;
  return `<div class="deck" style="background:${look.bgType === 'photo' && look.bgPhoto ? '#000' : look.bgColor}">${bg}<div class="scr">${inner}</div></div>`;
}
// ---------- Lecteur (Spotify) ----------
const isPlayer = (s) => s && s.layout === 'player';
let mstate = { title: '', artist: '', album: '', status: '', cover: '', app: '', none: true, unavailable: !!api.browser, message: api.browser ? 'Disponible dans le logiciel installé sur Windows.' : '' };
const P_ICONS = {
  prev: '<path d="M7 5v14" stroke-width="2.4" stroke-linecap="round"/><path d="M19 5.5v13L9 12z" fill="currentColor" stroke-linejoin="round" stroke-width="1.6"/>',
  next: '<path d="M17 5v14" stroke-width="2.4" stroke-linecap="round"/><path d="M5 5.5v13L15 12z" fill="currentColor" stroke-linejoin="round" stroke-width="1.6"/>',
  play: '<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke-linejoin="round" stroke-width="1.6"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3.2" stroke-linecap="round"/>',
  vmoins: '<path d="M3.5 9.5h3.5l4.5-4v13l-4.5-4H3.5z" fill="currentColor" stroke-linejoin="round" stroke-width="1.4"/><path d="M15 12h6" stroke-width="2.2" stroke-linecap="round"/>',
  vplus: '<path d="M3.5 9.5h3.5l4.5-4v13l-4.5-4H3.5z" fill="currentColor" stroke-linejoin="round" stroke-width="1.4"/><path d="M15 12h6M18 9v6" stroke-width="2.2" stroke-linecap="round"/>'
};
const pIcon = (k, cls) => `<svg viewBox="0 0 24 24" class="${cls || ''}" fill="none" stroke="currentColor" aria-hidden="true">${P_ICONS[k]}</svg>`;
function deckPlayer(space, sim) {
  const look = lookFor(space);
  const o = space.player || { volume: true, coverBg: true };
  const m = mstate;
  const has = !m.none && !m.unavailable && (m.title || m.artist);
  const playing = sim && sim.playing != null ? sim.playing : m.status === 'Playing';
  const btn = (k, cls, icon) => `<div class="pbtn ${cls}" ${sim ? `data-simbtn="${k}"` : ''}>${pIcon(icon || k)}</div>`;
  const cover = has && m.cover ? `<div class="pcover" style="background-image:url('${m.cover}')"></div>` : `<div class="pcover empty">${svg('musique', 60, '#5B6875', 1.4)}</div>`;
  const info = has
    ? `<div class="pinfo"><div class="ptitle disp">${esc(m.title)}</div><div class="partist">${esc(m.artist)}</div>${m.album ? `<div class="palbum">${esc(m.album)}</div>` : ''}<div class="pstate" style="color:${look.accent}">${playing ? 'En lecture' : 'En pause'}</div></div>`
    : `<div class="pinfo"><div class="ptitle disp">Rien en lecture</div><div class="partist">${esc(m.unavailable ? (m.message || 'Lecteur indisponible') : 'Lancez un morceau dans Spotify')}</div></div>`;
  const tabs = `<div class="dtabs"><div class="dtab home" ${sim ? 'data-sim="home"' : ''}>${svg('maison', 16, '#C9D6E2')}</div></div>`;
  const inner = `<div class="dtop">${tabs}<div class="small disp" style="color:#C9D6E2;font-size:1.6cqw">${esc(space.name)}</div></div>
    <div class="dplayer${sim && sim.anim ? ' ' + sim.anim : ''}">${btn('prev', 'pside')}<div class="pmid">${cover}${info}</div>${btn('next', 'pside')}</div>
    <div class="pctrl">${o.volume !== false ? btn('vmoins', 'pvol') : ''}${btn('play', 'pbig', playing ? 'pause' : 'play')}${o.volume !== false ? btn('vplus', 'pvol') : ''}</div>`;
  const extra = o.coverBg !== false && has && m.cover ? `<div class="pbg" style="background-image:url('${m.cover}')"></div><div class="pbgdim"></div>` : '';
  return deckFrame(look, inner, extra);
}
function deckPage(space, pageIdx, sim) {
  if (isPlayer(space)) return deckPlayer(space, sim);
  const look = lookFor(space);
  const page = space.pages[pageIdx] || space.pages[0];
  const tabs = `<div class="dtabs"><div class="dtab home" ${sim ? 'data-sim="home"' : ''}>${svg('maison', 16, '#C9D6E2')}</div>` +
    space.pages.map((p, i) => `<div class="dtab disp" ${sim ? `data-sim="page" data-i="${i}"` : ''} style="${i === pageIdx ? `border-color:${look.accent};color:${look.accent}` : ''}">${esc(p.name)}</div>`).join('') + '</div>';
  const cells = page.cells.map((c, i) => {
    const st = sim ? sim.cells[`${space.id}|${pageIdx}|${i}`] || {} : {};
    return deckCell(c, look, { on: st.on || st.flash, prog: st.prog, attrs: sim && c ? `data-simcell="${i}"` : '' });
  }).join('');
  return deckFrame(look, `<div class="dtop">${tabs}<div class="small disp" style="color:#C9D6E2;font-size:1.6cqw">${esc(space.name)}</div></div><div class="dgrid${sim && sim.anim ? ' ' + sim.anim : ''}">${cells}</div>`);
}
function deckHome(sim, pageArg) {
  const look = cfg.look;
  const all = homeSpaces();
  const nPages = homePages();
  const pg = Math.min(sim ? (sim.homePage || 0) : (pageArg || 0), nPages - 1);
  const spaces = all.slice(pg * HOME_PER_PAGE, pg * HOME_PER_PAGE + HOME_PER_PAGE);
  const cards = spaces.map(s => {
    const cat = catOf(s.category);
    return `<div class="dhcard" style="background:#11161C;border:1.5px solid ${look.idleEdge}" ${sim ? `data-sim="space" data-id="${s.id}"` : ''}>${svg(s.icon, 40, cat.color, 1.6)}<div><div class="t disp">${esc(s.name)}</div><div class="s">${isPlayer(s) ? 'Lecteur' : `${s.pages.length} page${s.pages.length > 1 ? 's' : ''}`}</div></div></div>`;
  });
  while (cards.length < HOME_PER_PAGE) cards.push('<div class="dempty"></div>');
  cards.push(`<div class="dhcard" style="background:#11161C;border:1.5px solid ${look.idleEdge}">${svg('reglages', 40, '#9FB0C0', 1.6)}<div><div class="t disp">Réglages</div><div class="s">Luminosité · veille</div></div></div>`);
  const dots = nPages > 1 ? `<div class="ddots">${Array.from({ length: nPages }, (_, k) => `<i style="${k === pg ? `background:${look.accent}` : ''}"></i>`).join('')}</div>` : `<div style="color:#C9D6E2;font-size:1.5cqw">Choisissez un espace</div>`;
  return deckFrame(look, `<div class="dtop"><div style="display:flex;align-items:center;gap:1cqw;font-size:2.6cqw">${logoMark(36, '#E6EDF3', look.accent, true).replace('width="36" height="36"', 'style="width:4.2cqw;height:4.2cqw"')}<span class="disp" style="letter-spacing:.2cqw"><span style="color:${look.accent}">THE</span> DECK</span></div>${dots}</div><div class="dhome${sim && sim.anim ? ' ' + sim.anim : ''}">${cards.join('')}</div>`);
}

// ---------------------------------------------------------------------------
// Rendu : logiciel
// ---------------------------------------------------------------------------
function sidebar() {
  const items = [['espaces', 'Mes espaces'], ['accueil', 'Écran d\u2019accueil'], ['apparence', 'Apparence'], ['connexions', 'Connexions'], ['appareil', 'Appareil'], ['parametres', 'Paramètres']];
  const v = ui.view === 'editeur' ? 'espaces' : ui.view;
  const obsDot = OBS.state.status === 'on' ? 'ok' : (OBS.state.status === 'error' ? 'err' : '');
  return `<nav class="side" aria-label="Menu">
    <div class="logo">${logoLockup(30, '#E6EDF3', '#FFB547', '21px')}</div><div class="mono small" style="color:var(--dim);margin:-6px 0 6px 12px">version ${esc(ui.version || '')}</div>
    ${items.map(([k, l]) => `<button class="nav${v === k ? ' on' : ''}" data-act="nav" data-view="${k}">${l}</button>`).join('')}
    <div class="status">
      <span><i class="dot ${ui.deckOk || ui.deckLinked ? 'ok' : ''}"></i>${ui.deckOk ? 'Écran à jour' : (ui.deckLinked ? 'Écran relié en USB' : 'Écran : envoi non fait')}</span>
      <span><i class="dot ${obsDot}"></i>OBS ${OBS.state.status === 'on' ? 'connecté' : 'non connecté'}</span>
      <span><i class="dot ${dstate.status === 'on' ? 'ok' : (dstate.status === 'error' ? 'err' : '')}"></i>Discord ${dstate.status === 'on' ? 'connecté' : 'non connecté'}</span>
      ${api.browser ? '<span class="muted">Mode aperçu (navigateur)</span>' : ''}
    </div>
  </nav>`;
}

function viewEspaces() {
  const groups = catKeys().map(cat => {
    const list = cfg.spaces.filter(s => s.category === cat);
    const meta = catOf(cat);
    const cards = list.map(s => {
      const nb = s.pages.reduce((n, p) => n + p.cells.filter(Boolean).length, 0);
      const menu = ui.menu === s.id ? `<div class="menu" role="menu">
          <button data-act="space-rename" data-id="${s.id}">Renommer</button>
          <button data-act="space-dup" data-id="${s.id}">Dupliquer</button>
          <button data-act="space-movecat" data-id="${s.id}">Changer de catégorie…</button>
          <button data-act="space-export" data-id="${s.id}">Exporter…</button>
          <button class="red" data-act="space-del" data-id="${s.id}">Supprimer</button></div>` : '';
      return `<article class="card scard">
        <div class="row" style="justify-content:space-between">${svg(s.icon, 30, meta.color, 1.7)}<button class="iconbtn" aria-label="Options de l\u2019espace" data-act="space-menu" data-id="${s.id}">⋯</button></div>
        <div><div class="name disp">${esc(s.name)}</div><div class="small muted">${isPlayer(s) ? 'Lecteur : jaquette et commandes' : `${s.pages.length} page${s.pages.length > 1 ? 's' : ''} · ${nb} case${nb > 1 ? 's' : ''}`}</div></div>
        <div class="mono small" style="color:var(--dim)">${s.autoExe ? 'Auto : ' + esc(s.autoExe) : (cat === 'bureau' || cat === 'discord' || cat === 'spotify' ? 'Toujours disponible' : 'Pas de lancement auto')}</div>
        <div class="foot"><label class="chk"><input type="checkbox" data-act="space-home" data-id="${s.id}" ${s.onHome ? 'checked' : ''}>Sur l\u2019accueil</label>
        <button class="btn sm" data-act="open-space" data-id="${s.id}">Modifier</button></div>${menu}</article>`;
    }).join('');
    const tools = isCustomCat(cat) ? `<button class="btn sm" data-act="cat-edit" data-id="${cat}">Modifier</button><button class="btn sm danger" data-act="cat-del" data-id="${cat}">Supprimer</button>` : '';
    return `<section style="display:flex;flex-direction:column;gap:12px"><div class="row" style="gap:12px">${isCustomCat(cat) ? svg(meta.icon, 22, meta.color, 1.8) : ''}<h2 class="cat-title disp" style="color:${meta.color}">${esc(meta.label)}</h2>${tools}</div>
      <div class="cards">${cards}<button class="empty-add" data-act="new-space" data-cat="${cat}">${svg('plus', 28, '#C9D6E2')}<span class="disp" style="font-size:17px;text-transform:uppercase">Nouvel espace</span></button></div></section>`;
  }).join('');
  return `<div class="head"><div><h1 class="disp">Mes espaces</h1><div class="muted" style="margin-top:4px">Chaque espace a ses pages et ses cases. Modifiez-les ici, puis envoyez-les sur l\u2019écran.</div></div>
    <div class="row"><button class="btn" data-act="cat-new">+ Nouvelle catégorie</button><button class="btn" data-act="space-import">Importer un espace</button><button class="btn" data-act="simulate">Aperçu de l\u2019écran</button><button class="btn pri" data-act="send">Envoyer sur l\u2019écran</button></div></div>${groups}`;
}

function viewPlayer(s) {
  const cat = catOf(s.category);
  const o = s.player || (s.player = { volume: true, coverBg: true });
  const m = mstate;
  const state = m.unavailable ? (m.message || 'Indisponible') : (m.none ? 'Rien en lecture' : `${m.status === 'Playing' ? 'En lecture' : 'En pause'} : ${m.title}${m.artist ? ' — ' + m.artist : ''}`);
  const src = !m.none && m.app ? (/spotify/i.test(m.app) ? 'Spotify' : m.app.replace(/!.*$/, '').replace(/\.exe$/i, '')) : '';
  const tb = (k, label) => `<button class="btn" style="padding:0 12px" data-act="media-key" data-k="${k}" aria-label="${label}" title="${label}">${pIcon(k, 'ico20')}</button>`;
  return `<div class="head"><div><div class="crumb"><button data-act="nav" data-view="espaces">Mes espaces</button> › ${esc(cat.label)}</div><h1 class="disp">${esc(s.name)}</h1></div>
    <div class="row"><button class="btn" data-act="simulate" data-id="${s.id}">Aperçu de l\u2019écran</button><button class="btn pri" data-act="send">Envoyer sur l\u2019écran</button></div></div>
    <div class="editor"><div style="flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:10px"><span class="lab" style="margin:0">Sur l\u2019écran${m.none || m.unavailable ? '' : ' · le morceau qui joue en ce moment sur ce PC'}</span>${deckPlayer(s, null)}
      <div class="small muted">Sur l\u2019écran : touchez les flèches ou glissez le doigt vers la gauche ou la droite pour changer de morceau.</div></div>
    <div class="panel" style="flex:1 1 340px;min-width:0"><h2 class="disp">Lecteur</h2>
      <div><span class="lab">En ce moment</span><div style="line-height:1.5">${esc(state)}</div>${src ? `<div class="small muted">Source : ${esc(src)}</div>` : ''}</div>
      <div><span class="lab">Tester sur ce PC</span><div class="row" style="gap:6px;flex-wrap:nowrap">${tb('prev', 'Morceau précédent')}${tb('play', 'Lecture / pause')}${tb('next', 'Morceau suivant')}${tb('vmoins', 'Baisser le volume')}${tb('vplus', 'Monter le volume')}</div></div>
      <label class="chk"><input type="checkbox" data-act="pl-volume" ${o.volume !== false ? 'checked' : ''}>Afficher les boutons de volume</label>
      <label class="chk"><input type="checkbox" data-act="pl-coverbg" ${o.coverBg !== false ? 'checked' : ''}>Fond flouté avec la jaquette</label>
      <div class="note">Rien à connecter : le logiciel lit le morceau en cours avec les commandes multimédia de Windows, sans compte ni mot de passe Spotify. Ça marche aussi avec les autres lecteurs (navigateur, YouTube, Deezer…). Spotify est choisi en priorité quand il est ouvert. Le volume est celui de Windows.</div></div></div>`;
}

function viewEditeur() {
  const s = curSpace();
  if (!s) { ui.view = 'espaces'; return viewEspaces(); }
  if (isPlayer(s)) return viewPlayer(s);
  const page = curPage();
  const cat = catOf(s.category);
  const tabs = s.pages.map((p, i) => `<button class="ptab disp${i === ui.page ? ' on' : ''}" data-act="page" data-i="${i}">${esc(p.name)}</button>`).join('');
  const cells = page.cells.map((c, i) => {
    if (!c) return `<button class="ecell empty${ui.cell === i ? ' sel' : ''}" data-act="cell" data-i="${i}" draggable="true" data-drag="${i}" aria-label="Case vide ${i + 1}">+</button>`;
    const im = c.image || {};
    const ph = im.type === 'photo' && im.photo ? `<div class="ph" style="background-image:url('${im.photo}')"></div>` : '';
    const ico = im.type === 'icon' ? svg(im.icon, 22, ui.cell === i ? '#5CC8FF' : (im.color || '#9FB0C0')) : '<span></span>';
    return `<button class="ecell${ui.cell === i ? ' sel' : ''}" data-act="cell" data-i="${i}" draggable="true" data-drag="${i}">${ph}
      <div class="top">${ico}<span class="bind">${esc(cellSub(c))}</span></div><div class="nm disp" style="${ph ? 'text-shadow:0 1px 3px #000' : ''}">${esc(c.name)}</div></button>`;
  }).join('');
  return `<div class="head"><div><div class="crumb"><button data-act="nav" data-view="espaces">Mes espaces</button> › ${cat.label}</div><h1 class="disp">${esc(s.name)}</h1></div>
    <div class="row"><button class="btn" data-act="simulate" data-id="${s.id}">Aperçu de l\u2019écran</button><button class="btn pri" data-act="send">Envoyer sur l\u2019écran</button></div></div>
    <div class="tabs">${tabs}<button class="ptab add disp" data-act="page-add">+ PAGE</button>
      <span style="flex:1"></span><button class="btn sm" data-act="page-rename">Renommer la page</button>
      <button class="btn sm" data-act="page-move" data-d="-1" ${ui.page === 0 ? 'disabled' : ''} aria-label="Déplacer la page à gauche">←</button>
      <button class="btn sm" data-act="page-move" data-d="1" ${ui.page === s.pages.length - 1 ? 'disabled' : ''} aria-label="Déplacer la page à droite">→</button>
      <button class="btn sm danger" data-act="page-del" ${s.pages.length < 2 ? 'disabled' : ''}>Supprimer la page</button></div>
    <div class="editor"><div class="gridwrap"><div class="grid">${cells}</div>
      <div class="small muted" style="margin-top:10px">Cliquez sur une case pour la régler. Faites glisser une case pour la déplacer.</div>${s.category === 'discord' ? discordSpacePanels() : ''}</div>
      <div class="cellpanel">${cellPanel()}</div></div>`;
}

function seg(act, options, current, extra) {
  return `<div class="seg">${options.map(([v, l]) => `<button data-act="${act}" data-v="${v}" ${extra || ''} class="${String(current) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function swatches(act, list, current) {
  return `<div class="row" style="gap:10px">${list.map(([n, c]) => `<button class="sw${c === current ? ' on' : ''}" data-act="${act}" data-v="${c}" aria-label="${n}"><span style="background:${c}"></span>${n}</button>`).join('')}</div>`;
}

function cellPanel() {
  const c = curCell();
  if (ui.cell == null) return `<div class="panel"><h2 class="disp">Réglages de la case</h2><div class="muted">Cliquez sur une case de la grille pour la régler, ou sur une case vide (+) pour en créer une.</div></div>`;
  if (!c) return `<div class="panel"><h2 class="disp">Case ${ui.cell + 1} · vide</h2><div class="muted">Cette case n\u2019affiche rien sur l\u2019écran.</div><button class="btn pri" data-act="cell-create">Créer une case ici</button></div>`;
  const im = c.image;
  const a = c.action || { type: 'none' };
  let img = '';
  if (im.type === 'icon') {
    img = `<div class="row"><button class="btn" data-act="picto-open" style="height:52px">${svg(im.icon, 26, im.color)}<span>Changer de pictogramme</span></button></div>
      <div><span class="lab">Couleur du pictogramme</span>${swatches('icon-color', COLORS_ICON, im.color)}</div>`;
  } else if (im.type === 'photo') {
    img = `<div class="row">${im.photo ? `<span style="width:96px;height:80px;border-radius:10px;background:url('${im.photo}') center/cover;border:1px solid var(--line)"></span>` : ''}
      <button class="btn" data-act="photo-import">${im.photo ? 'Changer de photo' : 'Importer une photo…'}</button></div>
      <label class="chk"><input type="checkbox" data-act="photo-name" ${im.showName !== false ? 'checked' : ''}>Écrire le nom en bas de la photo</label>
      <div><span class="lab">Assombrir pour lire le nom</span>${seg('photo-dim', [[0, 'Aucun'], [0.2, 'Léger'], [0.4, 'Fort']], im.dim || 0)}</div>`;
  }
  let act = '';
  if (a.type === 'joy') act = `<div><label class="lab" for="f-joy">Numéro de bouton (1 à 32)</label><input id="f-joy" class="inp mono" type="number" min="1" max="32" value="${a.button || 1}" data-field="joy"></div>
      <div class="note">Dans le jeu, ouvrez les contrôles, cliquez sur l\u2019action voulue puis touchez cette case sur l\u2019écran.</div>`;
  if (a.type === 'key') act = `<div><label class="lab" for="f-key">Touches à envoyer</label><input id="f-key" class="inp mono" readonly value="${esc(a.keys || '')}" placeholder="Cliquez ici puis appuyez sur la combinaison" data-field="keycap"></div>`;
  if (a.type === 'media') act = `<div><label class="lab" for="f-media">Touche multimédia</label><select id="f-media" class="inp" data-field="media">${MEDIA_KEYS.map(([v, l]) => `<option value="${v}" ${a.media === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  if (a.type === 'page') {
    const s = curSpace();
    act = `<div><label class="lab" for="f-page">Aller à</label><select id="f-page" class="inp" data-field="page"><option value="home" ${a.page === 'home' ? 'selected' : ''}>Écran d\u2019accueil</option>${s.pages.map((p, i) => `<option value="${i}" ${String(a.page) === String(i) ? 'selected' : ''}>Page ${esc(p.name)}</option>`).join('')}</select></div>`;
  }
  if (a.type === 'app') {
    const p = APP_PRESETS[a.preset] || APP_PRESETS.autre;
    act = `<div><label class="lab" for="f-preset">Application</label><select id="f-preset" class="inp" data-field="preset">${Object.entries(APP_PRESETS).map(([k, v]) => `<option value="${k}" ${a.preset === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
      ${a.preset === 'autre' || !a.preset ? `<div><span class="lab">Programme</span><div class="row"><input class="inp grow mono" value="${esc(a.exe || '')}" data-field="exe" placeholder="C:\\…\\programme.exe"><button class="btn" data-act="choose-exe">Choisir…</button></div></div>
      <div class="row"><div class="grow"><label class="lab" for="f-args">Arguments (facultatif)</label><input id="f-args" class="inp mono" value="${esc(a.args || '')}" data-field="args"></div>
      <div class="grow"><label class="lab" for="f-proc">Nom du processus (facultatif)</label><input id="f-proc" class="inp mono" value="${esc(a.processName || '')}" data-field="proc" placeholder="ex. chrome"></div></div>` : `<div class="small muted mono">${esc(p.exe)} ${esc(p.args || '')}</div>`}
      <div><span class="lab">Ouvrir sur</span>${seg('app-screen', [['gauche', 'Écran de gauche'], ['droite', 'Écran de droite']], a.screen)}</div>
      <div><span class="lab">Position sur l\u2019écran</span>${seg('app-pos', [['plein', 'Plein écran'], ['gauche', 'Moitié gauche'], ['droite', 'Moitié droite']], a.position)}</div>
      <div><span class="lab">Si l\u2019appli est déjà ouverte</span>${seg('app-open', [['front', 'La ramener ici'], ['new', 'Nouvelle fenêtre']], a.ifOpen)}</div>
      <div class="small muted">Touche réservée envoyée par l\u2019écran : <span class="tag">${esc(a.hotkey || '…')}</span></div>`;
  }
  if (a.type === 'obs') {
    const scenes = OBS.state.scenes, inputs = OBS.state.inputs;
    const targetField = a.op === 'scene'
      ? (scenes.length ? `<select class="inp" data-field="target">${scenes.map(n => `<option ${a.target === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}${scenes.includes(a.target) || !a.target ? '' : `<option selected>${esc(a.target)}</option>`}</select>` : `<input class="inp" value="${esc(a.target || '')}" data-field="target" placeholder="Nom de la scène dans OBS">`)
      : (a.op === 'mute' || a.op === 'source') ? `<input class="inp" list="obs-inputs" value="${esc(a.target || '')}" data-field="target" placeholder="${a.op === 'mute' ? 'Nom de la source audio (ex. Micro)' : 'Nom de l\u2019élément (ex. Webcam)'}"><datalist id="obs-inputs">${inputs.map(n => `<option value="${esc(n)}">`).join('')}</datalist>` : '';
    act = `<div><label class="lab" for="f-op">Action OBS</label><select id="f-op" class="inp" data-field="op">${OBS_OPS.map(([v, l]) => `<option value="${v}" ${a.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${targetField ? `<div><span class="lab">${a.op === 'scene' ? 'Scène' : (a.op === 'mute' ? 'Source audio' : 'Élément')}${OBS.state.status === 'on' ? ' <span style="color:var(--cyan)">· lu dans OBS</span>' : ''}</span>${targetField}</div>` : ''}
      ${OBS.state.status !== 'on' ? '<div class="note">Connectez OBS (menu Connexions) pour choisir dans la liste de vos scènes et sources.</div>' : ''}
      <div class="small muted">Touche réservée envoyée par l\u2019écran : <span class="tag">${esc(a.hotkey || '…')}</span></div>`;
  }
  if (a.type === 'discord') act = discordCellFields(a);
  const b = c.behavior || { mode: 'tap', holdMs: 1500 };
  return `<div class="panel">
    <div class="row" style="justify-content:space-between"><h2 class="disp">Case ${ui.cell + 1} · ${esc(c.name || 'Sans nom')}</h2><span class="tag">sélectionnée</span></div>
    <div><label class="lab" for="f-name">Nom affiché</label><input id="f-name" class="inp" value="${esc(c.name)}" data-field="name" maxlength="28"></div>
    <div><span class="lab">Image de la case</span>${seg('img-type', [['icon', 'Pictogramme'], ['photo', 'Photo'], ['text', 'Texte seul']], im.type)}</div>
    ${img}
    <div><label class="lab" for="f-type">Ce que fait la case</label><select id="f-type" class="inp" data-field="type">
      ${[['joy', 'Bouton de manette (jeux)'], ['key', 'Touche ou raccourci clavier'], ['media', 'Touche multimédia'], ['app', 'Ouvrir une appli sur un écran'], ['obs', 'OBS (streaming)'], ['discord', 'Discord (micro, casque, audio)'], ['page', 'Changer de page'], ['none', 'Rien (case décorative)']].map(([v, l]) => `<option value="${v}" ${a.type === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
    ${act}
    <div><span class="lab">Comportement</span>${seg('beh', [['tap', 'Appui'], ['hold', 'Maintenir'], ['toggle', 'Bascule']], b.mode)}</div>
    ${b.mode === 'hold' ? `<div><div class="row" style="justify-content:space-between"><label class="lab" for="f-hold">Durée de maintien</label><span class="mono" style="color:var(--cyan)">${(b.holdMs / 1000).toFixed(1).replace('.', ',')} s</span></div><input id="f-hold" type="range" min="200" max="5000" step="100" value="${b.holdMs}" data-field="hold"></div>` : ''}
    <div class="row"><button class="btn" data-act="cell-test">Tester</button><button class="btn danger" data-act="cell-clear">Effacer la case</button></div>
  </div>`;
}

function viewAccueil() {
  const rows = cfg.homeOrder.map(spaceById).filter(Boolean).map((s, i, arr) => {
    const cat = catOf(s.category);
    return `<div class="lrow${s.onHome ? '' : ' off'}">${svg(s.icon, 26, cat.color, 1.7)}<span class="nm disp">${esc(s.name)}</span>
      <button class="btn sm" data-act="home-move" data-id="${s.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
      <button class="btn sm" data-act="home-move" data-id="${s.id}" data-d="1" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
      <button class="btn sm" data-act="home-toggle" data-id="${s.id}" style="min-width:96px;color:${s.onHome ? '#9ADCFF' : 'var(--dim)'}">${s.onHome ? 'Affiché' : 'Masqué'}</button></div>`;
  }).join('');
  const shown = cfg.spaces.filter(s => s.onHome).length;
  return `<div class="head"><div><h1 class="disp">Écran d\u2019accueil</h1><div class="muted" style="margin-top:4px">Choisissez les espaces affichés et leur ordre. La vignette Réglages reste toujours en dernier.</div></div></div>
    <div class="editor"><div style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:10px">${rows}
      ${shown > HOME_PER_PAGE ? `<div class="note">L\u2019accueil montre ${HOME_PER_PAGE} espaces par page. Avec ${shown} espaces, il a ${homePages()} pages : sur l\u2019écran, glissez le doigt vers la gauche ou la droite pour passer de l\u2019une à l\u2019autre.</div>` : ''}</div>
      <div style="flex:1 1 460px;min-width:0;display:flex;flex-direction:column;gap:10px"><span class="lab" style="margin:0">Aperçu${homePages() > 1 ? ` · page ${(ui.homePv || 0) + 1} sur ${homePages()}` : ''}</span>${deckHome(null, ui.homePv || 0)}
        ${homePages() > 1 ? `<div class="row"><button class="btn sm" data-act="home-pv" data-d="-1" ${(ui.homePv || 0) === 0 ? 'disabled' : ''}>← Page précédente</button><button class="btn sm" data-act="home-pv" data-d="1" ${(ui.homePv || 0) >= homePages() - 1 ? 'disabled' : ''}>Page suivante →</button></div>` : ''}</div></div>`;
}

function viewApparence() {
  const scope = ui.lookScope || 'all';
  const sp = scope === 'all' ? null : spaceById(scope);
  const look = sp ? (sp.look || cfg.look) : cfg.look;
  const preview = sp || cfg.spaces[0];
  const own = sp && sp.look;
  return `<div class="head"><div><h1 class="disp">Apparence</h1><div class="muted" style="margin-top:4px">Le fond de l\u2019écran et les couleurs des cases. L\u2019aperçu change tout de suite.</div></div>
    <div style="min-width:260px"><label class="lab" for="f-scope">S\u2019applique à</label><select id="f-scope" class="inp" data-field="lookscope"><option value="all">Tous les espaces</option>${cfg.spaces.map(s => `<option value="${s.id}" ${scope === s.id ? 'selected' : ''}>Seulement : ${esc(s.name)}</option>`).join('')}</select></div></div>
    ${sp && !own ? `<div class="note">${esc(sp.name)} utilise l\u2019apparence commune. <button class="btn sm" data-act="look-own">Lui donner sa propre apparence</button></div>` : ''}
    ${sp && own ? `<div class="note">${esc(sp.name)} a sa propre apparence. <button class="btn sm" data-act="look-common">Revenir à l\u2019apparence commune</button></div>` : ''}
    <div class="editor"><div style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:16px;${sp && !own ? 'opacity:.5;pointer-events:none' : ''}">
      <div class="card" style="gap:14px"><div class="row" style="justify-content:space-between"><h2 class="disp">Fond d\u2019écran</h2>${seg('bg-type', [['color', 'Couleur unie'], ['photo', 'Photo']], look.bgType)}</div>
        ${look.bgType === 'color' ? swatches('bg-color', COLORS_BG, look.bgColor) : `<div class="row">${look.bgPhoto ? `<span style="width:150px;height:88px;border-radius:8px;background:url('${look.bgPhoto}') center/cover;border:1px solid var(--line)"></span>` : ''}<button class="btn" data-act="bg-photo">${look.bgPhoto ? 'Changer de photo' : 'Importer une photo…'}</button></div>
        <div><span class="lab">Assombrir la photo</span>${seg('bg-dim', [[0, 'Aucun'], [0.3, 'Léger'], [0.55, 'Fort']], look.bgDim || 0)}</div>`}</div>
      <div class="card" style="gap:12px"><h2 class="disp">Case au repos · contour</h2>${swatches('edge-color', COLORS_EDGE, look.idleEdge)}</div>
      <div class="card" style="gap:12px"><h2 class="disp">Case appuyée ou allumée</h2><div class="small muted">Le contour, le pictogramme et le nom prennent cette couleur.</div>${swatches('acc-color', COLORS_ACCENT, look.accent)}</div>
    </div>
    <div style="flex:1 1 480px;min-width:0;display:flex;flex-direction:column;gap:12px"><span class="lab" style="margin:0">Aperçu (touchez les cases)</span>
      <div data-lookpreview>${previewDeck(preview)}</div>
      <span class="lab" style="margin:8px 0 0">Thèmes prêts</span>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${THEMES.map((t, i) => `<button class="btn" style="height:auto;padding:10px;flex-direction:column;align-items:flex-start" data-act="theme" data-i="${i}" ${sp && !own ? 'disabled' : ''}><span class="row" style="gap:4px"><span style="width:20px;height:20px;border-radius:5px;background:${t.bgColor}"></span><span style="width:20px;height:20px;border-radius:5px;background:${t.accent}"></span></span>${t.name}</button>`).join('')}</div>
      <button class="btn" data-act="look-reset" ${sp && !own ? 'disabled' : ''}>Revenir au thème d\u2019origine</button></div></div>`;
}
const previewOn = {};
function previewDeck(space) {
  if (!space) return deckHome(null);
  const look = lookFor(space);
  const page = space.pages[0];
  const cells = page.cells.map((c, i) => deckCell(c, look, { on: previewOn[i], attrs: c ? `data-act="preview-cell" data-i="${i}" role="button" tabindex="0"` : '' })).join('');
  return deckFrame(look, `<div class="dtop"><div class="dtabs"><div class="dtab home">${svg('maison', 16, '#C9D6E2')}</div>${space.pages.map((p, i) => `<div class="dtab disp" style="${i === 0 ? `border-color:${look.accent};color:${look.accent}` : ''}">${esc(p.name)}</div>`).join('')}</div></div><div class="dgrid">${cells}</div>`);
}

function viewConnexions() {
  const o = cfg.obs;
  const st = OBS.state;
  const col = st.status === 'on' ? 'var(--cyan)' : (st.status === 'error' ? 'var(--red)' : 'var(--dim)');
  return `<div class="head"><div><h1 class="disp">Connexions</h1><div class="muted" style="margin-top:4px">OBS pour le streaming, Discord pour l\u2019espace Discord.</div></div></div>
    <div class="editor"><div class="panel" style="flex:1 1 420px;min-width:0">
      <div class="row" style="justify-content:space-between"><h2 class="disp">OBS Studio</h2><span style="color:${col}">${esc(st.status === 'on' ? 'Connecté' : (st.message || 'Non connecté'))}</span></div>
      <div class="note">Dans OBS : <b>Outils › Paramètres du serveur WebSocket</b>, cochez <b>Activer le serveur WebSocket</b>, puis cliquez sur <b>Afficher les informations de connexion</b> et copiez le mot de passe ici.</div>
      <div class="row"><div class="grow"><label class="lab" for="f-host">Adresse</label><input id="f-host" class="inp mono" value="${esc(o.host)}" data-field="obs-host"></div>
      <div style="width:120px"><label class="lab" for="f-port">Port</label><input id="f-port" class="inp mono" type="number" value="${esc(o.port)}" data-field="obs-port"></div></div>
      <div><label class="lab" for="f-pass">Mot de passe</label><input id="f-pass" class="inp mono" type="password" value="${esc(o.password)}" data-field="obs-pass"></div>
      <div class="small muted">Le mot de passe est enregistré chiffré par Windows sur ce PC. Il ne part jamais en clair : OBS et le logiciel échangent seulement une empreinte à usage unique.</div>
      <label class="chk"><input type="checkbox" data-act="obs-auto" ${o.autoConnect ? 'checked' : ''}>Se connecter automatiquement au démarrage</label>
      <div class="row">${st.status === 'on' ? '<button class="btn" data-act="obs-off">Se déconnecter</button>' : '<button class="btn pri" data-act="obs-on">Connecter</button>'}</div>
      ${st.status === 'on' ? `<div class="small muted">${st.scenes.length} scène${st.scenes.length > 1 ? 's' : ''} trouvée${st.scenes.length > 1 ? 's' : ''} : ${esc(st.scenes.join(', '))}</div>` : ''}
    </div>
    ${discordConnPanel()}
    <div class="panel" style="flex:1 1 360px;min-width:0"><div class="row" style="justify-content:space-between"><h2 class="disp">Twitch</h2><span class="muted">Bientôt</span></div>
      <div class="muted" style="line-height:1.55">Les cases Marqueur, Clip, Pub et Titre du live arriveront dans une prochaine version. En attendant, l\u2019espace Streaming pilote déjà OBS : scènes, sons, éléments, live, enregistrement et replay.</div></div></div>`;
}

function discordCellFields(a) {
  let arg = '';
  if (a.op === 'entree' || a.op === 'sortie') {
    const list = a.op === 'entree' ? dstate.inputs : dstate.outputs;
    if (list.length) {
      arg = `<select class="inp" data-field="darg"><option value="">Choisir…</option>${list.map(x => `<option value="${esc(x.id)}" ${a.arg === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}${a.arg && !list.some(x => x.id === a.arg) ? `<option value="${esc(a.arg)}" selected>${esc(a.argName || a.arg)} (absent)</option>` : ''}</select>`;
    } else {
      arg = `<div class="small mono">${a.arg ? esc(a.argName || a.arg) : 'Aucun appareil choisi'}</div><div class="note">Connectez Discord (menu Connexions) pour choisir dans la liste de vos appareils audio.</div>`;
    }
    arg = `<div><span class="lab">${a.op === 'entree' ? 'Entrée audio (micro)' : 'Sortie audio (casque, haut-parleurs)'}</span>${arg}</div>`;
  }
  if (a.op === 'raccourci') {
    const list = cfg.discord.shortcuts;
    arg = list.length
      ? `<div><span class="lab">Raccourci</span><select class="inp" data-field="darg">${list.map(x => `<option value="${x.id}" ${a.arg === x.id ? 'selected' : ''}>${esc(x.name)}${x.keys ? ' · ' + esc(x.keys) : ''}</option>`).join('')}</select></div>`
      : '<div class="note">Vous n’avez pas encore de raccourci Discord. <button class="btn sm" data-act="nav" data-view="espaces">Ouvrir l\u2019espace Discord</button></div>';
  }
  const pc = a.op !== 'raccourci';
  return `<div><label class="lab" for="f-dop">Action Discord</label><select id="f-dop" class="inp" data-field="dop">${DISCORD_OPS.map(([v, l]) => `<option value="${v}" ${a.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${arg}
    ${a.op === 'casque' ? '<div class="small muted">Discord ne sait pas couper le son sans couper aussi le micro : le logiciel met le volume de sortie de Discord à zéro, puis le remet comme avant.</div>' : ''}
    ${pc && dstate.status !== 'on' ? '<div class="note">Connectez Discord (menu Connexions) pour que cette case fonctionne.</div>' : ''}
    ${pc ? `<div class="small muted">Touche réservée envoyée par l’écran : <span class="tag">${esc(a.hotkey || '…')}</span></div>` : '<div class="small muted">L’écran envoie directement la combinaison de touches du raccourci.</div>'}`;
}

function discordStatus() {
  const st = dstate, on = st.status === 'on';
  const col = on ? 'var(--cyan)' : (st.status === 'error' ? 'var(--red)' : (st.status === 'auth' ? 'var(--amber)' : 'var(--dim)'));
  return { on, col, label: on ? 'Connecté' : (st.message || 'Non connecté') };
}
// Panneaux affichés sous la grille d'un espace Discord : commandes en direct et raccourcis
function discordSpacePanels() {
  const d = cfg.discord, st = dstate, { on, col, label } = discordStatus();
  const headOff = st.outVolume === 0;
  const big = (op, icon, title, isOff, offTxt, onTxt) => `<button class="dbig${isOff ? ' off' : ''}" data-act="discord-run" data-op="${op}" ${on ? '' : 'disabled'}>${svg(icon, 30, isOff ? '#FF8A7A' : '#9ADCFF', 1.7)}<span class="disp">${title}</span><span class="small">${isOff ? offTxt : onTxt}</span></button>`;
  const devSel = (field, list, cur) => `<select class="inp" data-field="${field}" ${on && list.length ? '' : 'disabled'}>${list.length ? list.map(x => `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('') : '<option>Connectez Discord pour voir la liste</option>'}</select>`;
  const scRows = d.shortcuts.map(sc => `<div class="lrow"><input class="inp grow" value="${esc(sc.name)}" data-field="sc-name" data-id="${sc.id}" maxlength="28" aria-label="Nom du raccourci">
      <input class="inp mono" style="width:210px" readonly value="${esc(sc.keys || '')}" placeholder="Cliquez puis tapez les touches" data-field="keycap" data-sc="${sc.id}" aria-label="Touches du raccourci">
      <button class="btn sm danger" data-act="sc-del" data-id="${sc.id}" aria-label="Supprimer le raccourci">✕</button></div>`).join('');
  return `<div class="panel" style="margin-top:16px"><div class="row" style="justify-content:space-between"><h2 class="disp">Discord en direct</h2><span style="color:${col}">${esc(label)}</span></div>
      <div class="dbigs">
        ${big('micro', st.mute || st.deaf ? 'micromuet' : 'micro', 'Micro', st.mute || st.deaf, 'Coupé', 'Ouvert')}
        ${big('casque', headOff || st.deaf ? 'casquemuet' : 'casque', 'Casque', headOff || st.deaf, 'Coupé', 'Actif')}
        ${big('tout', st.deaf ? 'muet' : 'son', 'Micro + casque', st.deaf, 'Tout est coupé', 'Tout couper')}
      </div>
      <div class="row"><div class="grow" style="min-width:200px"><span class="lab">Entrée audio (micro)</span>${devSel('d-in', st.inputs, st.inputId)}</div>
        <div class="grow" style="min-width:200px"><span class="lab">Sortie audio (casque, haut-parleurs)</span>${devSel('d-out', st.outputs, st.outputId)}</div></div>
      ${on ? `<div class="row"><button class="btn sm" data-act="discord-devpage">Créer une page AUDIO avec mes appareils</button><span class="small muted">Une case par micro et par sortie, pour choisir directement sur l’écran.</span></div>`
        : '<div class="note">Discord n’est pas connecté. <button class="btn sm" data-act="nav" data-view="connexions">Le connecter (menu Connexions)</button></div>'}</div>
    <div class="panel" style="margin-top:16px"><div class="row" style="justify-content:space-between"><h2 class="disp">Mes raccourcis Discord</h2><button class="btn sm" data-act="sc-add">+ Ajouter un raccourci</button></div>
      <div class="small muted" style="line-height:1.55">Pour tout le reste (appuyer pour parler, partager l’écran, caméra…) : dans Discord, ouvrez <b>Paramètres › Raccourcis clavier</b>, ajoutez un raccourci et choisissez une combinaison, puis tapez la même ici. Chaque nouveau raccourci prend une case libre de la page affichée.</div>
      ${scRows || '<div class="muted small">Aucun raccourci pour l’instant.</div>'}
      <div class="small muted">Conseil : prenez des combinaisons que rien d’autre n’utilise, par exemple Ctrl+Alt+Shift+M.</div></div>`;
}
function discordConnPanel() {
  const d = cfg.discord, st = dstate, { on, col, label } = discordStatus();
  return `<div class="panel" style="flex:1 1 420px;min-width:0"><div class="row" style="justify-content:space-between"><h2 class="disp">Discord</h2><span style="color:${col}">${esc(label)}</span></div>
      <div class="note" style="line-height:1.6">À faire une seule fois :<br>
        1. Ouvrez le <button class="linkbtn" data-act="discord-dev">portail des développeurs Discord</button> et connectez-vous.<br>
        2. Cliquez sur <b>New Application</b>, nommez-la « The Deck », acceptez puis <b>Create</b>.<br>
        3. Dans <b>OAuth2</b>, copiez le <b>Client ID</b>, puis cliquez sur <b>Reset Secret</b> et copiez le <b>Client Secret</b>.<br>
        4. Toujours dans OAuth2, sous <b>Redirects</b>, ajoutez <span class="mono">http://localhost</span> puis <b>Save Changes</b>.<br>
        5. Collez les deux codes ici et cliquez sur <b>Connecter</b>. Discord affiche une demande : cliquez sur <b>Autoriser</b>.</div>
      <div><label class="lab" for="f-dcid">Client ID</label><input id="f-dcid" class="inp mono" value="${esc(d.clientId)}" data-field="dc-id" placeholder="ex. 1234567890123456789"></div>
      <div><label class="lab" for="f-dcsec">Client Secret</label><input id="f-dcsec" class="inp mono" type="password" value="${esc(d.clientSecret)}" data-field="dc-secret"></div>
      <label class="chk"><input type="checkbox" data-act="discord-auto" ${d.autoConnect ? 'checked' : ''}>Se connecter automatiquement (et se reconnecter si Discord redémarre)</label>
      <div class="row">${on || st.status === 'connecting' || st.status === 'auth' ? '<button class="btn" data-act="discord-off">Se déconnecter</button>' : '<button class="btn pri" data-act="discord-on">Connecter</button>'}</div>
      <div class="small muted">Le Client Secret est enregistré chiffré par Windows sur ce PC, et n\u2019est jamais copié dans un espace exporté ni envoyé à l\u2019écran. « Se déconnecter » efface aussi l\u2019autorisation donnée par Discord.</div></div>`;
}

function viewAppareil() {
  const d = cfg.device;
  return `<div class="head"><div><h1 class="disp">Appareil</h1><div class="muted" style="margin-top:4px">L\u2019écran tactile The Deck, branché en USB.</div></div><button class="btn pri" data-act="send">Envoyer sur l\u2019écran</button></div>
    <div class="editor"><div class="panel" style="flex:1 1 420px;min-width:0">
      <div><div class="row" style="justify-content:space-between"><label class="lab" for="f-bri">Luminosité de l\u2019écran</label><span class="mono" style="color:var(--amber)">${d.brightness} %</span></div><input id="f-bri" type="range" min="10" max="100" step="5" value="${d.brightness}" data-field="bri"></div>
      <div><span class="lab">Mise en veille après</span>${seg('sleep', [[0, 'Jamais'], [5, '5 min'], [10, '10 min'], [30, '30 min']], d.sleepMin)}</div>
      <label class="chk"><input type="checkbox" data-act="dev-swipe" ${d.swipe !== false ? 'checked' : ''}>Changer de page en glissant le doigt vers la gauche ou la droite</label>
      <label class="chk" style="${d.swipe === false ? 'opacity:.5' : ''}"><input type="checkbox" data-act="dev-loop" ${d.loop ? 'checked' : ''} ${d.swipe === false ? 'disabled' : ''}>Après la dernière page, revenir à la première</label>
      <div class="small muted">Ces réglages partent sur l\u2019écran au prochain envoi.</div></div>
    <div class="panel" style="flex:1 1 360px;min-width:0"><h2 class="disp">État</h2>
      <div style="line-height:1.6">${ui.deckOk ? '<span style="color:var(--cyan)">Le dernier envoi a réussi.</span>' : 'Aucun envoi réussi pendant cette session.'}</div>
      <div class="warn">Le programme de l\u2019écran (micrologiciel de la carte ESP32-P4) n\u2019est pas encore installé. Tant qu\u2019il ne l\u2019est pas, l\u2019envoi s\u2019arrête avec « l\u2019écran n\u2019a pas répondu ». Vous pouvez déjà tout préparer et tester avec <b>Aperçu de l\u2019écran</b>.</div></div></div>`;
}

function viewParametres() {
  const bk = ui.backups || [];
  return `<div class="head"><div><h1 class="disp">Paramètres</h1></div></div>
    <div class="editor"><div class="panel" style="flex:1 1 420px;min-width:0">
      <label class="chk"><input type="checkbox" data-act="startwin" ${cfg.settings.startWithWindows ? 'checked' : ''}>Lancer The Deck avec Windows (discrètement, près de l\u2019horloge)</label>
      <div class="small muted">Le logiciel doit rester lancé pour ouvrir les applis sur le bon écran et piloter OBS. Fermer sa fenêtre ne l\u2019arrête pas : pour le quitter, clic droit sur son icône près de l\u2019horloge, puis Quitter.</div>
      <div class="small muted">Version ${esc(ui.version || '')}</div></div>
    <div class="panel" style="flex:1 1 420px;min-width:0"><div class="row" style="justify-content:space-between"><h2 class="disp">Sauvegardes</h2><button class="btn sm" data-act="backups-folder">Ouvrir le dossier</button></div>
      <div class="small muted">Une sauvegarde est créée à chaque envoi réussi sur l\u2019écran, et quand vous cliquez sur « Sauvegarder maintenant ».</div>
      <div class="row"><button class="btn" data-act="backup-now">Sauvegarder maintenant</button></div>
      ${bk.length ? bk.slice(0, 12).map(n => `<div class="row" style="justify-content:space-between"><span class="mono small">${esc(n.replace('sauvegarde_', '').replace('.json', ''))}</span><button class="btn sm" data-act="backup-restore" data-name="${esc(n)}">Restaurer</button></div>`).join('') : '<div class="muted small">Aucune sauvegarde pour l\u2019instant.</div>'}
      <button class="btn danger" data-act="reset-all">Tout réinitialiser…</button></div></div>`;
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------
function modalHTML() {
  const m = ui.modal;
  if (!m) return '';
  if (m.type === 'new-space') {
    const list = tplsOf(m.cat);
    const t = list[m.tpl] || list[0];
    return `<div class="modal md" role="dialog" aria-label="Nouvel espace"><div class="modal-head"><h2 class="disp" style="font-size:25px">Nouvel espace</h2><button class="iconbtn" data-act="modal-close" aria-label="Fermer">✕</button></div>
      <div><span class="lab">1 · Catégorie</span><div class="row" style="gap:8px">${catKeys().map(k => `<button class="pill${m.cat === k ? ' on' : ''}" data-act="ns-cat" data-v="${k}">${esc(catOf(k).label)}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px"><span class="lab" style="margin:0">2 · Partir d\u2019un modèle</span>
        ${list.map((x, i) => `<button class="btn" style="height:auto;padding:10px 14px;flex-direction:column;align-items:flex-start;gap:2px;${i === m.tpl ? 'border-color:var(--amber);background:#1A222B' : ''}" data-act="ns-tpl" data-i="${i}"><b>${esc(x.name)}</b><span class="small muted">${esc(x.desc)}</span></button>`).join('')}</div>
      <div><label class="lab" for="f-nsname">3 · Nom affiché sur l\u2019accueil</label><input id="f-nsname" class="inp" value="${esc(m.name)}" placeholder="${esc(t.name)}" data-field="ns-name" maxlength="24"></div>
      ${m.cat !== 'bureau' ? `<div><label class="lab" for="f-nsexe">Ouvrir cet espace quand ce programme démarre (facultatif)</label><input id="f-nsexe" class="inp mono" value="${esc(m.exe)}" placeholder="${esc(t.exe || 'ex. MonJeu.exe')}" data-field="ns-exe"></div>` : ''}
      ${m.cat === 'stream' && OBS.state.status === 'on' ? '<div class="note">OBS est connecté : les cases de scènes prendront les vrais noms de vos scènes.</div>' : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Annuler</button><button class="btn pri" data-act="ns-create">Créer l\u2019espace</button></div></div>`;
  }
  if (m.type === 'cat') {
    const keys = Object.keys(PICTOS);
    return `<div class="modal md" role="dialog" aria-label="Catégorie"><div class="modal-head"><h2 class="disp" style="font-size:25px">${m.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2><button class="iconbtn" data-act="modal-close" aria-label="Fermer">✕</button></div>
      <div><label class="lab" for="f-catname">Nom</label><input id="f-catname" class="inp" value="${esc(m.label)}" placeholder="ex. Simulation, Musique, Travail…" data-field="cat-name" maxlength="22"></div>
      <div><span class="lab">Couleur</span>${swatches('cat-color', COLORS_ICON, m.color)}</div>
      <div><span class="lab">Pictogramme</span><div class="picgrid" style="max-height:230px;overflow:auto">${keys.map(k => `<button class="pic${k === m.icon ? ' on' : ''}" data-act="cat-icon" data-v="${k}">${svg(k, 24, k === m.icon ? m.color : '#C9D6E2')}<span>${esc(PICTOS[k][0])}</span></button>`).join('')}</div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Annuler</button><button class="btn pri" data-act="cat-ok">${m.id ? 'Enregistrer' : 'Créer la catégorie'}</button></div></div>`;
  }
  if (m.type === 'movecat') {
    const sp = spaceById(m.id);
    return `<div class="modal sm" role="dialog" aria-label="Changer de catégorie"><h2 class="disp">« ${esc(sp.name)} » va dans…</h2>
      <div style="display:flex;flex-direction:column;gap:8px">${catKeys().map(k => `<button class="btn" style="justify-content:flex-start;${k === sp.category ? 'border-color:var(--amber)' : ''}" data-act="movecat-ok" data-v="${k}">${svg(catOf(k).icon, 20, catOf(k).color)}${esc(catOf(k).label)}</button>`).join('')}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Annuler</button></div></div>`;
  }
  if (m.type === 'picto') {
    const q = (ui.search || '').toLowerCase().trim();
    const keys = Object.keys(PICTOS).filter(k => (ui.catFilter === 'Tous' || PICTOS[k][1] === ui.catFilter) && (!q || (PICTOS[k][0] + ' ' + PICTOS[k][2]).toLowerCase().includes(q)));
    const c = curCell();
    const sel = m.pick || c.image.icon;
    return `<div class="modal" role="dialog" aria-label="Choisir un pictogramme"><div class="modal-head"><h2 class="disp" style="font-size:25px">Choisir un pictogramme</h2><button class="iconbtn" data-act="modal-close" aria-label="Fermer">✕</button></div>
      <input class="inp" placeholder="Rechercher : train, micro, bouclier…" value="${esc(ui.search)}" data-field="picto-search" id="f-psearch">
      <div class="row" style="gap:8px">${PICTO_CATS.map(cn => `<button class="pill${ui.catFilter === cn ? ' on' : ''}" data-act="picto-cat" data-v="${cn}">${cn}</button>`).join('')}</div>
      <div class="editor"><div class="picgrid" style="flex:999 1 520px">${keys.map(k => `<button class="pic${k === sel ? ' on' : ''}" data-act="picto-pick" data-v="${k}">${svg(k, 28, k === sel ? '#5CC8FF' : '#C9D6E2')}<span>${esc(PICTOS[k][0])}</span></button>`).join('') || '<div class="muted">Aucun pictogramme ne correspond.</div>'}</div>
      <div style="flex:1 1 220px;display:flex;flex-direction:column;gap:14px"><span class="lab" style="margin:0">Aperçu sur l\u2019écran</span>
        <div style="--u:10px;width:190px;height:160px;display:grid;padding:0;border-radius:14px;background:${lookFor(curSpace()).bgColor}">${deckCell(Object.assign({}, c, { image: Object.assign({}, c.image, { type: 'icon', icon: sel }) }), lookFor(curSpace()), {})}</div>
        <div class="row" style="margin-top:auto"><button class="btn grow" data-act="modal-close">Annuler</button><button class="btn pri grow" data-act="picto-ok">Choisir</button></div></div></div></div>`;
  }
  if (m.type === 'crop') {
    return `<div class="modal" role="dialog" aria-label="Recadrer la photo"><div class="modal-head"><h2 class="disp" style="font-size:25px">${esc(m.title)}</h2><span class="muted small">${esc(m.fileName || '')}</span></div>
      <div class="editor"><div style="flex:999 1 520px;display:flex;flex-direction:column;gap:12px"><div class="cropview" id="cropview"><canvas id="cropcanvas" width="760" height="460"></canvas></div>
        <div class="row"><label class="lab" for="f-zoom" style="margin:0">Zoom</label><input id="f-zoom" type="range" min="1" max="5" step="0.01" value="${m.zoom}" data-field="crop-zoom" style="flex:1"><button class="btn sm" data-act="crop-rotate">Pivoter</button></div>
        <div class="small muted">Faites glisser la photo pour la placer. Le cadre a déjà la bonne forme.</div></div>
      <div style="flex:1 1 220px;display:flex;flex-direction:column;gap:14px"><span class="lab" style="margin:0">Aperçu</span><canvas id="croppreview" width="${m.outW}" height="${m.outH}" style="width:${m.kind === 'bg' ? 240 : 190}px;height:auto;border-radius:10px;border:1px solid var(--line)"></canvas>
        <div class="row" style="margin-top:auto"><button class="btn grow" data-act="modal-close">Annuler</button><button class="btn pri grow" data-act="crop-ok">Valider</button></div></div></div></div>`;
  }
  if (m.type === 'confirm') {
    return `<div class="modal sm" role="dialog" aria-label="${esc(m.title)}"><h2 class="disp">${esc(m.title)}</h2><div class="muted" style="line-height:1.5">${esc(m.text)}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Annuler</button><button class="btn ${m.danger ? 'danger' : 'pri'}" data-act="confirm-ok">${esc(m.ok)}</button></div></div>`;
  }
  if (m.type === 'text') {
    return `<div class="modal sm" role="dialog" aria-label="${esc(m.title)}"><h2 class="disp">${esc(m.title)}</h2><input class="inp" id="f-modaltext" value="${esc(m.value)}" data-field="modal-text" maxlength="24">
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Annuler</button><button class="btn pri" data-act="text-ok">Valider</button></div></div>`;
  }
  if (m.type === 'sim') {
    const s = m.screen === 'home' ? null : spaceById(m.spaceId);
    return `<div class="modal" role="dialog" aria-label="Aperçu de l\u2019écran" style="width:min(1120px,100%)"><div class="modal-head"><h2 class="disp" style="font-size:25px">Aperçu de l\u2019écran</h2>
      <div class="row"><span class="muted small">Touchez les cases comme sur le vrai écran${cfg.device.swipe !== false ? ', glissez vers la gauche ou la droite pour changer de page' : ''}. Rien n\u2019est envoyé au jeu.</span><button class="iconbtn" data-act="modal-close" aria-label="Fermer">✕</button></div></div>
      <div id="sim">${s ? deckPage(s, m.page, m) : deckHome(m)}</div></div>`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Rendu global
// ---------------------------------------------------------------------------
function render() {
  const views = { espaces: viewEspaces, editeur: viewEditeur, accueil: viewAccueil, apparence: viewApparence, connexions: viewConnexions, appareil: viewAppareil, parametres: viewParametres };
  const focusId = document.activeElement && document.activeElement.id;
  const selStart = document.activeElement && document.activeElement.selectionStart;
  const mainScroll = $('.main') ? $('.main').scrollTop : 0;
  $('#app').innerHTML = `<div class="layout">${sidebar()}<main class="main">${(views[ui.view] || viewEspaces)()}</main></div>`;
  $('.main').scrollTop = mainScroll;
  renderModal();
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); try { if (selStart != null && el.setSelectionRange) el.setSelectionRange(selStart, selStart); } catch (e) { /* ignoré */ } }
  }
}
function renderModal() {
  const html = modalHTML();
  $('#modal-root').innerHTML = html ? `<div class="overlay" data-act="overlay">${html}</div>` : '';
  if (ui.modal && ui.modal.type === 'crop') cropDraw();
}

// ---------------------------------------------------------------------------
// Recadrage des photos
// ---------------------------------------------------------------------------
function openCrop(file, kind, title) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const outW = kind === 'bg' ? 1024 : 380, outH = kind === 'bg' ? 600 : 320;
      ui.modal = { type: 'crop', kind, title, fileName: file.name, img, outW, outH, zoom: 1, rot: 0, ox: 0, oy: 0 };
      render();
    };
    img.onerror = () => toast('Cette image n\u2019a pas pu être lue.', 'err');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function cropGeom(m, cw, ch) {
  const ar = m.outW / m.outH;
  let fw = cw * 0.72, fh = fw / ar;
  if (fh > ch * 0.8) { fh = ch * 0.8; fw = fh * ar; }
  const fx = (cw - fw) / 2, fy = (ch - fh) / 2;
  const rot = m.rot % 180 !== 0;
  const iw = rot ? m.img.height : m.img.width, ih = rot ? m.img.width : m.img.height;
  const base = Math.max(fw / iw, fh / ih);
  const s = base * m.zoom;
  // limite le déplacement pour que la photo couvre toujours le cadre
  const maxX = Math.max(0, (iw * s - fw) / 2), maxY = Math.max(0, (ih * s - fh) / 2);
  m.ox = Math.max(-maxX, Math.min(maxX, m.ox)); m.oy = Math.max(-maxY, Math.min(maxY, m.oy));
  return { fx, fy, fw, fh, s, cx: cw / 2 + m.ox, cy: ch / 2 + m.oy };
}
function drawImg(ctx, m, g) {
  ctx.save(); ctx.translate(g.cx, g.cy); ctx.rotate(m.rot * Math.PI / 180); ctx.scale(g.s, g.s);
  ctx.drawImage(m.img, -m.img.width / 2, -m.img.height / 2); ctx.restore();
}
function cropDraw() {
  const m = ui.modal, cv = $('#cropcanvas');
  if (!cv || !m) return;
  const ctx = cv.getContext('2d');
  const g = cropGeom(m, cv.width, cv.height);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  drawImg(ctx, m, g);
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(0, 0, cv.width, g.fy); ctx.fillRect(0, g.fy + g.fh, cv.width, cv.height - g.fy - g.fh);
  ctx.fillRect(0, g.fy, g.fx, g.fh); ctx.fillRect(g.fx + g.fw, g.fy, cv.width - g.fx - g.fw, g.fh);
  ctx.strokeStyle = '#FFB547'; ctx.lineWidth = 2; ctx.strokeRect(g.fx, g.fy, g.fw, g.fh);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(g.fx + g.fw * i / 3, g.fy); ctx.lineTo(g.fx + g.fw * i / 3, g.fy + g.fh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.fx, g.fy + g.fh * i / 3); ctx.lineTo(g.fx + g.fw, g.fy + g.fh * i / 3); ctx.stroke();
  }
  const pv = $('#croppreview');
  if (pv) {
    const p = pv.getContext('2d');
    const k = m.outW / g.fw;
    p.save(); p.fillStyle = '#000'; p.fillRect(0, 0, pv.width, pv.height);
    p.scale(k, k); p.translate(-g.fx, -g.fy); drawImg(p, m, g); p.restore();
  }
}
function cropResult() {
  const pv = $('#croppreview');
  return pv ? pv.toDataURL('image/jpeg', 0.86) : null;
}

// ---------------------------------------------------------------------------
// Envoi vers l'écran (USB)
// ---------------------------------------------------------------------------
// Ce que l'écran doit faire : un raccourci Discord devient une simple touche clavier
function deviceAction(a) {
  if (a && a.type === 'discord' && a.op === 'raccourci') {
    const sc = shortcutById(a.arg);
    return { type: 'key', keys: sc ? sc.keys || '' : '' };
  }
  return a;
}
function deviceConfig() {
  const order = cfg.homeOrder.map(spaceById).filter(s => s && s.onHome);
  const strip = (look) => look ? { bgType: look.bgType, bgColor: look.bgColor, bgPhoto: look.bgType === 'photo' ? look.bgPhoto : null, bgDim: look.bgDim, idleEdge: look.idleEdge, accent: look.accent } : null;
  return {
    format: 'cockpit-deck-ecran', version: 1,
    device: cfg.device,
    look: strip(cfg.look),
    home: order.map(s => s.id),
    spaces: cfg.spaces.map(s => ({
      layout: s.layout || 'grid', player: isPlayer(s) ? Object.assign({ controls: { prev: 'precedente', next: 'suivante', play: 'lecture', vmoins: 'volmoins', vplus: 'volplus', swipeLeft: 'suivante', swipeRight: 'precedente' } }, s.player) : undefined,
      id: s.id, name: s.name, category: s.category, color: catOf(s.category).color, icon: s.icon, autoExe: s.autoExe, look: strip(s.look),
      pages: s.pages.map(p => ({ name: p.name, cells: p.cells.map(c => c ? {
        name: c.name, image: c.image.type === 'photo' ? { type: 'photo', photo: c.image.photo, showName: c.image.showName !== false, dim: c.image.dim || 0 } : { type: c.image.type, icon: c.image.icon, color: c.image.color },
        action: deviceAction(c.action), behavior: c.behavior
      } : null) }))
    }))
  };
}
// Liaison USB permanente avec l'écran : la configuration à l'envoi, puis le morceau en cours (jaquette comprise) en direct
const deckLink = { port: null, writer: null, lines: [], waiters: [], opening: null };
const isDeckPort = (p) => { try { return p.getInfo().usbVendorId === 0x303A; } catch (e) { return false; } };
async function deckOpen(port) {
  if (deckLink.port === port && deckLink.writer) return true;
  if (deckLink.opening) return deckLink.opening;
  deckLink.opening = (async () => {
    try {
      await deckClose();
      await port.open({ baudRate: 921600, bufferSize: 65536 });
      deckLink.port = port;
      deckLink.writer = port.writable.getWriter();
      deckReadLoop(port);
      deckLink.lastCover = null;
      ui.deckLinked = true; render();
      deckSendMedia(true);
      return true;
    } catch (e) { deckLink.port = null; deckLink.writer = null; return false; }
    finally { deckLink.opening = null; }
  })();
  return deckLink.opening;
}
async function deckClose() {
  const p = deckLink.port;
  deckLink.port = null;
  if (deckLink.reader) { try { await deckLink.reader.cancel(); } catch (e) { /* ignoré */ } }
  if (deckLink.writer) { try { deckLink.writer.releaseLock(); } catch (e) { /* ignoré */ } }
  deckLink.writer = null; deckLink.reader = null;
  if (p) { try { await p.close(); } catch (e) { /* ignoré */ } }
}
async function deckReadLoop(port) {
  let buf = '';
  const dec = new TextDecoder();
  try {
    const reader = port.readable.getReader();
    deckLink.reader = reader;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
        if (!line) continue;
        deckLink.waiters.slice().forEach(w => w(line));
      }
    }
  } catch (e) { /* écran débranché */ }
  if (deckLink.port === port) { deckLink.writer = null; deckLink.port = null; ui.deckLinked = false; render(); }
}
async function deckWrite(obj) {
  if (!deckLink.writer) return false;
  try { await deckLink.writer.write(new TextEncoder().encode(JSON.stringify(obj) + '\n')); return true; }
  catch (e) { await deckClose(); return false; }
}
function deckWaitReply(ms) {
  return new Promise((resolve) => {
    const w = (line) => { if (/\bOK\b/.test(line) || /\bERR\b/.test(line)) { done(/\bOK\b/.test(line)); } };
    const done = (v) => { clearTimeout(t); deckLink.waiters = deckLink.waiters.filter(x => x !== w); resolve(v); };
    const t = setTimeout(() => done(false), ms);
    deckLink.waiters.push(w);
  });
}
// au démarrage et au branchement : se relie tout seul à l'écran déjà autorisé
async function deckAutoLink() {
  if (!('serial' in navigator)) return;
  try { const ports = (await navigator.serial.getPorts()).filter(isDeckPort); if (ports[0]) await deckOpen(ports[0]); } catch (e) { /* ignoré */ }
}
if ('serial' in navigator) {
  navigator.serial.addEventListener('connect', () => setTimeout(deckAutoLink, 800));
  navigator.serial.addEventListener('disconnect', (ev) => { if (ev.target === deckLink.port) deckClose(); });
}

// Jaquette réduite à 320 × 320 (JPEG) pour l'écran
function coverForDeck(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(''); return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 320;
      const x = c.getContext('2d');
      const k = Math.max(320 / img.width, 320 / img.height);
      const w = img.width * k, h = img.height * k;
      x.drawImage(img, (320 - w) / 2, (320 - h) / 2, w, h);
      resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}
let mediaSendChain = Promise.resolve();
function deckSendMedia(force) {
  if (!deckLink.writer) return;
  mediaSendChain = mediaSendChain.then(async () => {
    const m = mstate;
    const msg = { t: 'media', playing: m.status === 'Playing', none: !!(m.none || m.unavailable), title: m.title || '', artist: m.artist || '', album: m.album || '' };
    const coverKey = m.none ? '' : (m.cover || '').length + ':' + (m.cover || '').slice(-64);
    if (force || coverKey !== deckLink.lastCover) {
      msg.cover = m.none ? '' : await coverForDeck(m.cover);   // '' = pas de jaquette
      deckLink.lastCover = coverKey;
    }
    await deckWrite(msg);
  }).catch(() => {});
}

async function sendToDeck() {
  if (!('serial' in navigator)) { toast('L’envoi USB n’est possible que dans le logiciel installé.', 'err'); return; }
  if (!deckLink.writer) {
    let port;
    try { port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303A }] }); }
    catch (e) { toast('Écran non détecté. Branchez-le au PC avec le câble USB-C et allumez-le.', 'err', 6000); return; }
    if (!(await deckOpen(port))) { toast('Problème de connexion USB : le port est peut-être utilisé par un autre programme.', 'err', 6000); return; }
  }
  toast('Envoi en cours…');
  const reply = deckWaitReply(6000);
  if (!(await deckWrite({ t: 'config', data: deviceConfig() }))) { toast('Problème de connexion USB.', 'err', 6000); return; }
  const ok = await reply;
  if (ok) {
    ui.deckOk = true;
    await api.createBackup(cfg);
    toast('Envoyé sur l’écran.', 'ok');
    deckSendMedia(true);
    render();
  } else {
    toast('L’écran n’a pas répondu. Le programme de l’écran n’est peut-être pas encore installé.', 'err', 7000);
  }
}

// ---------------------------------------------------------------------------
// Simulateur
// ---------------------------------------------------------------------------
function openSim(spaceId) {
  ui.modal = { type: 'sim', screen: spaceId ? 'space' : 'home', spaceId: spaceId || null, page: 0, homePage: 0, cells: {} };
  render();
}
function simRender() { const el = $('#sim'); const m = ui.modal; if (!el || !m) return; const s = m.screen === 'home' ? null : spaceById(m.spaceId); el.innerHTML = s ? deckPage(s, m.page, m) : deckHome(m); }
let simTimer = null;
const simCellAt = (i) => { const m = ui.modal, s = spaceById(m.spaceId); const c = s && s.pages[m.page] && s.pages[m.page].cells[i]; return c ? { s, c, st: (m.cells[`${s.id}|${m.page}|${i}`] = m.cells[`${s.id}|${m.page}|${i}`] || {}) } : null; };
// appui long : la barre se remplit dès que le doigt est posé
function simDown(i) {
  const x = simCellAt(i); if (!x || ((x.c.behavior || {}).mode || 'tap') !== 'hold') return;
  const t0 = Date.now(), ms = x.c.behavior.holdMs || 1500, st = x.st;
  clearInterval(simTimer);
  simTimer = setInterval(() => {
    st.prog = Math.min(100, (Date.now() - t0) / ms * 100);
    if (st.prog >= 100) { clearInterval(simTimer); st.prog = null; st.flash = true; setTimeout(() => { st.flash = false; simRender(); }, 600); }
    simRender();
  }, 40);
}
// appui court et bascule : au moment où le doigt se lève (sauf s'il a glissé)
function simTap(i) {
  const x = simCellAt(i); if (!x) return;
  const m = ui.modal, { s, c, st } = x, mode = (c.behavior || {}).mode || 'tap';
  if (mode === 'hold') return;
  if (mode === 'toggle') { st.on = !st.on; simRender(); return; }
  st.flash = true; simRender(); setTimeout(() => { st.flash = false; simRender(); }, 220);
  if (c.action && c.action.type === 'page') {
    if (c.action.page === 'home') { m.screen = 'home'; } else { m.page = Math.min(+c.action.page, s.pages.length - 1); }
    setTimeout(simRender, 230);
  }
}
// glisser vers la gauche : page suivante ; vers la droite : page précédente
// lecteur : les boutons de l'aperçu pilotent vraiment la musique du PC
function simPlayerBtn(k) {
  const m = ui.modal;
  api.mediaKey(k);
  if (k === 'play') m.playing = !(m.playing != null ? m.playing : mstate.status === 'Playing');
  const el = $(`#sim [data-simbtn="${k}"]`);
  if (el) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 200); }
  if (k === 'play') simRender();
}
function simSwipe(dir) {
  const m = ui.modal;
  if (m.screen !== 'home' && isPlayer(spaceById(m.spaceId))) {
    api.mediaKey(dir > 0 ? 'next' : 'prev');
    m.anim = dir > 0 ? 'slide-l' : 'slide-r'; simRender(); m.anim = null; return;
  }
  const home = m.screen === 'home';
  const n = home ? homePages() : spaceById(m.spaceId).pages.length;
  const cur = home ? (m.homePage || 0) : m.page;
  let next = cur + dir;
  if (next < 0 || next >= n) next = cfg.device.loop && n > 1 ? (next + n) % n : cur;
  m.anim = next === cur ? 'bump' : (dir > 0 ? 'slide-l' : 'slide-r');
  if (home) m.homePage = next; else m.page = next;
  simRender();
  m.anim = null;
}
function simUp() {
  clearInterval(simTimer);
  const m = ui.modal; if (!m || m.type !== 'sim') return;
  Object.values(m.cells).forEach(st => { if (st.prog != null) st.prog = null; });
  simRender();
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------
function confirmBox(title, text, ok, danger, fn) { ui.modal = { type: 'confirm', title, text, ok, danger, fn }; renderModal(); }
function textBox(title, value, fn) { ui.modal = { type: 'text', title, value, fn }; renderModal(); setTimeout(() => { const el = $('#f-modaltext'); if (el) { el.focus(); el.select(); } }, 0); }

const ACTIONS = {
  nav: (d) => { ui.view = d.view; ui.menu = null; if (d.view === 'parametres') api.listBackups().then(b => { ui.backups = b; render(); }); render(); },
  'cat-new': () => { ui.modal = { type: 'cat', id: null, label: '', icon: 'etoile', color: '#B79CFF' }; renderModal(); setTimeout(() => { const el = $('#f-catname'); if (el) el.focus(); }, 0); },
  'cat-edit': (d) => { const c = cfg.cats.find(x => x.id === d.id); ui.modal = { type: 'cat', id: c.id, label: c.label, icon: c.icon, color: c.color }; renderModal(); },
  'cat-color': (d) => { ui.modal.color = d.v; renderModal(); },
  'cat-icon': (d) => { ui.modal.icon = d.v; renderModal(); },
  'cat-ok': () => {
    const m = ui.modal, label = (m.label || '').trim();
    if (!label) { toast('Donnez un nom à la catégorie.', 'err'); return; }
    if (m.id) { Object.assign(cfg.cats.find(x => x.id === m.id), { label, icon: m.icon, color: m.color }); ui.modal = null; commit(); toast('Catégorie modifiée.', 'ok'); return; }
    const id = 'c_' + uid();
    cfg.cats.push({ id, label, icon: m.icon, color: m.color });
    ui.modal = { type: 'new-space', cat: id, tpl: 0, name: label, exe: '' };
    commit(); toast('Catégorie « ' + label + ' » créée. Créez maintenant son premier espace.', 'ok', 5000);
  },
  'cat-del': (d) => {
    const c = cfg.cats.find(x => x.id === d.id); const n = cfg.spaces.filter(s => s.category === d.id).length;
    if (n) { toast(`« ${c.label} » contient encore ${n} espace${n > 1 ? 's' : ''} : supprimez-les ou changez-les de catégorie (menu ⋯ de l’espace).`, 'err', 7000); return; }
    confirmBox('Supprimer la catégorie « ' + c.label + ' » ?', 'Elle est vide, rien d’autre ne sera supprimé.', 'Supprimer', true, () => { cfg.cats = cfg.cats.filter(x => x.id !== d.id); commit(); });
  },
  'space-movecat': (d) => { ui.menu = null; ui.modal = { type: 'movecat', id: d.id }; render(); },
  'movecat-ok': (d) => { const sp = spaceById(ui.modal.id); sp.category = d.v; ui.modal = null; commit(); toast('« ' + sp.name + ' » est maintenant dans ' + catOf(d.v).label + '.', 'ok'); },
  'home-pv': (d) => { ui.homePv = Math.max(0, Math.min(homePages() - 1, (ui.homePv || 0) + +d.d)); render(); },
  'media-key': (d) => { api.mediaKey(d.k).then(ok => { if (!ok) toast(api.browser ? 'Disponible dans le logiciel installé sur Windows.' : 'Commande non envoyée.', 'err'); }); },
  'pl-volume': (d, el) => { curSpace().player.volume = el.checked; commit(); },
  'pl-coverbg': (d, el) => { curSpace().player.coverBg = el.checked; commit(); },
  'dev-swipe': (d, el) => { cfg.device.swipe = el.checked; commit(); },
  'dev-loop': (d, el) => { cfg.device.loop = el.checked; commit(); },
  'space-menu': (d) => { ui.menu = ui.menu === d.id ? null : d.id; render(); },
  'open-space': (d) => { ui.spaceId = d.id; ui.page = 0; ui.cell = null; ui.view = 'editeur'; ui.menu = null; render(); },
  'space-home': (d, el) => { const s = spaceById(d.id); s.onHome = el.checked; commit(); },
  'space-rename': (d) => { ui.menu = null; const s = spaceById(d.id); textBox('Renommer l\u2019espace', s.name, (v) => { if (v.trim()) { s.name = v.trim(); commit(); } }); },
  'space-dup': (d) => {
    ui.menu = null; const s = clone(spaceById(d.id)); s.id = uid(); s.name = s.name + ' (copie)';
    s.pages.forEach(p => { p.id = uid(); p.cells.forEach(c => { if (c && c.action) delete c.action.hotkey; }); });
    cfg.spaces.push(s); cfg.homeOrder.push(s.id); commit(); toast('Espace dupliqué.', 'ok');
  },
  'space-export': async (d) => { ui.menu = null; render(); const r = await api.exportSpace(spaceById(d.id)); if (r) toast('Espace exporté.', 'ok'); },
  'space-del': (d) => {
    ui.menu = null; const s = spaceById(d.id);
    confirmBox('Supprimer « ' + s.name + ' » ?', 'L\u2019espace et toutes ses pages seront supprimés. Pensez à l\u2019exporter avant si vous voulez le garder.', 'Supprimer', true, () => {
      cfg.spaces = cfg.spaces.filter(x => x.id !== s.id); cfg.homeOrder = cfg.homeOrder.filter(x => x !== s.id); commit(); toast('Espace supprimé.');
    });
  },
  'space-import': async () => {
    const s = await api.importSpace(); if (!s) return;
    if (s.error) { toast(s.error, 'err'); return; }
    s.id = uid(); (s.pages || []).forEach(p => { p.id = uid(); (p.cells || []).forEach(c => { if (c && c.action) delete c.action.hotkey; }); });
    if (!catKeys().includes(s.category)) s.category = 'jeu';
    cfg.spaces.push(s); cfg.homeOrder.push(s.id); commit(); toast('Espace « ' + s.name + ' » importé.', 'ok');
  },
  'new-space': (d) => { ui.modal = { type: 'new-space', cat: d.cat || 'jeu', tpl: 0, name: '', exe: '' }; renderModal(); },
  'ns-cat': (d) => { ui.modal.cat = d.v; ui.modal.tpl = 0; renderModal(); },
  'ns-tpl': (d) => { ui.modal.tpl = +d.i; renderModal(); },
  'ns-create': () => {
    const m = ui.modal, t = tplsOf(m.cat)[m.tpl];
    const s = newSpace(m.cat, t, (m.name || '').trim() || t.name, (m.exe || '').trim() || t.exe || '', OBS.state.status === 'on' ? OBS.state.scenes : null);
    cfg.spaces.push(s); cfg.homeOrder.push(s.id);
    ui.modal = null; ui.spaceId = s.id; ui.page = 0; ui.cell = null; ui.view = 'editeur'; commit(); toast('Espace créé.', 'ok');
  },
  simulate: (d) => openSim(d.id || null),
  send: () => sendToDeck(),
  page: (d) => { ui.page = +d.i; ui.cell = null; render(); },
  'page-add': () => { const s = curSpace(); s.pages.push({ id: uid(), name: 'PAGE ' + (s.pages.length + 1), cells: Array(15).fill(null) }); ui.page = s.pages.length - 1; ui.cell = null; commit(); },
  'page-rename': () => { const p = curPage(); textBox('Renommer la page', p.name, (v) => { if (v.trim()) { p.name = v.trim().toUpperCase(); commit(); } }); },
  'page-move': (d) => { const s = curSpace(); const j = ui.page + +d.d; if (j < 0 || j >= s.pages.length) return; const [p] = s.pages.splice(ui.page, 1); s.pages.splice(j, 0, p); ui.page = j; commit(); },
  'page-del': () => { const s = curSpace(), p = curPage(); confirmBox('Supprimer la page « ' + p.name + ' » ?', 'Ses cases seront supprimées.', 'Supprimer', true, () => { s.pages.splice(ui.page, 1); ui.page = Math.max(0, ui.page - 1); ui.cell = null; commit(); }); },
  cell: (d) => { ui.cell = +d.i; render(); },
  'cell-create': () => { curPage().cells[ui.cell] = { name: 'Nouvelle case', image: { type: 'icon', icon: 'etoile', color: '#9FB0C0', photo: null, showName: true, dim: 0.2 }, action: { type: 'joy', button: 1 }, behavior: { mode: 'tap', holdMs: 1500 } }; commit(); },
  'cell-clear': () => { confirmBox('Effacer cette case ?', 'Elle redeviendra vide.', 'Effacer', true, () => { curPage().cells[ui.cell] = null; commit(); }); },
  'cell-test': () => {
    const c = curCell(); const t = c.action && c.action.type;
    if (t === 'app' || t === 'obs' || (t === 'discord' && c.action.op !== 'raccourci')) runPcAction(c, true);
    else if (t === 'page') toast('Essayez-la dans « Aperçu de l\u2019écran ».');
    else toast('Cette case est envoyée par l\u2019écran lui-même : testez-la une fois l\u2019écran branché, ou dans « Aperçu de l\u2019écran ».');
  },
  'img-type': (d) => { const c = curCell(); c.image.type = d.v; if (d.v === 'icon' && !c.image.icon) c.image.icon = 'etoile'; commit(); if (d.v === 'photo' && !c.image.photo) ACTIONS['photo-import'](); },
  'icon-color': (d) => { curCell().image.color = d.v; commit(); },
  'picto-open': () => { ui.modal = { type: 'picto', pick: null }; ui.search = ''; ui.catFilter = 'Tous'; renderModal(); },
  'picto-cat': (d) => { ui.catFilter = d.v; renderModal(); },
  'picto-pick': (d) => { ui.modal.pick = d.v; renderModal(); },
  'picto-ok': () => { const c = curCell(); if (ui.modal.pick) { c.image.icon = ui.modal.pick; c.image.type = 'icon'; } ui.modal = null; commit(); },
  'photo-import': () => { ui.pickFor = 'cell'; $('#file-image').click(); },
  'photo-name': (d, el) => { curCell().image.showName = el.checked; commit(); },
  'photo-dim': (d) => { curCell().image.dim = +d.v; commit(); },
  'crop-rotate': () => { ui.modal.rot = (ui.modal.rot + 90) % 360; ui.modal.ox = 0; ui.modal.oy = 0; cropDraw(); },
  'crop-ok': () => {
    const data = cropResult(), m = ui.modal; ui.modal = null;
    if (m.kind === 'bg') { const l = editLook(); l.bgPhoto = data; l.bgType = 'photo'; }
    else { const c = curCell(); c.image.photo = data; c.image.type = 'photo'; }
    commit();
  },
  'app-screen': (d) => { curCell().action.screen = d.v; commit(); },
  'app-pos': (d) => { curCell().action.position = d.v; commit(); },
  'app-open': (d) => { curCell().action.ifOpen = d.v; commit(); },
  'choose-exe': async () => { const p = await api.chooseExe(); if (p) { const a = curCell().action; a.exe = p; a.processName = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''); commit(); } else if (api.browser) toast('Disponible dans le logiciel installé.'); },
  beh: (d) => { const c = curCell(); c.behavior = c.behavior || { holdMs: 1500 }; c.behavior.mode = d.v; commit(); },
  'home-move': (d) => { const i = cfg.homeOrder.indexOf(d.id), j = i + +d.d; if (j < 0 || j >= cfg.homeOrder.length) return; cfg.homeOrder.splice(i, 1); cfg.homeOrder.splice(j, 0, d.id); commit(); },
  'home-toggle': (d) => { const s = spaceById(d.id); s.onHome = !s.onHome; commit(); },
  'bg-type': (d) => { const l = editLook(); l.bgType = d.v; commit(); if (d.v === 'photo' && !l.bgPhoto) ACTIONS['bg-photo'](); },
  'bg-color': (d) => { editLook().bgColor = d.v; commit(); },
  'bg-photo': () => { ui.pickFor = 'bg'; $('#file-image').click(); },
  'bg-dim': (d) => { editLook().bgDim = +d.v; commit(); },
  'edge-color': (d) => { editLook().idleEdge = d.v; commit(); },
  'acc-color': (d) => { editLook().accent = d.v; commit(); },
  theme: (d) => { const t = THEMES[+d.i]; Object.assign(editLook(), { bgType: 'color', bgColor: t.bgColor, idleEdge: t.idleEdge, accent: t.accent }); commit(); },
  'look-reset': () => { Object.assign(editLook(), clone(DEFAULT_LOOK)); commit(); },
  'look-own': () => { const s = spaceById(ui.lookScope); s.look = clone(cfg.look); commit(); },
  'look-common': () => { const s = spaceById(ui.lookScope); s.look = null; commit(); },
  'preview-cell': (d) => { previewOn[+d.i] = !previewOn[+d.i]; render(); },
  'obs-on': () => { OBS.connect(cfg.obs); },
  'discord-on': () => { api.discordConnect({ clientId: cfg.discord.clientId, clientSecret: cfg.discord.clientSecret }, cfg.discord.autoConnect).then(st => { setD(st); render(); }); },
  'discord-off': () => { api.discordDisconnect().then(st => { setD(st); render(); }); },
  'discord-auto': (d, el) => { cfg.discord.autoConnect = el.checked; commit(true); },
  'discord-run': (d) => runDiscord(d.op),
  'discord-dev': () => { window.open('https://discord.com/developers/applications'); },
  'sc-add': () => {
    const n = cfg.discord.shortcuts.length + 1;
    const sc = { id: uid(), name: 'Raccourci ' + n, keys: '' };
    cfg.discord.shortcuts.push(sc);
    const page = ui.view === 'editeur' ? curPage() : null;
    if (page) {
      const k = page.cells.findIndex(x => !x);
      if (k >= 0) page.cells[k] = cell(sc.name, 'discussion', { type: 'discord', op: 'raccourci', arg: sc.id, argName: sc.name }, { mode: 'tap', holdMs: 1500 }, '#B79CFF');
      else toast('La page est pleine : le raccourci est créé, placez-le sur une autre page.', '', 6000);
    }
    commit();
    setTimeout(() => { const els = document.querySelectorAll('[data-field="sc-name"]'); const el = els[els.length - 1]; if (el) { el.focus(); el.select(); } }, 0);
  },
  'sc-del': (d) => {
    const sc = shortcutById(d.id); if (!sc) return;
    const used = cfg.spaces.reduce((n, sp) => n + sp.pages.reduce((m, p) => m + p.cells.filter(x => x && x.action && x.action.type === 'discord' && x.action.arg === sc.id).length, 0), 0);
    confirmBox('Supprimer « ' + sc.name + ' » ?', used ? `Il est utilisé par ${used} case${used > 1 ? 's' : ''} : elle${used > 1 ? 's' : ''} n’enverr${used > 1 ? 'ont' : 'a'} plus rien.` : 'Ce raccourci n’est utilisé par aucune case.', 'Supprimer', true, () => { cfg.discord.shortcuts = cfg.discord.shortcuts.filter(x => x.id !== sc.id); commit(); });
  },
  'discord-devpage': () => {
    const sp = curSpace(); if (!sp) return;
    const cells = dstate.inputs.map(x => cell(x.name.slice(0, 28), 'micro', { type: 'discord', op: 'entree', arg: x.id, argName: x.name }, { mode: 'tap', holdMs: 1500 }, '#5CC8FF'))
      .concat(dstate.outputs.map(x => cell(x.name.slice(0, 28), 'casque', { type: 'discord', op: 'sortie', arg: x.id, argName: x.name }, { mode: 'tap', holdMs: 1500 }, '#FFB547')));
    if (!cells.length) { toast('Aucun appareil audio trouvé dans Discord.', 'err'); return; }
    if (cells.length > 15) toast('Les 15 premiers appareils tiennent sur la page.', '', 6000);
    sp.pages.push({ id: uid(), name: 'AUDIO', cells: pad(cells) });
    ui.page = sp.pages.length - 1; ui.cell = null; commit();
    toast('Page AUDIO créée : micros en cyan, sorties en ambre.', 'ok');
  },
  'obs-off': () => { OBS.disconnect(); },
  'obs-auto': (d, el) => { cfg.obs.autoConnect = el.checked; commit(true); },
  sleep: (d) => { cfg.device.sleepMin = +d.v; commit(); },
  startwin: async (d, el) => { cfg.settings.startWithWindows = el.checked; await api.setStartWithWindows(el.checked); commit(true); },
  'backups-folder': () => api.openBackupsFolder(),
  'backup-now': async () => { const n = await api.createBackup(cfg); if (n) { toast('Sauvegarde créée.', 'ok'); ui.backups = await api.listBackups(); render(); } else toast('Disponible dans le logiciel installé.'); },
  'backup-restore': (d) => {
    confirmBox('Restaurer cette sauvegarde ?', 'Vos espaces actuels seront remplacés par ceux de la sauvegarde.', 'Restaurer', false, async () => {
      const b = await api.readBackup(d.name); if (!b || !b.spaces) { toast('Sauvegarde illisible.', 'err'); return; }
      cfg = migrate(b); ui.view = 'espaces'; commit(); toast('Sauvegarde restaurée.', 'ok');
    });
  },
  'reset-all': () => { confirmBox('Tout réinitialiser ?', 'Tous vos espaces et réglages reviendront à ceux d\u2019origine. Une sauvegarde est faite avant.', 'Réinitialiser', true, async () => { await api.createBackup(cfg); cfg = defaultConfig(); ui.view = 'espaces'; commit(); }); },
  'modal-close': () => { ui.modal = null; renderModal(); },
  overlay: (d, el, ev) => { if (ev.target === el && ui.modal && ui.modal.type !== 'crop') { ui.modal = null; renderModal(); } },
  'confirm-ok': () => { const fn = ui.modal.fn; ui.modal = null; renderModal(); fn(); },
  'text-ok': () => { const fn = ui.modal.fn, v = $('#f-modaltext').value; ui.modal = null; renderModal(); fn(v); }
};
function editLook() {
  const scope = ui.lookScope || 'all';
  if (scope === 'all') return cfg.look;
  const s = spaceById(scope);
  if (!s.look) s.look = clone(cfg.look);
  return s.look;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) { if (ui.menu) { ui.menu = null; render(); } return; }
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // géré par « change »
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset, el, ev);
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset && el.dataset.act && el.type === 'checkbox') { const fn = ACTIONS[el.dataset.act]; if (fn) fn(el.dataset, el, ev); return; }
  if (el.id === 'file-image') {
    const f = el.files[0]; el.value = '';
    if (f) openCrop(f, ui.pickFor === 'bg' ? 'bg' : 'cell', ui.pickFor === 'bg' ? 'Photo du fond d\u2019écran' : 'Photo de la case');
    return;
  }
  onField(el, true);
});
document.addEventListener('input', (ev) => onField(ev.target, false));

function onField(el, isChange) {
  const f = el.dataset && el.dataset.field;
  if (!f) return;
  const c = curCell();
  const v = el.value;
  switch (f) {
    case 'name': c.name = v; commit(true); refreshGridOnly(); break;
    case 'joy': c.action.button = Math.max(1, Math.min(32, parseInt(v, 10) || 1)); commit(true); refreshGridOnly(); break;
    case 'media': c.action.media = v; commit(); break;
    case 'page': c.action.page = v === 'home' ? 'home' : +v; commit(); break;
    case 'type': {
      const t = v;
      const base = { joy: { type: 'joy', button: 1 }, key: { type: 'key', keys: '' }, media: { type: 'media', media: 'volplus' }, app: { type: 'app', preset: 'autre', exe: '', args: '', processName: '', screen: 'gauche', position: 'plein', ifOpen: 'front' }, obs: { type: 'obs', op: 'scene', target: '' }, discord: { type: 'discord', op: 'micro', arg: '', argName: '' }, page: { type: 'page', page: 0 }, none: { type: 'none' } }[t];
      c.action = clone(base); commit(); break;
    }
    case 'preset': c.action.preset = v; if (v !== 'autre') { c.action.exe = ''; c.action.args = ''; c.action.processName = ''; } commit(); break;
    case 'exe': c.action.exe = v; if (!c.action.processName) { /* déduit au lancement */ } commit(true); break;
    case 'args': c.action.args = v; commit(true); break;
    case 'proc': c.action.processName = v; commit(true); break;
    case 'op': c.action.op = v; c.action.target = ''; commit(); break;
    case 'dop': c.action.op = v; c.action.arg = ''; c.action.argName = ''; if (v === 'raccourci' && cfg.discord.shortcuts[0]) { c.action.arg = cfg.discord.shortcuts[0].id; c.action.argName = cfg.discord.shortcuts[0].name; } commit(); break;
    case 'darg': {
      c.action.arg = v;
      const list = c.action.op === 'entree' ? dstate.inputs : (c.action.op === 'sortie' ? dstate.outputs : cfg.discord.shortcuts);
      const it = list.find(x => x.id === v); if (it) c.action.argName = it.name;
      commit(); break;
    }
    case 'dc-id': cfg.discord.clientId = v.trim(); commit(true); break;
    case 'dc-secret': cfg.discord.clientSecret = v.trim(); commit(true); break;
    case 'sc-name': { const sc = shortcutById(el.dataset.id); if (sc) { sc.name = v; cfg.spaces.forEach(sp => sp.pages.forEach(p => p.cells.forEach(x => { if (x && x.action && x.action.type === 'discord' && x.action.arg === sc.id) x.action.argName = v; }))); commit(true); } break; }
    case 'dpage-space': ui.dpageSpace = v; break;
    case 'd-in': if (v && isChange) runDiscord('entree', v); break;
    case 'd-out': if (v && isChange) runDiscord('sortie', v); break;
    case 'target': c.action.target = v; commit(!isChange); if (isChange) refreshGridOnly(); break;
    case 'hold': c.behavior.holdMs = +v; commit(!isChange); if (!isChange) { const s = el.parentElement.querySelector('.mono'); if (s) s.textContent = (v / 1000).toFixed(1).replace('.', ',') + ' s'; } break;
    case 'lookscope': ui.lookScope = v; render(); break;
    case 'obs-host': cfg.obs.host = v; commit(true); break;
    case 'obs-port': cfg.obs.port = +v || 4455; commit(true); break;
    case 'obs-pass': cfg.obs.password = v; commit(true); break;
    case 'bri': cfg.device.brightness = +v; commit(!isChange); if (!isChange) { const s = el.parentElement.querySelector('.mono'); if (s) s.textContent = v + ' %'; } break;
    case 'ns-name': ui.modal.name = v; break;
    case 'ns-exe': ui.modal.exe = v; break;
    case 'picto-search': ui.search = v; renderModal(); { const s = $('#f-psearch'); if (s) { s.focus(); s.setSelectionRange(v.length, v.length); } } break;
    case 'crop-zoom': ui.modal.zoom = +v; cropDraw(); break;
    case 'modal-text': ui.modal.value = v; break;
    case 'cat-name': ui.modal.label = v; break;
    default: break;
  }
}
function refreshGridOnly() {
  // met à jour la grille sans reconstruire le panneau (garde le curseur dans le champ)
  const wrap = $('.gridwrap .grid');
  if (!wrap) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = viewEditeur();
  const g = tmp.querySelector('.gridwrap .grid');
  if (g) wrap.innerHTML = g.innerHTML;
  const h = tmp.querySelector('.cellpanel h2'); const cur = $('.cellpanel h2');
  if (h && cur) cur.innerHTML = h.innerHTML;
}

// capture d'une combinaison de touches
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && ui.modal && ui.modal.type !== 'crop') { ui.modal = null; renderModal(); return; }
  if (ev.key === 'Enter' && ui.modal && ui.modal.type === 'text') { ACTIONS['text-ok'](); return; }
  const el = ev.target;
  if (!(el.dataset && el.dataset.field === 'keycap')) {
    if ((ev.key === 'Enter' || ev.key === ' ') && el.dataset && el.dataset.act === 'preview-cell') { ev.preventDefault(); el.click(); }
    return;
  }
  ev.preventDefault();
  const names = { Control: null, Shift: null, Alt: null, Meta: null, ' ': 'Espace', Escape: 'Échap', ArrowUp: 'Haut', ArrowDown: 'Bas', ArrowLeft: 'Gauche', ArrowRight: 'Droite', Enter: 'Entrée', Backspace: 'Retour', Delete: 'Suppr', Tab: 'Tab', Insert: 'Inser', Home: 'Début', End: 'Fin', PageUp: 'PageHaut', PageDown: 'PageBas' };
  if (names[ev.key] === null) return; // modificateur seul
  let key = names[ev.key] || (ev.code.startsWith('Key') ? ev.code.slice(3) : (ev.code.startsWith('Digit') ? ev.code.slice(5) : (ev.code.startsWith('Numpad') ? 'Pavé' + ev.code.slice(6) : ev.key.length === 1 ? ev.key.toUpperCase() : ev.key)));
  const combo = [ev.ctrlKey && 'Ctrl', ev.altKey && 'Alt', ev.shiftKey && 'Shift', ev.metaKey && 'Win', key].filter(Boolean).join('+');
  if (el.dataset.sc) { const sc = shortcutById(el.dataset.sc); if (sc) { sc.keys = combo; el.value = combo; commit(true); } return; }
  curCell().action.keys = combo; el.value = combo; commit(true); refreshGridOnly();
});

// glisser-déposer des cases
document.addEventListener('dragstart', (ev) => { const el = ev.target.closest && ev.target.closest('[data-drag]'); if (el) { ev.dataTransfer.setData('text/plain', el.dataset.drag); ev.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (ev) => { const el = ev.target.closest && ev.target.closest('[data-drag]'); if (el) { ev.preventDefault(); el.classList.add('dragover'); } });
document.addEventListener('dragleave', (ev) => { const el = ev.target.closest && ev.target.closest('[data-drag]'); if (el) el.classList.remove('dragover'); });
document.addEventListener('drop', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-drag]'); if (!el) return;
  ev.preventDefault();
  const from = +ev.dataTransfer.getData('text/plain'), to = +el.dataset.drag;
  if (isNaN(from) || from === to) { el.classList.remove('dragover'); return; }
  const cells = curPage().cells; const t = cells[from]; cells[from] = cells[to]; cells[to] = t;
  ui.cell = to; commit();
});

// recadrage : déplacer la photo
let cropDrag = null;
let swipe = null;
document.addEventListener('pointerdown', (ev) => {
  const cv = ev.target.closest && ev.target.closest('#cropview');
  if (cv && ui.modal && ui.modal.type === 'crop') {
    const canvas = $('#cropcanvas'); const k = canvas.width / canvas.getBoundingClientRect().width;
    cropDrag = { x: ev.clientX, y: ev.clientY, ox: ui.modal.ox, oy: ui.modal.oy, k };
    cv.setPointerCapture(ev.pointerId); return;
  }
  if (!(ui.modal && ui.modal.type === 'sim' && ev.target.closest && ev.target.closest('#sim'))) return;
  const m = ui.modal;
  const nav = ev.target.closest('[data-sim]');
  if (nav && nav.dataset.sim !== 'space') {
    if (nav.dataset.sim === 'home') m.screen = 'home';
    if (nav.dataset.sim === 'page') m.page = +nav.dataset.i;
    simRender(); return;
  }
  const sc = ev.target.closest('[data-simcell]');
  const pb = ev.target.closest('[data-simbtn]');
  swipe = { x: ev.clientX, y: ev.clientY, moved: false, cell: sc ? +sc.dataset.simcell : null, space: nav ? nav.dataset.id : null, btn: pb ? pb.dataset.simbtn : null };
  if (sc) simDown(+sc.dataset.simcell);
});
document.addEventListener('pointermove', (ev) => {
  if (swipe && ui.modal && ui.modal.type === 'sim') {
    const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
    if (!swipe.moved && cfg.device.swipe !== false && Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) {
      swipe.moved = true; clearInterval(simTimer);
      Object.values(ui.modal.cells).forEach(st => { st.prog = null; });
      simRender();
    }
    if (swipe.moved) { const g = $('#sim .dgrid, #sim .dhome, #sim .dplayer'); if (g) g.style.transform = `translateX(${dx * 0.5}px)`; }
    return;
  }
  if (!cropDrag || !ui.modal) return;
  ui.modal.ox = cropDrag.ox + (ev.clientX - cropDrag.x) * cropDrag.k;
  ui.modal.oy = cropDrag.oy + (ev.clientY - cropDrag.y) * cropDrag.k;
  cropDraw();
});
document.addEventListener('pointerup', (ev) => {
  cropDrag = null;
  if (swipe && ui.modal && ui.modal.type === 'sim') {
    const w = swipe; swipe = null;
    const dx = ev.clientX - w.x;
    if (w.moved) { if (Math.abs(dx) > 60) simSwipe(dx < 0 ? 1 : -1); else simRender(); return; }
    if (w.space) { const m = ui.modal; m.screen = 'space'; m.spaceId = w.space; m.page = 0; simRender(); return; }
    if (w.cell != null) simTap(w.cell);
    if (w.btn) simPlayerBtn(w.btn);
  }
  swipe = null;
  simUp();
});
document.addEventListener('wheel', (ev) => {
  if (!(ev.target.closest && ev.target.closest('#cropview')) || !ui.modal) return;
  ev.preventDefault();
  ui.modal.zoom = Math.max(1, Math.min(5, ui.modal.zoom * (ev.deltaY < 0 ? 1.08 : 0.92)));
  const z = $('#f-zoom'); if (z) z.value = ui.modal.zoom;
  cropDraw();
}, { passive: false });

api.onDiscordState((st) => {
  setD(st);
  if (ui.view === 'connexions' || ui.view === 'editeur') render(); else { const s = $('.status'); if (s) render(); }
});
api.onMediaState((st) => {
  if (st.none) mstate = Object.assign({}, mstate, { none: true, unavailable: false, title: '', artist: '', album: '', status: '', cover: '' });
  else if (st.unavailable || st.error) mstate = Object.assign({}, mstate, { unavailable: true, none: true, message: st.message || st.error });
  else {
    const same = st.title === mstate.title && st.artist === mstate.artist && st.album === mstate.album;
    mstate = Object.assign({}, mstate, st, { none: false, unavailable: false, cover: st.cover || (same ? mstate.cover : '') });
  }
  deckSendMedia(false);
  if (ui.modal && ui.modal.type === 'sim') { ui.modal.playing = null; simRender(); }
  else if (ui.view === 'editeur' && isPlayer(curSpace())) render();
});
function updateMediaWatch() { api.mediaWatch(cfg.spaces.some(isPlayer)); }
async function runDiscord(op, arg) {
  const r = await api.discordRun(op, arg);
  if (!r.ok) toast('Discord : ' + r.message, 'err');
}

OBS.onChange(() => { if (ui.view === 'connexions' || ui.view === 'editeur') render(); else { const s = $('.status'); if (s) render(); } });

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
function migrate(c) {
  const d = defaultConfig();
  const out = Object.assign({}, d, c);
  out.look = Object.assign({}, DEFAULT_LOOK, c.look || {});
  out.obs = Object.assign({}, d.obs, c.obs || {});
  out.discord = Object.assign({}, d.discord, c.discord || {});
  out.cats = Array.isArray(c.cats) ? c.cats : [];
  if (!Array.isArray(out.discord.shortcuts)) out.discord.shortcuts = [];
  out.device = Object.assign({}, d.device, c.device || {});
  out.settings = Object.assign({}, d.settings, c.settings || {});
  out.spaces = (c.spaces || []).filter(s => s && s.pages);
  out.homeOrder = (c.homeOrder || []).filter(id => out.spaces.some(s => s.id === id));
  // version 0.3 : Discord devient un espace de l'accueil, comme les autres
  if (!c.discordSpaceAdded) {
    out.discordSpaceAdded = true;
    if (!out.spaces.some(s => s.category === 'discord')) {
      const dc = newSpace('discord', TEMPLATES.discord[0], 'Discord', '');
      dc.pages[0].cells = pad(discordCells(out.discord.shortcuts));
      out.spaces.push(dc);
    }
  }
  // version 0.7 : espace Spotify (lecteur) sur l'accueil
  if (!c.spotifySpaceAdded) {
    out.spotifySpaceAdded = true;
    if (!out.spaces.some(s => s.category === 'spotify')) out.spaces.push(newSpace('spotify', TEMPLATES.spotify[0], 'Spotify', ''));
  }
  out.spaces.forEach(s => { if (!out.homeOrder.includes(s.id)) out.homeOrder.push(s.id); });
  return out;
}

(async function start() {
  const saved = await api.loadConfig();
  cfg = saved ? migrate(saved) : defaultConfig();
  ui.version = await api.version();
  if (!saved) await api.saveConfig(cfg);
  // à chaque lancement : le démarrage avec Windows pointe vers cette version-ci
  api.setStartWithWindows(cfg.settings.startWithWindows);
  assignHotkeys();
  updateMediaWatch();
  render();
  deckAutoLink();
  if (cfg.obs.autoConnect) OBS.connect(cfg.obs);
  setD(await api.discordState());
  if (cfg.discord.autoConnect && cfg.discord.clientId && dstate.status !== 'on') api.discordConnect({ clientId: cfg.discord.clientId, clientSecret: cfg.discord.clientSecret }, true);
})();
