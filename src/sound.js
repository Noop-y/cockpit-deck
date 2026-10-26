// The Deck — moteur de la soundboard
// « Moi » : la sortie choisie (casque, canal Sonar…). « Discord » et « Jeu » : le micro virtuel (VB-CABLE),
// qui reçoit votre vraie voix + les sons. « Stream » : la source « The Deck – Sons » dans OBS.
'use strict';

const SOUND = (() => {
  const listeners = [];
  const buffers = new Map();           // fichier -> AudioBuffer
  const playing = new Map();           // id de la case -> [{ voices, t0, dur, loop, stream }]
  const state = { outputs: [], inputs: [], cableOut: null, cableIn: null, micLabel: '', micOn: false, error: '', ready: false };
  let conf = {};
  let ctxMe = null, ctxMic = null, micStream = null, micSrc = null, micGain = null, meSink = null, micKey = '';
  const emit = () => listeners.forEach(fn => { try { fn(state); } catch (e) { /* ignoré */ } });
  const isBrowser = () => !!(window.deck == null);

  // ---------- appareils audio ----------
  async function refreshDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return state;
    try {
      // les noms des appareils n'apparaissent qu'une fois l'accès au micro accordé (accordé par le logiciel)
      if (!isBrowser() && !state.ready) { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
    } catch (e) { /* pas de micro */ }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      state.outputs = list.filter(d => d.kind === 'audiooutput' && d.deviceId !== 'communications').map(d => ({ id: d.deviceId, label: d.label || 'Sortie audio' }));
      state.inputs = list.filter(d => d.kind === 'audioinput' && d.deviceId !== 'communications').map(d => ({ id: d.deviceId, label: d.label || 'Micro' }));
      state.cableOut = state.outputs.find(d => /cable input/i.test(d.label)) || null;    // où l'on joue
      state.cableIn = state.inputs.find(d => /cable output/i.test(d.label)) || null;     // ce que Discord et le jeu écoutent
      state.ready = true;
    } catch (e) { state.error = 'Liste des appareils audio indisponible.'; }
    emit();
    return state;
  }
  // micro réel proposé par défaut : celui de SteelSeries Sonar s'il existe
  function defaultMic() {
    const real = state.inputs.filter(d => !/cable output/i.test(d.label));
    const sonar = real.find(d => /sonar/i.test(d.label) && /micro/i.test(d.label));
    return sonar ? sonar.id : (real.find(d => d.id === 'default') || real[0] || {}).id || '';
  }

  // ---------- contextes audio ----------
  async function setup(c) {
    conf = Object.assign({ meOut: '', micIn: '', passMic: true, volMe: 80, volMic: 80, volStream: 80, master: 100, solo: false }, c || {});
    if (!ctxMe) ctxMe = new AudioContext({ latencyHint: 'interactive' });
    const wantSink = conf.meOut || '';
    if (wantSink !== meSink && ctxMe.setSinkId) { try { await ctxMe.setSinkId(wantSink); meSink = wantSink; } catch (e) { state.error = 'Sortie « Moi » introuvable : sortie par défaut.'; } }
    // micro virtuel
    if (state.cableOut) {
      if (!ctxMic) {
        ctxMic = new AudioContext({ latencyHint: 'interactive' });
        try { await ctxMic.setSinkId(state.cableOut.id); } catch (e) { state.error = 'Le micro virtuel ne répond pas.'; }
      }
      const key = conf.passMic ? (conf.micIn || defaultMic()) : '';
      if (key !== micKey) {
        micKey = key;
        if (micSrc) { try { micSrc.disconnect(); } catch (e) { /* ignoré */ } micSrc = null; }
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
        state.micOn = false; state.micLabel = '';
        if (key) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: key }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 } });
            micSrc = ctxMic.createMediaStreamSource(micStream);
            micGain = ctxMic.createGain(); micGain.gain.value = 1;
            micSrc.connect(micGain).connect(ctxMic.destination);
            state.micOn = true;
            state.micLabel = (state.inputs.find(d => d.id === key) || {}).label || '';
          } catch (e) { state.error = 'Votre micro n’a pas pu être ouvert.'; }
        }
      }
    }
    try { await ctxMe.resume(); if (ctxMic) await ctxMic.resume(); } catch (e) { /* ignoré */ }
    emit();
  }

  // ---------- fichiers ----------
  async function load(file) {
    if (buffers.has(file)) return buffers.get(file);
    if (!ctxMe) ctxMe = new AudioContext({ latencyHint: 'interactive' });
    const bytes = await api.soundRead(file);
    if (!bytes) throw new Error('Fichier son introuvable. Réimportez-le.');
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const buf = await ctxMe.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    buffers.set(file, buf);
    return buf;
  }
  // forme du son pour l'éditeur : n valeurs entre 0 et 1
  async function peaks(file, n) {
    const buf = await load(file);
    const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 16) m = Math.max(m, Math.abs(d[j])); out.push(m); }
    const mx = Math.max(0.01, ...out);
    return { peaks: out.map(v => v / mx), duration: buf.duration };
  }

  // ---------- lecture ----------
  function startVoice(ctx, buf, start, end, gain, a) {
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    const now = ctx.currentTime, len = end - start;
    if (a.mode === 'loop') { src.loop = true; src.loopStart = start; src.loopEnd = end; src.start(now, start); }
    else {
      src.start(now, start, len);
      if (a.fade !== false && len > 0.6) { g.gain.setValueAtTime(gain, now + len - 0.25); g.gain.linearRampToValueAtTime(0.0001, now + len); }
    }
    return { src, g, ctx };
  }
  function stopVoice(v) {
    try { const t = v.ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0.0001, t + 0.08); v.src.stop(t + 0.09); } catch (e) { /* déjà fini */ }
  }
  function stop(id) {
    const list = playing.get(id) || [];
    list.forEach(p => { p.voices.forEach(stopVoice); if (p.stream) OBS.stopSound(); clearTimeout(p.timer); });
    playing.delete(id);
    emit();
  }
  function stopAll() { Array.from(playing.keys()).forEach(stop); OBS.stopSound(); }

  // dests : { moi, discord, jeu, stream } ; renvoie la liste des sorties réellement utilisées
  async function play(id, file, a, dests) {
    if (!file) throw new Error('Aucun son choisi pour cette case.');
    a = a || {};
    const cur = playing.get(id);
    if (cur && cur.length) {
      const r = a.retrig || 'stop';
      if (r === 'stop') { stop(id); return []; }
      if (r === 'restart') stop(id);
    }
    if (conf.solo) stopAll();
    const buf = await load(file);
    const start = Math.max(0, Math.min(a.start || 0, buf.duration - 0.05));
    const end = a.end && a.end > start ? Math.min(a.end, buf.duration) : buf.duration;
    const vol = ((a.volume != null ? a.volume : 100) / 100) * ((conf.master != null ? conf.master : 100) / 100);
    const voices = [], used = [];
    if (dests.moi) { voices.push(startVoice(ctxMe, buf, start, end, vol * conf.volMe / 100, a)); used.push('moi'); }
    if ((dests.discord || dests.jeu) && ctxMic) { voices.push(startVoice(ctxMic, buf, start, end, vol * conf.volMic / 100, a)); if (dests.discord) used.push('discord'); if (dests.jeu) used.push('jeu'); }
    let stream = false;
    if (dests.stream && OBS.state.status === 'on') {
      try { await OBS.playSound(file, vol * conf.volStream / 100, a.mode === 'loop'); stream = true; used.push('stream'); } catch (e) { state.error = 'OBS : ' + e.message; }
    }
    const entry = { voices, t0: performance.now(), dur: end - start, loop: a.mode === 'loop', stream };
    if (!entry.loop) entry.timer = setTimeout(() => { const l = (playing.get(id) || []).filter(x => x !== entry); if (l.length) playing.set(id, l); else playing.delete(id); emit(); }, (end - start) * 1000 + 60);
    playing.set(id, (playing.get(id) || []).concat([entry]));
    emit();
    return used;
  }
  // lecture « tant qu'on appuie » : le doigt se lève
  function release(id, a) { if (a && a.mode === 'hold') stop(id); }
  function progress(id) {
    const l = playing.get(id); if (!l || !l.length) return null;
    const p = l[l.length - 1]; if (p.loop) return 100;
    return Math.min(100, (performance.now() - p.t0) / 10 / p.dur);
  }
  function preview(file, a) { return play('__preview', file, Object.assign({}, a, { retrig: 'restart', mode: a && a.mode === 'loop' ? 'once' : (a && a.mode) }), { moi: true }); }
  function forget(file) { buffers.delete(file); }
  // petit bip pour vérifier une sortie : 'moi' ou 'micro'
  function beep(which) {
    const ctx = which === 'moi' ? ctxMe : ctxMic;
    if (!ctx) return false;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4);
    return true;
  }

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { refreshDevices().then(() => setup(conf)); });

  return { state, setup, refreshDevices, defaultMic, load, peaks, play, stop, stopAll, release, progress, preview, forget, beep,
    isPlaying: (id) => playing.has(id), onChange: (fn) => listeners.push(fn) };
})();
