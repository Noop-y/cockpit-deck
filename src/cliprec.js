// The Deck — son des clips : le son du PC (+ sons de la soundboard partis sur « Stream ») et votre voix,
// envoyés à l'enregistreur pendant que la mémoire tourne. Deux pistes séparées, mélangées par l'enregistreur.
'use strict';

// module du « robinet » audio (chargé depuis la mémoire : les pages locales ne peuvent pas charger un fichier de worklet)
const PCM_WORKLET = `class PcmTap extends AudioWorkletProcessor {
  constructor() { super(); this.size = 2400; this.buf = new Float32Array(this.size * 2); this.n = 0; }
  process(inputs) {
    const inp = inputs[0] || [];
    const L = inp[0], R = inp[1] || inp[0];
    const len = L ? L.length : 128;
    for (let i = 0; i < len; i++) {
      this.buf[this.n * 2] = L ? L[i] : 0;
      this.buf[this.n * 2 + 1] = R ? R[i] : 0;
      if (++this.n === this.size) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Float32Array(this.size * 2); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('pcm-tap', PcmTap);
`;

const CLIPAUDIO = (() => {
  let ctx = null, nodes = {}, gains = {}, streams = [], busy = null, active = false;
  const st = { pc: false, mic: false, error: '' };
  let conf = { pc: true, mic: true, sb: true, micIn: '', pcDev: '' };

  function applyGains() {
    if (!ctx) return;
    if (gains.pc) gains.pc.gain.value = conf.pc ? 1 : 0;
    if (gains.sb) gains.sb.gain.value = conf.sb ? 1 : 0;
    if (gains.mic) gains.mic.gain.value = conf.mic ? 1 : 0;
  }
  async function openPc() {
    // un appareil choisi (ex. « Sonar – Stream », qui contient jeu + Discord + musique)
    if (conf.pcDev) {
      const d = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: conf.pcDev }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 } });
      streams.push(d); ctx.createMediaStreamSource(d).connect(gains.pc); st.pc = true; return;
    }
    // sinon le son de Windows (boucle de la sortie par défaut), comme un enregistreur d'écran
    const id = await api.clipsScreenSource();
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'desktop' } }, video: { mandatory: Object.assign({ chromeMediaSource: 'desktop', maxWidth: 32, maxHeight: 32, maxFrameRate: 1 }, id ? { chromeMediaSourceId: id } : {}) } });
    } catch (e) {
      s = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 32, height: 32, frameRate: 1 } });
    }
    s.getVideoTracks().forEach(t => t.stop());
    if (!s.getAudioTracks().length) throw new Error('pas de son');
    streams.push(s);
    ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(gains.pc);
    st.pc = true;
  }
  async function openMic() {
    const id = conf.micIn || (typeof SOUND !== 'undefined' ? SOUND.defaultMic() : '');
    const s = await navigator.mediaDevices.getUserMedia({ audio: Object.assign({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }, id ? { deviceId: { exact: id } } : {}) });
    streams.push(s);
    ctx.createMediaStreamSource(s).connect(gains.mic);
    st.mic = true;
  }
  async function start() {
    if (active || busy) return busy;
    busy = (async () => {
      try {
        ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'playback' });
        try { await ctx.setSinkId({ type: 'none' }); } catch (e) { /* ancienne version : sortie par défaut, silencieuse */ }
        await ctx.audioWorklet.addModule('data:text/javascript;base64,' + btoa(PCM_WORKLET));
        const mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);
        ['a', 'b'].forEach(k => {
          const n = new AudioWorkletNode(ctx, 'pcm-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
          n.port.onmessage = (ev) => { if (active) api.clipsAudio(k, ev.data); };
          n.connect(mute);
          nodes[k] = n;
        });
        gains.pc = ctx.createGain(); gains.sb = ctx.createGain(); gains.mic = ctx.createGain();
        gains.pc.connect(nodes.a); gains.sb.connect(nodes.a); gains.mic.connect(nodes.b);
        applyGains();
        active = true;
        st.error = '';
        try { await openPc(); } catch (e) { st.pc = false; st.error = 'Le son du PC n’a pas pu être capté.'; }
        try { await openMic(); } catch (e) { st.mic = false; st.error = (st.error ? st.error + ' ' : '') + 'Votre micro n’a pas pu être ouvert.'; }
        if (typeof SOUND !== 'undefined' && SOUND.setTap) SOUND.setTap(ctx, gains.sb);
        await ctx.resume();
      } catch (e) {
        st.error = 'Son des clips indisponible : ' + e.message;
      } finally { busy = null; }
    })();
    return busy;
  }
  async function stop() {
    if (busy) await busy;
    if (!active && !ctx) return;
    active = false;
    if (typeof SOUND !== 'undefined' && SOUND.setTap) SOUND.setTap(null, null);
    streams.forEach(s => s.getTracks().forEach(t => t.stop()));
    streams = []; nodes = {}; gains = {};
    try { if (ctx) await ctx.close(); } catch (e) { /* ignoré */ }
    ctx = null; st.pc = false; st.mic = false;
  }
  // micro ou source du son du PC changés : on les rouvre
  async function setConf(c) {
    const micChanged = c.micIn !== conf.micIn || (c.pcDev || '') !== (conf.pcDev || '');
    conf = Object.assign({}, conf, c);
    applyGains();
    if (micChanged && active && !busy) { await stop(); await start(); }
  }
  return { start, stop, setConf, state: st, isActive: () => active };
})();
