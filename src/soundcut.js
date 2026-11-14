// The Deck — découper un son de la soundboard (fenêtre « Découper le son »)
//
// Le fichier copié reste entier : la case garde seulement le début et la fin du passage choisi
// (action.start / action.end, en secondes), et le moteur (sound.js) ne joue que ce passage.
// On peut donc redécouper à tout moment, ou revenir au son entier.
// Chargé après app.js : ajoute ses actions à ACTIONS.
'use strict';

const CUT_MIN = 0.1;   // passage le plus court (s)

// temps → texte « 1:02,35 »
function cutFmt(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0').replace('.', ',')}`;
}
// garde un passage valable dans [0, dur]
function cutClamp(start, end, dur) {
  dur = Math.max(CUT_MIN, dur || 0);
  let s = Math.max(0, Math.min(+start || 0, dur - CUT_MIN));
  let e = end == null || !(+end > 0) ? dur : Math.min(+end, dur);
  if (e - s < CUT_MIN) e = Math.min(dur, s + CUT_MIN);
  if (e - s < CUT_MIN) s = Math.max(0, e - CUT_MIN);
  return { start: Math.round(s * 100) / 100, end: Math.round(e * 100) / 100 };
}
// plus haut niveau par colonne de pixels, entre t0 et t1 (0 à 1)
function cutPeaks(chans, rate, t0, t1, n) {
  const out = new Float32Array(n);
  const a = Math.floor(t0 * rate), b = Math.max(a + 1, Math.floor(t1 * rate));
  const per = (b - a) / n;
  const step = Math.max(1, Math.floor(per / 400));   // pas besoin de lire chaque échantillon
  for (let i = 0; i < n; i++) {
    const i0 = a + Math.floor(i * per), i1 = Math.max(i0 + 1, a + Math.floor((i + 1) * per));
    let mx = 0;
    for (const d of chans) for (let k = i0; k < i1 && k < d.length; k += step) { const v = Math.abs(d[k]); if (v > mx) mx = v; }
    out[i] = mx;
  }
  let top = 0; out.forEach(v => { if (v > top) top = v; });
  return top > 0 ? out.map(v => v / top) : out;
}

// ouvre la fenêtre pour la case n° ci de la page en cours
async function openCut(ci) {
  const s = curSpace(), p = curPage(), c = p && p.cells[ci];
  if (!c || !c.action || c.action.type !== 'sound' || !c.action.file) return;
  let buf;
  try { await ensureAudio(); buf = await SOUND.load(c.action.file); } catch (e) { toast('Ce son n’a pas pu être lu : ' + (e && e.message ? e.message : e), 'err'); return; }
  const dur = buf.duration;
  if (c.action.dur == null) { c.action.dur = Math.round(dur * 100) / 100; commit(true); }
  const sel = cutClamp(c.action.start, c.action.end, dur);
  const chans = []; for (let k = 0; k < Math.min(2, buf.numberOfChannels); k++) chans.push(buf.getChannelData(k));
  ui.modal = { type: 'cut', spaceId: s.id, page: s.pages.indexOf(p), cell: ci, name: c.name || c.action.fileName || 'Son', file: c.action.file,
    dur, start: sel.start, end: sel.end, vs: 0, ve: dur, chans, rate: buf.sampleRate, peaks: null, head: null };
  renderModal();
}

function cutModalHTML(m) {
  const len = m.end - m.start;
  const nudge = (k, d, label) => `<button class="btn sm" data-act="cut-nudge" data-k="${k}" data-v="${d}">${label}</button>`;
  const zoomed = m.vs > 0.001 || m.ve < m.dur - 0.001;
  return `<div class="modal" role="dialog" aria-label="Découper le son"><div class="modal-head"><h2 class="disp" style="font-size:25px">Découper le son</h2><span class="muted small">${esc(m.name)} · ${cutFmt(m.dur)}</span></div>
    <div class="small muted" style="line-height:1.5">Écoutez le son : la barre blanche montre où en est la lecture, et « Début ici » / « Fin ici » posent les poignées à cet endroit. Vous pouvez aussi faire glisser les deux poignées ambre (en les lâchant, on entend l’endroit choisi). Molette : zoomer pour être plus précis. Le fichier n’est pas modifié : vous pourrez redécouper plus tard.</div>
    <div id="cutview" style="position:relative;touch-action:none;cursor:ew-resize"><canvas id="cutcanvas" width="1600" height="300" style="width:100%;height:170px;border-radius:12px;background:var(--field);border:1px solid var(--line2);display:block"></canvas></div>
    <div class="row" style="justify-content:space-between;margin-top:-8px"><span class="mono small muted">${cutFmt(m.vs)}</span>${zoomed ? '<button class="btn sm" data-act="cut-zoom" data-v="all">Tout voir</button>' : `<button class="btn sm" data-act="cut-zoom" data-v="sel">Zoomer sur le passage</button>`}<span class="mono small muted">${cutFmt(m.ve)}</span></div>
    <div class="row" style="gap:18px;flex-wrap:wrap">
      <div><span class="lab">Début</span><div class="row" style="gap:6px">${nudge('start', -0.1, '−0,1 s')}<span class="mono" style="color:var(--amber);min-width:80px;text-align:center" id="cut-st">${cutFmt(m.start)}</span>${nudge('start', 0.1, '+0,1 s')}</div></div>
      <div><span class="lab">Fin</span><div class="row" style="gap:6px">${nudge('end', -0.1, '−0,1 s')}<span class="mono" style="color:var(--amber);min-width:80px;text-align:center" id="cut-en">${cutFmt(m.end)}</span>${nudge('end', 0.1, '+0,1 s')}</div></div>
      <div><span class="lab">Durée gardée</span><span class="mono" id="cut-len" style="line-height:36px">${len.toFixed(2).replace('.', ',')} s</span></div>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn" data-act="cut-play-all">▶ Écouter tout le son</button><button class="btn" data-act="cut-play">▶ Écouter le passage</button>
      <span class="small muted">Pendant l’écoute :</span><button class="btn sm" data-act="cut-here" data-k="start" disabled>⟦ Début ici</button><button class="btn sm" data-act="cut-here" data-k="end" disabled>Fin ici ⟧</button></div>
    <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="cut-all">Garder tout le son</button>
      <label class="chk small"><input type="checkbox" data-act="cut-auto" ${cfg.audio.cutOnAdd !== false ? 'checked' : ''}>Ouvrir cette fenêtre à chaque son ajouté</label>
      <span class="grow"></span><button class="btn" data-act="cut-cancel">Annuler</button><button class="btn pri" data-act="cut-ok">Valider le passage</button></div></div>`;
}

function cutDraw() {
  const m = ui.modal, cv = $('#cutcanvas');
  if (!m || m.type !== 'cut' || !cv) return;
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, n = 400;
  if (!m.peaks || m.peaksFor !== m.vs + ':' + m.ve) { m.peaks = cutPeaks(m.chans, m.rate, m.vs, m.ve, n); m.peaksFor = m.vs + ':' + m.ve; }
  const span = m.ve - m.vs, px = (t) => (t - m.vs) / span * W;
  const xs = px(m.start), xe = px(m.end), bw = W / n;
  x.clearRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,181,71,.10)'; x.fillRect(xs, 0, xe - xs, H);
  m.peaks.forEach((v, i) => {
    const cx = i * bw + bw / 2, h = Math.max(4, v * (H - 40));
    x.fillStyle = cx >= xs && cx <= xe ? '#FFB547' : '#3A4652';
    x.fillRect(i * bw + 1, (H - h) / 2, Math.max(1, bw - 2), h);
  });
  // poignées
  [xs, xe].forEach(hx => {
    x.fillStyle = '#FFB547'; x.fillRect(hx - 3, 0, 6, H);
    x.beginPath(); x.roundRect ? x.roundRect(hx - 14, H / 2 - 30, 28, 60, 8) : x.rect(hx - 14, H / 2 - 30, 28, 60); x.fill();
    x.fillStyle = '#07090C'; x.fillRect(hx - 5, H / 2 - 14, 3, 28); x.fillRect(hx + 2, H / 2 - 14, 3, 28);
  });
  // tête de lecture
  if (m.head != null) { const hx = px(m.head); x.fillStyle = '#E8EDF2'; x.fillRect(hx - 2, 0, 4, H); }
  const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  set('#cut-st', cutFmt(m.start)); set('#cut-en', cutFmt(m.end)); set('#cut-len', (m.end - m.start).toFixed(2).replace('.', ',') + ' s');
}

// ---------- tirer les poignées ----------
let cutDrag = null;
function cutTimeAt(clientX) {
  const m = ui.modal, cv = $('#cutcanvas'); const r = cv.getBoundingClientRect();
  return m.vs + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (m.ve - m.vs);
}
function cutMove(which, t) {
  const m = ui.modal;
  if (which === 'start') m.start = Math.max(0, Math.min(t, m.end - CUT_MIN));
  else m.end = Math.min(m.dur, Math.max(t, m.start + CUT_MIN));
  m.start = Math.round(m.start * 100) / 100; m.end = Math.round(m.end * 100) / 100;
}
document.addEventListener('pointerdown', (ev) => {
  const v = ev.target.closest && ev.target.closest('#cutview');
  if (!v || !ui.modal || ui.modal.type !== 'cut' || ev.button !== 0) return;
  const m = ui.modal, t = cutTimeAt(ev.clientX);
  // la poignée la plus proche suit le doigt
  const which = Math.abs(t - m.start) <= Math.abs(t - m.end) ? 'start' : 'end';
  cutDrag = { which, id: ev.pointerId };
  cutMove(which, t); cutDraw();
  try { v.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
document.addEventListener('pointermove', (ev) => {
  if (!cutDrag || ev.pointerId !== cutDrag.id || !ui.modal || ui.modal.type !== 'cut') return;
  cutMove(cutDrag.which, cutTimeAt(ev.clientX)); cutDraw();
});
// en lâchant une poignée, on entend tout de suite l'endroit choisi :
// le début du passage, ou les 2 dernières secondes avant la fin
const cutUp = (ev) => {
  if (!cutDrag || ev.pointerId !== cutDrag.id) return;
  const w = cutDrag.which; cutDrag = null;
  const m = ui.modal; if (!m || m.type !== 'cut') return;
  if (w === 'start') cutPlay(m.start, m.end); else cutPlay(Math.max(m.start, m.end - 2), m.end);
};
document.addEventListener('pointerup', cutUp);
document.addEventListener('pointercancel', cutUp);
// molette : zoom autour du pointeur
document.addEventListener('wheel', (ev) => {
  if (!(ev.target.closest && ev.target.closest('#cutview')) || !ui.modal || ui.modal.type !== 'cut') return;
  ev.preventDefault();
  const m = ui.modal, t = cutTimeAt(ev.clientX), k = ev.deltaY < 0 ? 0.8 : 1.25;
  let span = Math.max(0.5, Math.min(m.dur, (m.ve - m.vs) * k));
  let vs = t - (t - m.vs) * span / (m.ve - m.vs);
  vs = Math.max(0, Math.min(vs, m.dur - span));
  const was = m.vs > 0.001 || m.ve < m.dur - 0.001;
  m.vs = vs; m.ve = vs + span;
  const now = m.vs > 0.001 || m.ve < m.dur - 0.001;
  if (was !== now) renderModal(); else cutDraw();
}, { passive: false });

// ---------- écoute ----------
// On écoute un morceau [from, to] ; la barre blanche (m.head) suit la lecture.
let cutAnim = null;
async function cutPlay(from, to) {
  const m = ui.modal; if (!m || m.type !== 'cut') return;
  const c = cutCell();
  from = Math.max(0, Math.min(from, m.dur - 0.05)); to = Math.max(from + 0.05, Math.min(to, m.dur));
  try {
    await ensureAudio();
    await SOUND.preview(m.file, Object.assign({}, c ? c.action : {}, { start: from, end: to, mode: 'once', fade: false }));
  } catch (e) { toast(e && e.message ? e.message : String(e), 'err'); return; }
  const t0 = performance.now();
  m.playing = { from, to };
  cancelAnimationFrame(cutAnim);
  const tick = () => {
    const mm = ui.modal; if (!mm || mm.type !== 'cut') return;
    if (!SOUND.isPlaying('__preview')) { mm.head = null; mm.playing = null; cutDraw(); cutButtons(); return; }
    mm.head = Math.min(to, from + (performance.now() - t0) / 1000); cutDraw();
    cutAnim = requestAnimationFrame(tick);
  };
  tick(); cutButtons();
}
function cutStop() { if (SOUND.isPlaying('__preview')) SOUND.stop('__preview'); }
// boutons qui changent pendant la lecture (sans redessiner toute la fenêtre)
function cutButtons() {
  const m = ui.modal; if (!m || m.type !== 'cut') return;
  const on = SOUND.isPlaying('__preview');
  const b1 = document.querySelector('[data-act="cut-play"]'), b2 = document.querySelector('[data-act="cut-play-all"]');
  if (b1) b1.textContent = on && m.playing && m.playing.to === m.end && m.playing.from === m.start ? '■ Arrêter' : '▶ Écouter le passage';
  if (b2) b2.textContent = on && m.playing && !(m.playing.to === m.end && m.playing.from === m.start) ? '■ Arrêter' : '▶ Écouter tout le son';
  document.querySelectorAll('[data-act="cut-here"]').forEach(b => { b.disabled = !on; });
}
SOUND.onChange(() => cutButtons());

function cutCell() {
  const m = ui.modal; const s = m && spaceById(m.spaceId); const p = s && s.pages[m.page];
  return p ? p.cells[m.cell] : null;
}
function cutClose() { cutStop(); cancelAnimationFrame(cutAnim); ui.modal = null; renderModal(); }

Object.assign(ACTIONS, {
  'snd-cut': () => { if (api.browser) { toast('Disponible dans le logiciel installé sur Windows.'); return; } openCut(ui.cell); },
  'cut-play': () => { const m = ui.modal; if (SOUND.isPlaying('__preview') && m.playing && m.playing.from === m.start && m.playing.to === m.end) cutStop(); else cutPlay(m.start, m.end); },
  'cut-play-all': () => { const m = ui.modal; if (SOUND.isPlaying('__preview') && m.playing && !(m.playing.from === m.start && m.playing.to === m.end)) cutStop(); else cutPlay(m.vs, m.ve); },
  'cut-here': (d) => {
    const m = ui.modal; if (m.head == null) return;
    cutMove(d.k, m.head); cutDraw();
    if (d.k === 'end') cutStop();   // la fin est posée : inutile d'écouter la suite
  },
  'cut-nudge': (d) => { const m = ui.modal; cutMove(d.k, m[d.k] + +d.v); cutDraw(); if (d.k === 'start') cutPlay(m.start, m.end); else cutPlay(Math.max(m.start, m.end - 2), m.end); },
  'cut-zoom': (d) => {
    const m = ui.modal;
    if (d.v === 'all') { m.vs = 0; m.ve = m.dur; }
    else { const pad = Math.max(0.25, (m.end - m.start) * 0.15); m.vs = Math.max(0, m.start - pad); m.ve = Math.min(m.dur, m.end + pad); }
    renderModal();
  },
  'cut-all': () => { const m = ui.modal; m.start = 0; m.end = m.dur; m.vs = 0; m.ve = m.dur; renderModal(); },
  'cut-cancel': () => cutClose(),
  'cut-auto': (d, el) => { cfg.audio.cutOnAdd = !!el.checked; commit(true); },
  'cut-ok': () => {
    const m = ui.modal, c = cutCell();
    if (c && c.action) {
      const sel = cutClamp(m.start, m.end, m.dur);
      c.action.start = sel.start;
      c.action.end = sel.end >= m.dur - 0.01 ? null : sel.end;   // jusqu'au bout : pas de fin enregistrée
      commit();
      toast(c.action.start || c.action.end ? `Passage gardé : ${cutFmt(sel.start)} → ${cutFmt(sel.end)}.` : 'Son entier gardé.', 'ok');
    }
    cutClose();
  }
});
