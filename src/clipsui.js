// The Deck — clips : espace Clips sur l'écran, case Clip, page Clips du logiciel (réglages et « Mes clips »)
'use strict';

const isClips = (s) => !!s && s.layout === 'clips';
let cstate = { available: false, capturing: false, running: false, starting: false, waiting: false, paused: false, when: 'jeu', rec: { on: false, since: 0 }, enc: null, target: '', game: '', buffer: 0, folder: '', screens: [], error: '' };
let clipsRecent = [];                 // les 3 derniers fichiers (pour l'écran)
ui.clipsTab = 'reglages'; ui.clipsLib = null; ui.clipsSel = null; ui.clipsFilter = 'tout'; ui.clipsGame = ''; ui.clipToast = null;

// ---------- petits outils ----------
const CLIP_MBPS = { 720: 8, 1080: 15, 1440: 25, 2160: 45 };
const clipDurLabel = (d) => { d = d == null ? cfg.clips.dur : d; const x = CLIP_DURS.find(k => k[0] === d); return x ? x[1] : d + ' s'; };
const clipKeepText = (d) => { d = d == null ? cfg.clips.dur : d; return d < 60 ? `Garde les ${d} secondes d’avant` : (d === 60 ? 'Garde la minute d’avant' : `Garde les ${Math.round(d / 60)} minutes d’avant`); };
const fmtClock = (s) => { if (s == null) return ''; s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtSize = (b) => b == null ? '?' : (b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' Go' : Math.max(1, Math.round(b / 1e6)) + ' Mo');
const estBytes = (sec) => CLIP_MBPS[cfg.clips.res] * (cfg.clips.fps >= 60 ? 1.6 : 1) * sec / 8 * 1e6 + 3 * 20000 * sec;
function fmtWhen(ms) {
  if (!ms) return '';
  const d = new Date(ms), now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return 'Aujourd’hui ' + hm;
  if (diff === 1) return 'Hier ' + hm;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + hm;
}
const recElapsed = () => cstate.rec.on && cstate.rec.since ? (Date.now() - cstate.rec.since) / 1000 : 0;
const CLIP_BGS = ['linear-gradient(135deg,#3B2A8F,#E0533D)', 'linear-gradient(135deg,#0E4D64,#7CC4FF)', 'linear-gradient(135deg,#3A2A10,#FFB547)', 'linear-gradient(135deg,#1B3A2A,#3FB97A)', 'linear-gradient(135deg,#2A1530,#FF7EB6)', 'linear-gradient(135deg,#15202B,#8E9BFF)'];
const kindLabel = { clip: 'CLIP', video: 'VIDÉO', capture: 'CAPTURE' };

// jeux reconnus : les espaces qui s'ouvrent quand leur programme démarre
function clipGames() {
  return cfg.spaces.filter(s => s.autoExe && /\.exe$/i.test(s.autoExe.trim()) && !['stream', 'bureau', 'discord', 'spotify', 'soundboard', 'clips'].includes(s.category))
    .map(s => ({ name: s.name, exe: s.autoExe.trim().split(/[\\/]/).pop() }));
}
let clipsSyncT = null;
function syncClips() {
  clearTimeout(clipsSyncT);
  clipsSyncT = setTimeout(() => {
    const c = cfg.clips;
    api.clipsConfig(Object.assign({}, c, { games: clipGames() })).then(st => { if (st && st.available !== undefined) setCstate(st); }).catch(() => {});
    CLIPAUDIO.setConf({ pc: c.pc, mic: c.mic, sb: c.sb, micIn: cfg.audio.micIn || '', pcDev: c.pcDev || '' });
  }, 250);
}
let clipsTick = null, clipsSeen = '';
function setCstate(st) {
  cstate = Object.assign({}, cstate, st || {});
  if (!api.browser) { if (cstate.capturing) CLIPAUDIO.start(); else CLIPAUDIO.stop(); }
  if (cstate.rec.on && !clipsTick) clipsTick = setInterval(() => { refreshClipsUI(); deckSendClips(false); }, 1000);
  if (!cstate.rec.on && clipsTick) { clearInterval(clipsTick); clipsTick = null; }
  // on ne redessine que si quelque chose de visible a changé (la mémoire avance toutes les 2 s)
  const k = JSON.stringify([clipStatusText(), cstate.enc, cstate.error, (cstate.screens || []).length, cstate.game, cstate.available, cstate.capturing]);
  if (k !== clipsSeen) { clipsSeen = k; refreshClipsUI(); }
  deckSendClips(false);
}
function refreshClipsUI() {
  if (ui.modal && ui.modal.type === 'sim') { simRender(); return; }
  if (ui.modal) return;                                   // ne pas couper une vidéo en lecture
  if (ui.view === 'clips' || (ui.view === 'editeur' && isClips(curSpace()))) render();
  else { const s = $('.status'); if (s && ui.view === 'espaces') { /* rien */ } }
}
function clipStatusText() {
  const c = cfg.clips, st = cstate;
  if (api.browser) return 'Aperçu : les clips s’enregistrent dans le logiciel sur Windows';
  if (!st.available) return 'Enregistreur absent de cette version';
  if (st.rec.on) return '● Enregistrement ' + fmtClock(recElapsed());
  if (c.paused) return 'Mémoire à l’arrêt : CLIP ne garde rien';
  if (c.when === 'jamais') return 'Mémoire éteinte : seule ENREGISTRER filme';
  if (st.waiting) return 'Mémoire en attente d’un jeu · ' + clipDurLabel();
  if (st.starting) return 'Mémoire en route…';
  if (st.running) return `Mémoire en marche · ${clipDurLabel()} · ${st.game && st.target === st.game ? st.game : 'écran entier'}`;
  return 'Mémoire arrêtée';
}
const clipDot = () => (cstate.running || cstate.rec.on) ? 'background:#FF4D5E;box-shadow:0 0 0 .4cqw rgba(255,77,94,.25)' : ((cstate.starting || cstate.waiting) && !cfg.clips.paused ? 'background:#FFB547' : 'background:#5B6875');

// ---------- actions ----------
function clipToast(title, sub, kind) {
  ui.clipToast = { title, sub, kind: kind || 'ok', t: Date.now() };
  const t = ui.clipToast;
  refreshClipsUI(); deckSendClips(true);
  setTimeout(() => { if (ui.clipToast === t) { ui.clipToast = null; refreshClipsUI(); } }, 2800);
}
async function runClip(op) {
  const c = cfg.clips;
  if (op === 'dur') { const i = CLIP_DURS.findIndex(d => d[0] === c.dur); c.dur = CLIP_DURS[(i + 1) % CLIP_DURS.length][0]; commit(true); refreshClipsUI(); deckSendClips(false); return; }
  if (op === 'mem') { c.paused = !c.paused; commit(true); clipToast(c.paused ? 'Mémoire à l’arrêt' : 'Mémoire en marche', c.paused ? 'CLIP ne garde plus rien.' : 'CLIP garde à nouveau les dernières secondes.', c.paused ? 'info' : 'ok'); return; }
  if (op === 'mic') { c.mic = !c.mic; commit(true); refreshClipsUI(); deckSendClips(false); return; }
  if (op === 'src') { c.src = c.src === 'jeu' ? 'ecran' : 'jeu'; commit(true); refreshClipsUI(); deckSendClips(false); return; }
  if (op === 'folder') { if (api.browser) toast('Disponible dans le logiciel installé sur Windows.'); else api.clipsOpenFolder(); return; }
  if (op !== 'clip' && op !== 'rec' && op !== 'shot') return;
  if (op === 'clip') clipToast('Clip en cours…', 'Assemblage des ' + clipDurLabel() + ' d’avant', 'info');
  const r = await api.clipsAction(op);
  if (!r || !r.ok) { const msg = (r && r.message) || 'Action impossible.'; clipToast(op === 'clip' ? 'Pas de clip' : (op === 'rec' ? 'Pas de vidéo' : 'Pas de capture'), msg, 'err'); toast(msg, 'err', 6000); return; }
  if (op === 'rec' && r.rec) clipToast('Enregistrement lancé', 'Touchez ARRÊTER pour finir la vidéo.', 'ok');
}
function onClipSaved(info) {
  clipsRecent = [info].concat(clipsRecent.filter(x => x.file !== info.file)).slice(0, 3);
  const where = 'Vidéos › The Deck › Clips';
  if (info.kind === 'clip') clipToast('Clip enregistré', `${info.game} · ${clipDurLabel(info.dur)} · ${where}`, 'ok');
  else if (info.kind === 'video') clipToast('Vidéo enregistrée', `${info.game} · ${fmtClock(info.dur)} · ${where}`, 'ok');
  else clipToast('Capture enregistrée', `${info.game} · image PNG · ${where}`, 'ok');
  if (!(ui.modal && ui.modal.type === 'sim')) toast((info.kind === 'capture' ? 'Capture' : (info.kind === 'video' ? 'Vidéo' : 'Clip')) + ' enregistré' + (info.kind === 'capture' || info.kind === 'video' ? 'e' : '') + ' : ' + info.name, 'ok', 5000);
  if (ui.clipsLib) loadClipsLib(true);
}
function startClips() {
  api.onClipsState(setCstate);
  api.onClipsSaved(onClipSaved);
  api.clipsState().then(setCstate).catch(() => {});
  syncClips();
  api.clipsList().then(r => { if (r && r.items && !clipsRecent.length) clipsRecent = r.items.slice(0, 3); deckSendClips(true); }).catch(() => {});
}

// ---------- vers l'écran (USB) ----------
let clipsSendKey = '';
function deckSendClips(force) {
  if (typeof deckLink === 'undefined' || !deckLink.writer) return;
  const c = cfg.clips;
  const msg = { t: 'clips', available: !!cstate.available, on: !!cstate.running, starting: !!cstate.starting, waiting: !!cstate.waiting, paused: !!c.paused, rec: !!cstate.rec.on, recSec: Math.round(recElapsed()), dur: c.dur, mic: !!c.mic, src: c.src, status: clipStatusText() };
  const rk = clipsRecent.map(r => r.file).join('|');
  if (force || rk !== deckLink.lastRecent) {
    msg.recent = clipsRecent.map(r => ({ kind: r.kind, game: r.game, when: fmtWhen(r.when), dur: r.kind === 'capture' ? '' : fmtClock(r.dur), thumb: r.thumb ? r.thumb.split(',')[1] : '' }));
    deckLink.lastRecent = rk;
  }
  if (force && ui.clipToast) msg.toast = { title: ui.clipToast.title, sub: ui.clipToast.sub, kind: ui.clipToast.kind };
  const key = JSON.stringify(Object.assign({}, msg, { recSec: 0 }));
  if (!force && !msg.recent && key === clipsSendKey && !cstate.rec.on) return;
  clipsSendKey = key;
  deckWrite(msg);
}

// ---------- sur l'écran ----------
function clipToastHTML() {
  const t = ui.clipToast; if (!t) return '';
  return `<div class="cltoast ${t.kind}" role="status"><span class="clok">${t.kind === 'err' ? '!' : (t.kind === 'info' ? '…' : '✓')}</span><span><b class="disp">${esc(t.title)}</b><span>${esc(t.sub)}</span></span></div>`;
}
function deckClips(space, sim) {
  const look = lookFor(space), c = cfg.clips;
  const A = (op) => sim ? `data-simclip="${op}"` : '';
  const memOn = !c.paused && c.when !== 'jamais';
  const rec = !!cstate.rec.on;
  const tabs = `<div class="dtabs">${homeBtn(look, sim)}<div class="dtab disp" style="border-color:${look.accent};color:${look.accent}">CLIPS</div></div>`;
  const pill = `<div class="clpill"><i style="${clipDot()}"></i><span>${esc(clipStatusText())}</span></div>`;
  const recent = clipsRecent.length ? clipsRecent.map((r, i) => `<div class="clthumb" style="${r.thumb ? `background-image:url('${r.thumb}')` : `background:${CLIP_BGS[i % 6]}`}">${r.kind !== 'capture' ? `<span class="cld">${fmtClock(r.dur)}</span>` : '<span class="cld">image</span>'}<span class="clcap"><b>${esc(r.game)}</b><span>${esc(fmtWhen(r.when))}</span></span></div>`).join('')
    : '<div class="clnone">Vos derniers clips apparaîtront ici.</div>';
  const dots = CLIP_DURS.map(([v]) => `<i style="${v === c.dur ? `background:${look.accent}` : ''}"></i>`).join('');
  const srcName = c.src === 'jeu' ? 'LE JEU' : 'L’ÉCRAN', srcSub = c.src === 'jeu' ? 'Fenêtre du jeu' : (c.src === 'choisir' ? 'Écran ' + (c.monitor + 1) : 'Écran entier');
  const inner = `<div class="dtop">${tabs}${pill}</div>
    <div class="clgrid${sim && sim.anim ? ' ' + sim.anim : ''}">
      <div class="clbig${memOn ? '' : ' off'}" ${A('clip')}>${svg('retour', 64, '#FF6B79', 1.8)}<span class="cltx"><span class="disp clt">CLIP</span><span class="cls">${clipKeepText()}</span></span></div>
      <div class="clc${rec ? ' rec' : ''}" ${A('rec')}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#FF4D5E" stroke-width="1.8"/><circle cx="12" cy="12" r="${rec ? 4 : 6}" fill="#FF4D5E"/></svg><span class="cltx"><span class="disp">${rec ? 'ARRÊTER' : 'ENREGISTRER'}</span><span class="clsub mono">${rec ? '● ' + fmtClock(recElapsed()) : 'Vidéo longue'}</span></span></div>
      <div class="clc" ${A('shot')}>${svg('appareilphoto', 28, '#7CC4FF')}<span class="cltx"><span class="disp">CAPTURE</span><span class="clsub">Une image</span></span></div>
      <div class="clc" ${A('dur')}><span class="cll">RETOUR EN ARRIÈRE</span><span class="disp cldur" style="color:${look.accent}">${clipDurLabel()}</span><span class="cldots">${dots}</span></div>
      <div class="clrecent"><div class="clrh"><span class="disp">DERNIERS CLIPS</span><span>Vidéos › The Deck › Clips</span></div><div class="clthumbs">${recent}</div></div>
      <div class="clc${memOn ? ' on-g' : ''}" ${A('mem')}>${svg('alimentation', 26, memOn ? '#3FB97A' : '#8E9BA8', 1.9)}<span class="cltx"><span class="disp">MÉMOIRE</span><span class="clsub" style="color:${memOn ? '#3FB97A' : '#8E9BA8'}">${memOn ? 'En marche' : 'À l’arrêt'}</span></span></div>
      <div class="clc${c.mic ? ' on-v' : ''}" ${A('mic')}>${svg('micro', 26, c.mic ? '#8E9BFF' : '#8E9BA8')}<span class="cltx"><span class="disp">MA VOIX</span><span class="clsub" style="color:${c.mic ? '#8E9BFF' : '#8E9BA8'}">${c.mic ? 'Dans les clips' : 'Coupée'}</span></span></div>
      <div class="clc" ${A('src')}>${svg('ecranmfd', 26, '#C9D6E2')}<span class="cltx"><span class="disp">${srcName}</span><span class="clsub">${srcSub}</span></span></div>
      <div class="clc" ${A('folder')}>${svg('dossier', 26, '#FFB547')}<span class="cltx"><span class="disp">DOSSIER</span><span class="clsub">S’ouvre sur le PC</span></span></div>
      <div class="clc free"><span>Case libre</span></div>
    </div>${clipToastHTML()}`;
  return deckFrame(look, inner, '', spaceOverlay(space, sim));
}

// ---------- case « Clips » dans un espace ----------
function clipCellFields(a) {
  return `<div><label class="lab" for="f-clipop">Action</label><select id="f-clipop" class="inp" data-field="clip-op">${CLIP_OPS.map(([v, l]) => `<option value="${v}" ${a.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${a.op === 'clip' || !a.op ? `<div class="small muted">Garde les ${clipDurLabel()} d’avant l’appui (réglable dans le menu <button class="linkbtn" data-act="nav" data-view="clips">Clips</button>).</div>` : ''}
    <div class="small muted">Touche réservée envoyée par l’écran : <span class="tag">${esc(a.hotkey || '…')}</span></div>`;
}

// ---------- logiciel : l'espace Clips ----------
function viewClipsSpace(s) {
  const cat = catOf(s.category);
  return `<div class="head"><div><div class="crumb"><button data-act="nav" data-view="espaces">Mes espaces</button> › ${esc(cat.label)}</div><h1 class="disp">${esc(s.name)}</h1></div>
    <div class="row"><button class="btn" data-act="simulate" data-id="${s.id}">Aperçu de l’écran</button><button class="btn pri" data-act="send">Envoyer sur l’écran</button></div></div>
    <div class="editor"><div style="flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:10px"><span class="lab" style="margin:0">Sur l’écran</span>${deckClips(s, null)}
      <div class="small muted">Dans « Aperçu de l’écran », les cases marchent pour de vrai : CLIP enregistre vraiment un clip.</div></div>
    <div class="panel" style="flex:1 1 340px;min-width:0"><h2 class="disp">Clips</h2>
      <div style="line-height:1.55">${esc(clipStatusText())}</div>
      <div class="row"><button class="btn pri" data-act="nav" data-view="clips">Réglages des clips</button><button class="btn" data-act="clips-goto-lib">Mes clips</button></div>
      <div class="note">Une case CLIP peut aussi aller dans n’importe quel autre espace (Star Citizen…) : choisissez « Clips » dans « Ce que fait la case ».</div></div></div>`;
}

// ---------- logiciel : page Clips ----------
function clipsTabs() {
  return `<div class="cltabs"><button class="cltab${ui.clipsTab === 'reglages' ? ' on' : ''}" data-act="clips-tab" data-v="reglages">Réglages</button><button class="cltab${ui.clipsTab === 'biblio' ? ' on' : ''}" data-act="clips-tab" data-v="biblio">Mes clips</button></div>`;
}
function viewClips() { return ui.clipsTab === 'biblio' ? viewClipsLib() : viewClipsSettings(); }
function viewClipsSettings() {
  const c = cfg.clips, st = cstate;
  const enc = st.enc ? (st.enc.gpu ? `Carte graphique ${st.enc.label} : enregistrement sans ralentir le jeu` : 'Pas de carte graphique compatible : le processeur enregistre (plus lourd)') : 'Carte graphique : détectée au premier démarrage';
  const okPill = st.running || st.rec.on;
  const radio = (act, v, cur, t, s2, extra) => `<button class="clradio${String(cur) === String(v) ? ' on' : ''}" data-act="${act}" data-v="${v}" role="radio" aria-checked="${String(cur) === String(v)}"><i></i><span><b>${t}</b><span>${s2}</span>${extra || ''}</span></button>`;
  const chip = (act, v, cur, l) => `<button class="clchip${String(cur) === String(v) ? ' on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`;
  const tg = (k, t, s2) => `<button class="cltog" data-act="clips-tog" data-k="${k}" aria-pressed="${!!c[k]}"><span><b>${t}</b><span>${s2}</span></span><i class="${c[k] ? 'on' : ''}"><u></u></i></button>`;
  const mic = (() => { const id = cfg.audio.micIn || (SOUND.state.ready ? SOUND.defaultMic() : ''); const d = SOUND.state.inputs.find(x => x.id === id); return d ? d.label : 'votre micro (choisi dans Sorties audio)'; })();
  const screens = (st.screens || []).length ? st.screens : [{ i: 0, primary: true, w: 0, h: 0 }];
  const scrSel = c.src === 'choisir' ? `<select class="inp" data-field="clips-monitor" style="margin-top:8px">${screens.map(x => `<option value="${x.i}" ${+x.i === +c.monitor ? 'selected' : ''}>Écran ${+x.i + 1}${x.w ? ` · ${x.w}×${x.h}` : ''}${x.primary ? ' (principal)' : ''}</option>`).join('')}</select>` : '';
  const games = clipGames();
  const err = st.error || (CLIPAUDIO.state.error && st.capturing ? CLIPAUDIO.state.error : '');
  const def = !c.folder;
  return `<div class="head"><div>${clipsTabs()}<h1 class="disp">Clips</h1><div class="muted" style="margin-top:4px">The Deck garde en mémoire les dernières secondes de jeu. La case <b style="color:var(--fg)">CLIP</b> les enregistre dans un fichier vidéo.</div></div>
      <div class="row"><span class="clpillx ${okPill ? 'ok' : (st.waiting || st.starting ? 'wait' : '')}">${esc(clipStatusText())}</span><span class="clpillx">${esc(enc)}</span></div></div>
    ${api.browser ? '<div class="warn">Les clips s’enregistrent dans le logiciel installé sur Windows. Ici, vous pouvez déjà tout régler.</div>' : (!st.available ? '<div class="warn">L’outil vidéo n’est pas inclus dans cette copie du logiciel. Installez la version téléchargée sur GitHub.</div>' : '')}
    ${err ? `<div class="warn">${esc(err)}</div>` : ''}
    <section class="clretour" aria-label="Retour en arrière">
      <div class="grow" style="display:flex;flex-direction:column;gap:12px"><div class="row" style="align-items:baseline"><h2 class="disp">Retour en arrière</h2><span class="muted small">Combien de temps avant l’appui sur CLIP se retrouve dans le clip.</span></div>
        <div class="cldurs" role="radiogroup" aria-label="Durée">${CLIP_DURS.map(([v, l]) => `<button class="disp${v === c.dur ? ' on' : ''}" role="radio" aria-checked="${v === c.dur}" data-act="clips-dur" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="clest"><div class="row" style="justify-content:space-between"><span>Place prise pendant le jeu</span><b class="mono">${fmtSize(estBytes(c.dur * 1.15))}</b></div>
        <div class="row" style="justify-content:space-between"><span>Taille d’un clip</span><b class="mono">${fmtSize(estBytes(c.dur))}</b></div>
        <div class="small">La mémoire s’efface au fur et à mesure : elle ne grossit jamais. Le chiffre change avec la qualité choisie plus bas.</div></div>
    </section>
    <div class="clcols">
      <section class="panel"><h2 class="disp">Ce qu’on filme</h2>
        ${radio('clips-src', 'jeu', c.src, 'Le jeu', 'La fenêtre du jeu en cours (un jeu de « Mes espaces »). Rien d’autre n’apparaît : notifications, Discord… Sans jeu lancé : l’écran principal.')}
        ${radio('clips-src', 'ecran', c.src, 'Écran entier', 'Tout ce qui s’affiche sur l’écran principal.')}
        ${radio('clips-src', 'choisir', c.src, 'Choisir un écran', 'Si vous en avez plusieurs.', scrSel)}
        <h2 class="disp" style="margin-top:6px">Qualité</h2>
        <div class="clchips">${chip('clips-res', 720, c.res, '720p')}${chip('clips-res', 1080, c.res, '1080p')}${chip('clips-res', 1440, c.res, '1440p')}${chip('clips-res', 2160, c.res, '4K')}</div>
        ${c.res === 2160 ? '<div class="small muted" style="line-height:1.5">4K : utile seulement si l’écran ou le jeu est lui-même en 4K. Les fichiers sont environ 3 fois plus gros qu’en 1080p, et il faut une carte graphique récente (NVIDIA, AMD ou Intel) pour que le jeu ne ralentisse pas.</div>' : ''}
        <div class="clchips">${chip('clips-fps', 30, c.fps, '30 images/s')}${chip('clips-fps', 60, c.fps, '60 images/s')}</div>
        <div class="small muted">Changer ce qu’on filme ou la qualité vide la mémoire : elle repart de zéro.</div></section>
      <section class="panel"><h2 class="disp">Son dans les clips</h2>
        ${tg('pc', 'Son du PC', c.pcDev ? 'Depuis : ' + esc(((SOUND.state.inputs.find(x => x.id === c.pcDev) || {}).label) || 'appareil choisi') : 'Le jeu, la musique, Discord')}
        ${c.pc ? `<div><label class="lab" for="f-clpcdev">Le son du PC vient de</label><select id="f-clpcdev" class="inp" data-field="clips-pcdev"><option value="">Windows : la sortie par défaut</option>${SOUND.state.inputs.filter(x => x.id !== 'default' && x.id !== 'communications').map(x => `<option value="${esc(x.id)}" ${c.pcDev === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}${c.pcDev && !SOUND.state.inputs.some(x => x.id === c.pcDev) ? `<option value="${esc(c.pcDev)}" selected>Appareil choisi (absent)</option>` : ''}</select>
          <div class="small muted" style="margin-top:6px;line-height:1.5">Avec <b style="color:var(--soft)">SteelSeries Sonar</b>, la sortie par défaut ne contient que le canal Jeu. Pour avoir aussi Discord et la musique, activez le mode streamer de Sonar, choisissez ici <b style="color:var(--soft)">« Sonar – Stream »</b>, et coupez « Ma voix » (elle est déjà dans ce mélange).</div></div>` : ''}
        ${tg('mic', 'Ma voix', 'Micro : ' + esc(mic))}
        ${tg('sb', 'Sons de la soundboard', 'Ceux joués avec la case « Stream »')}
        <div class="small muted" style="line-height:1.5">Le fichier contient tout mélangé (ce que les lecteurs jouent), plus deux pistes séparées, votre voix et le son du PC, pour le montage.</div></section>
      <section class="panel"><h2 class="disp">Mémoire en marche</h2>
        ${radio('clips-when', 'toujours', c.when, 'Toujours', 'Dès que The Deck est ouvert.')}
        ${radio('clips-when', 'jeu', c.when, 'Pendant un jeu', 'Quand un jeu de « Mes espaces » est lancé (Star Citizen…).')}
        ${radio('clips-when', 'jamais', c.when, 'Jamais', 'Seule la case ENREGISTRER filme, à la demande.')}
        <div class="small muted" style="line-height:1.5">${games.length ? 'Jeux reconnus : ' + games.map(g => `<b style="color:var(--soft)">${esc(g.name)}</b>`).join(', ') + (st.game ? ` · <span style="color:#7FE0A8">${esc(st.game)} est lancé</span>` : '') : 'Aucun jeu reconnu : dans un espace de jeu, indiquez son programme (« Ouvrir cet espace quand ce programme démarre »).'}</div>
        <h2 class="disp" style="margin-top:6px">Dossier</h2>
        <div class="inp mono small" style="display:flex;align-items:center;overflow:hidden;white-space:nowrap">${esc(def ? 'Vidéos\\The Deck\\Clips' : c.folder)}</div>
        <div class="small muted">Exemple : <span class="mono">Star Citizen 2026-10-27 19h12.mp4</span></div>
        <div class="row"><button class="btn pri grow" data-act="clips-folder">Ouvrir le dossier</button><button class="btn grow" data-act="clips-choose">Changer…</button>${def ? '' : '<button class="btn sm" data-act="clips-folder-def">Par défaut</button>'}</div></section>
    </div>`;
}

// ---------- logiciel : « Mes clips » ----------
async function loadClipsLib(quiet) {
  if (ui.clipsLoading) return;
  ui.clipsLoading = true;
  if (!quiet && ui.view === 'clips' && !ui.modal) render();
  try {
    const r = await api.clipsList();
    ui.clipsLib = r;
    if (r.items) clipsRecent = r.items.slice(0, 3);
    if (ui.clipsSel && !r.items.some(x => x.file === ui.clipsSel)) ui.clipsSel = null;
    if (!ui.clipsSel && r.items[0]) ui.clipsSel = r.items[0].file;
  } catch (e) { ui.clipsLib = { items: [], total: 0, free: null }; }
  ui.clipsLoading = false;
  if (ui.view === 'clips' && !ui.modal) render();
  deckSendClips(false);
}
function viewClipsLib() {
  const lib = ui.clipsLib;
  if (!lib && !ui.clipsLoading) setTimeout(() => loadClipsLib(), 0);
  const items = (lib && lib.items) || [];
  const games = [...new Set(items.map(x => x.game))];
  const shown = items.filter(x => (ui.clipsFilter === 'tout' || x.kind === ui.clipsFilter) && (!ui.clipsGame || x.game === ui.clipsGame));
  const sel = items.find(x => x.file === ui.clipsSel) || shown[0] || null;
  const total = lib ? lib.total : 0, free = lib ? lib.free : null;
  const pct = free ? Math.max(1, Math.min(100, Math.round(total / (total + free) * 100))) : 0;
  const filt = [['tout', 'Tout'], ['clip', 'Clips'], ['video', 'Vidéos'], ['capture', 'Captures']].map(([v, l]) => `<button class="clchip${ui.clipsFilter === v ? ' on' : ''}" data-act="clips-filter" data-v="${v}">${l}</button>`).join('');
  const cards = shown.map((x, i) => `<button class="clcard${sel && sel.file === x.file ? ' on' : ''}" data-act="clips-sel" data-f="${esc(x.file)}">
      <span class="clct" style="${x.thumb ? `background-image:url('${x.thumb}')` : `background:${CLIP_BGS[i % 6]}`}"><span class="clk ${x.kind}">${kindLabel[x.kind] || 'CLIP'}</span><span class="clcd mono">${x.kind === 'capture' ? 'image' : fmtClock(x.dur)}</span></span>
      <span class="clcm"><span><b>${esc(x.game)}</b><span>${esc(fmtWhen(x.when))}</span></span><span class="mono">${fmtSize(x.size)}</span></span></button>`).join('');
  const isImg = sel && sel.kind === 'capture';
  const aside = sel ? `<aside class="clside panel" aria-label="Clip choisi">
      <button class="clprev" data-act="clips-play" style="${sel.thumb ? `background-image:url('${sel.thumb}')` : `background:${CLIP_BGS[0]}`}" aria-label="${isImg ? 'Voir l’image' : 'Lire le clip'}"><span>${isImg ? svg('appareilphoto', 26, '#fff') : '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12z" fill="#fff"/></svg>'}</span></button>
      <div><div class="disp" style="font-size:22px;line-height:1.1">${esc(sel.game)}</div><div class="small muted" style="margin-top:2px">${esc(fmtWhen(sel.when))}${isImg ? '' : ' · ' + fmtClock(sel.dur)} · ${fmtSize(sel.size)}</div></div>
      <div class="inp mono small" style="height:auto;padding:9px 10px;word-break:break-all;line-height:1.4">${esc(sel.name)}</div>
      <div class="clacts"><button class="btn pri" data-act="clips-play">${isImg ? 'Voir' : 'Lire'}</button><button class="btn" data-act="clips-trim" ${isImg ? 'disabled' : ''}>Couper le début / la fin</button>
        <button class="btn" data-act="clips-rename">Renommer</button><button class="btn" data-act="clips-show">Voir dans le dossier</button>
        <button class="btn" data-act="clips-copy">Copier (pour Discord)</button><button class="btn danger" data-act="clips-del">Supprimer</button></div>
      <div class="small muted">« Copier » met ${isImg ? 'l’image' : 'la vidéo'} dans le presse-papiers : il suffit de faire Ctrl+V dans Discord.</div></aside>` : '';
  const empty = ui.clipsLoading && !lib ? '<div class="muted">Chargement…</div>'
    : `<div class="note">${items.length ? 'Rien ne correspond à ce filtre.' : 'Aucun clip pour l’instant. Touchez CLIP sur l’écran (ou dans « Aperçu de l’écran ») pendant une partie.'}</div>`;
  return `<div class="head"><div>${clipsTabs()}<h1 class="disp">Mes clips</h1></div>
      <div class="cldisk"><div class="row" style="justify-content:space-between"><span>Clips : <b>${fmtSize(total)}</b></span><span>${free != null ? 'Disque : ' + fmtSize(free) + ' libres' : ''}</span></div><div class="clbar"><i style="width:${pct}%"></i></div></div></div>
    <div class="row">${filt}<span class="grow"></span><label class="small muted" for="f-clgame">Jeu</label><select id="f-clgame" class="inp" style="width:auto;min-width:180px" data-field="clips-game"><option value="">Tous les jeux</option>${games.map(g => `<option ${ui.clipsGame === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select><button class="btn sm" data-act="clips-refresh">Actualiser</button><button class="btn sm" data-act="clips-folder">Ouvrir le dossier</button></div>
    <div class="editor"><div class="clgridsw">${shown.length ? cards : empty}</div>${aside}</div>`;
}
const clipSel = () => ((ui.clipsLib && ui.clipsLib.items) || []).find(x => x.file === ui.clipsSel);

// ---------- fenêtres : lire, couper ----------
function clipsModal(m) {
  if (m.type === 'clip-play') {
    const it = m.item;
    return `<div class="modal" role="dialog" aria-label="${esc(it.name)}" style="width:min(1040px,100%)"><div class="modal-head"><h2 class="disp" style="font-size:22px">${esc(it.game)} <span class="muted small">${esc(fmtWhen(it.when))}</span></h2><button class="iconbtn" data-act="modal-close" aria-label="Fermer">✕</button></div>
      ${m.url ? (it.kind === 'capture' ? `<img src="${esc(m.url)}" alt="${esc(it.name)}" style="width:100%;border-radius:12px;background:#000">` : `<video src="${esc(m.url)}" controls autoplay style="width:100%;max-height:70vh;border-radius:12px;background:#000"></video>`) : '<div class="warn">Disponible dans le logiciel installé sur Windows.</div>'}</div>`;
  }
  if (m.type === 'clip-trim') {
    const it = m.item, d = it.dur || 0;
    return `<div class="modal" role="dialog" aria-label="Couper le clip" style="width:min(1040px,100%)"><div class="modal-head"><h2 class="disp" style="font-size:22px">Couper le début / la fin</h2><button class="iconbtn" data-act="modal-close" aria-label="Fermer">✕</button></div>
      ${m.url ? `<video id="cltrimv" src="${esc(m.url)}" controls style="width:100%;max-height:56vh;border-radius:12px;background:#000"></video>` : '<div class="warn">Disponible dans le logiciel installé sur Windows.</div>'}
      <div class="row" style="justify-content:space-between"><span class="lab" style="margin:0">Garder de <b class="mono" id="cltr-a" style="color:var(--amber)">${fmtClock(m.a)}</b> à <b class="mono" id="cltr-b" style="color:var(--amber)">${fmtClock(m.b)}</b></span><span class="small muted mono" id="cltr-len">${fmtClock(m.b - m.a)} gardées</span></div>
      <div class="row" style="gap:12px;flex-wrap:nowrap"><label class="small muted" style="flex:1">Début<input type="range" min="0" max="${d}" step="0.5" value="${m.a}" data-field="clip-trim-a" style="width:100%"></label><label class="small muted" style="flex:1">Fin<input type="range" min="0" max="${d}" step="0.5" value="${m.b}" data-field="clip-trim-b" style="width:100%"></label></div>
      <div class="small muted">La coupe se fait à la seconde près, sans perte de qualité. Le clip d’origine est gardé : la version coupée s’ajoute à côté.</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="clips-trim-play">Revoir depuis le début</button><button class="btn" data-act="modal-close">Annuler</button><button class="btn pri" data-act="clips-trim-ok">Enregistrer la version coupée</button></div></div>`;
  }
  return '';
}
function onClipsField(f, v, el, isChange) {
  if (f === 'clips-monitor') { cfg.clips.monitor = +v || 0; commit(); return; }
  if (f === 'clips-pcdev') { cfg.clips.pcDev = v; commit(); return; }
  if (f === 'clips-game') { ui.clipsGame = v; render(); return; }
  if (f === 'clip-op') { const c = curCell(); c.action.op = v; if (v === 'rec') { c.image.icon = 'enregistrer'; } else if (v === 'shot') { c.image.icon = 'appareilphoto'; } else if (v === 'clip') { c.image.icon = 'retour'; } else c.image.icon = 'alimentation'; commit(); return; }
  if ((f === 'clip-trim-a' || f === 'clip-trim-b') && ui.modal && ui.modal.type === 'clip-trim') {
    const m = ui.modal, x = +v;
    if (f === 'clip-trim-a') m.a = Math.min(x, m.b - 1); else m.b = Math.max(x, m.a + 1);
    el.value = f === 'clip-trim-a' ? m.a : m.b;
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
    set('cltr-a', fmtClock(m.a)); set('cltr-b', fmtClock(m.b)); set('cltr-len', fmtClock(m.b - m.a) + ' gardées');
    const vid = document.getElementById('cltrimv'); if (vid) { try { vid.currentTime = f === 'clip-trim-a' ? m.a : Math.max(0, m.b - 1.5); } catch (e) { /* ignoré */ } }
  }
}

Object.assign(ACTIONS, {
  'clips-tab': (d) => { ui.clipsTab = d.v; if (d.v === 'biblio') loadClipsLib(); else render(); },
  'clips-goto-lib': () => { ui.view = 'clips'; ui.clipsTab = 'biblio'; loadClipsLib(); },
  'clips-dur': (d) => { cfg.clips.dur = +d.v; commit(); },
  'clips-src': (d) => { cfg.clips.src = d.v; commit(); },
  'clips-res': (d) => { cfg.clips.res = +d.v; commit(); },
  'clips-fps': (d) => { cfg.clips.fps = +d.v; commit(); },
  'clips-when': (d) => { cfg.clips.when = d.v; if (d.v !== 'jamais') cfg.clips.paused = false; commit(); },
  'clips-tog': (d) => { cfg.clips[d.k] = !cfg.clips[d.k]; commit(); },
  'clips-folder': () => runClip('folder'),
  'clips-choose': async () => { if (api.browser) { toast('Disponible dans le logiciel installé sur Windows.'); return; } const p = await api.clipsChooseFolder(); if (p) { cfg.clips.folder = p; ui.clipsLib = null; commit(); } },
  'clips-folder-def': () => { cfg.clips.folder = ''; ui.clipsLib = null; commit(); },
  'clips-filter': (d) => { ui.clipsFilter = d.v; render(); },
  'clips-refresh': () => loadClipsLib(),
  'clips-sel': (d) => { ui.clipsSel = d.f; render(); },
  'clips-play': async () => { const it = clipSel(); if (!it) return; ui.modal = { type: 'clip-play', item: it, url: await api.clipsFileUrl(it.file) }; renderModal(); },
  'clips-trim': async () => { const it = clipSel(); if (!it || it.kind === 'capture') return; ui.modal = { type: 'clip-trim', item: it, a: 0, b: it.dur || 0, url: await api.clipsFileUrl(it.file) }; renderModal(); },
  'clips-trim-play': () => { const v = document.getElementById('cltrimv'); if (v && ui.modal) { try { v.currentTime = ui.modal.a; v.play(); } catch (e) { /* ignoré */ } } },
  'clips-trim-ok': async () => {
    const m = ui.modal; if (!m) return;
    if (api.browser) { toast('Disponible dans le logiciel installé sur Windows.'); return; }
    toast('Découpe en cours…');
    const r = await api.clipsTrim(m.item.file, m.a, m.b);
    if (r && r.ok) { ui.modal = null; renderModal(); ui.clipsSel = r.file; toast('Version coupée enregistrée : ' + r.name, 'ok', 5000); loadClipsLib(true); }
    else toast((r && r.message) || 'Découpe impossible.', 'err');
  },
  'clips-rename': () => {
    const it = clipSel(); if (!it) return;
    textBox('Renommer', it.name.replace(/\.(mp4|png)$/i, ''), async (v) => {
      if (!v.trim()) return;
      const r = await api.clipsRename(it.file, v.trim());
      if (r && r.ok) { ui.clipsSel = r.file; loadClipsLib(true); } else toast((r && r.message) || 'Renommage impossible.', 'err');
    }, 80);
  },
  'clips-show': () => { const it = clipSel(); if (it) api.clipsShow(it.file); },
  'clips-copy': async () => { const it = clipSel(); if (!it) return; const r = await api.clipsCopy(it.file); toast(r && r.ok ? 'Copié : collez-le dans Discord avec Ctrl+V.' : 'Copie impossible.', r && r.ok ? 'ok' : 'err'); },
  'clips-del': () => {
    const it = clipSel(); if (!it) return;
    confirmBox('Supprimer « ' + it.name + ' » ?', 'Le fichier part dans la corbeille de Windows : vous pourrez encore le récupérer.', 'Supprimer', true, async () => {
      const r = await api.clipsDelete(it.file);
      if (r && r.ok) { ui.clipsSel = null; clipsRecent = clipsRecent.filter(x => x.file !== it.file); loadClipsLib(true); toast('Supprimé.'); } else toast((r && r.message) || 'Suppression impossible.', 'err');
    });
  }
});
