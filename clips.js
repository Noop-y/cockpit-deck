// The Deck — enregistreur de clips intégré
// Une « mémoire » filme en continu (FFmpeg, encodage par la carte graphique) en petits morceaux de 2 secondes.
// CLIP assemble les X dernières secondes dans un fichier MP4, ENREGISTRER garde tout entre deux appuis,
// CAPTURE prend une image. Le son (PC et voix) arrive de l'interface par deux tuyaux nommés.
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const EventEmitter = require('events');

const RES = { 720: [1280, 720], 1080: [1920, 1080], 1440: [2560, 1440], 2160: [3840, 2160] };
const MBPS = { 720: 8, 1080: 15, 1440: 25, 2160: 45 };   // Mbit/s à 30 images/s (× 1,6 à 60 images/s)
const SEG = 2;                       // durée d'un morceau de mémoire (s)
const VIDEO_EXT = /\.(mp4|png)$/i;

const z2 = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())} ${z2(d.getHours())}h${z2(d.getMinutes())}`;
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Clip';
// nom de programme -> expression pour gfxcapture, sans caractère spécial pour FFmpeg
const exeRegex = (exe) => '(?i)' + String(exe).split('').map(ch => /[A-Za-z0-9_ -]/.test(ch) ? ch : (ch === '.' ? '[.]' : '.')).join('') + '$';
const fwd = (p) => p.replace(/\\/g, '/').replace(/'/g, '\'\\\'\'');

class ClipRecorder extends EventEmitter {
  constructor(o) {
    super();
    this.o = o; // { ffmpeg, temp, data, videos, scanScript, shell, nativeImage }
    this.conf = { when: 'jeu', paused: false, src: 'jeu', monitor: 0, res: 1080, fps: 60, dur: 60, folder: '', games: [] };
    this.proc = null; this.key = ''; this.t0us = 0;
    this.segs = new Map();
    this.pipes = { a: null, b: null }; this.servers = []; this.lastData = { a: 0, b: 0 };
    this.rec = { on: false, since: 0, mark: -1 };
    this.cand = 0; this.fails = 0; this.retryAt = 0; this.locks = 0;
    this.scan = { fg: '', running: [], screens: [] };
    this.error = ''; this.probed = null; this.starting = false; this.stopping = null;
    this.index = this.readIndex();
    this.waiters = [];
  }

  // ---------- outils ----------
  available() { return process.platform === 'win32' && fs.existsSync(this.o.ffmpeg); }
  folder() { return this.conf.folder || path.join(this.o.videos, 'The Deck', 'Clips'); }
  thumbsDir() { return path.join(this.o.data, 'miniatures'); }
  indexPath() { return path.join(this.o.data, 'clips-index.json'); }
  readIndex() { try { return JSON.parse(fs.readFileSync(this.indexPath(), 'utf8')) || {}; } catch (e) { return {}; } }
  saveIndex() { try { fs.writeFileSync(this.indexPath(), JSON.stringify(this.index)); } catch (e) { /* ignoré */ } }
  nowRel() { return (Date.now() * 1000 - this.t0us) / 1e6; }
  inside(f) { const r = path.resolve(String(f || '')); return r.startsWith(path.resolve(this.folder()) + path.sep) && VIDEO_EXT.test(r) ? r : null; }

  run(args, ms) {
    return new Promise((resolve) => {
      let out = '', p;
      try { p = spawn(this.o.ffmpeg, args, { windowsHide: true }); } catch (e) { resolve({ code: -1, out: String(e) }); return; }
      const t = setTimeout(() => { try { p.kill(); } catch (e) { /* ignoré */ } }, ms || 120000);
      const add = (d) => { out += d; if (out.length > 40000) out = out.slice(-40000); };
      p.stdout.on('data', add); p.stderr.on('data', add);
      p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out: String(e) }); });
      p.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
    });
  }

  // ---------- ce que sait faire ce PC ----------
  async probe() {
    if (this.probed) return this.probed;
    const f = await this.run(['-hide_banner', '-filters'], 20000);
    const gfx = /\bgfxcapture\b/.test(f.out), dda = /\bddagrab\b/.test(f.out);
    let enc = null;
    for (const [id, codec, label] of [['nvenc', 'h264_nvenc', 'NVIDIA'], ['amf', 'h264_amf', 'AMD'], ['qsv', 'h264_qsv', 'Intel']]) {
      const r = await this.run(['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30', '-t', '0.4', '-c:v', codec, '-f', 'null', '-'], 20000);
      if (r.code === 0) { enc = { id, codec, label }; break; }
    }
    this.probed = { gfx, dda, enc: enc || { id: 'x264', codec: 'libx264', label: '' } };
    this.pushState();
    return this.probed;
  }
  // façons de filmer, de la meilleure à la plus sûre
  cands() {
    const p = this.probed, list = [], x = { id: 'x264', codec: 'libx264', label: '' };
    const hw = p.enc.id !== 'x264' ? p.enc : null;
    if (p.gfx && hw) list.push({ cap: 'gfx', enc: hw, mode: 'direct' }, { cap: 'gfx', enc: hw, mode: 'down' });
    if (p.dda && hw) list.push({ cap: 'dda', enc: hw, mode: 'down' });
    if (p.gfx) list.push({ cap: 'gfx', enc: x, mode: 'down' });
    if (p.dda) list.push({ cap: 'dda', enc: x, mode: 'down' });
    return list;
  }
  videoChain(c, target, full) {
    const [W, H] = RES[this.conf.res] || RES[1080], F = this.conf.fps;
    if (c.cap === 'gfx') {
      const sel = target.kind === 'win' ? `window_exe=${exeRegex(target.exe)}` : `monitor_idx=${target.idx}`;
      let s = `gfxcapture='${sel}:max_framerate=${full ? 30 : F}:capture_cursor=${target.kind === 'win' ? 0 : 1}${full ? '' : `:width=${W}:height=${H}:resize_mode=scale_aspect`}'`;
      if (full) return s + ',hwdownload,format=bgra';
      if (c.mode === 'direct') { if (c.enc.id === 'qsv') s += ',hwmap=derive_device=qsv,format=qsv'; }
      else s += ',hwdownload,format=bgra,format=nv12';
      return s;
    }
    const idx = target.kind === 'mon' ? target.idx : 0;
    if (full) return `ddagrab=output_idx=${idx}:framerate=30,hwdownload,format=bgra`;
    return `ddagrab=output_idx=${idx}:framerate=${F},hwdownload,format=bgra,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=nv12`;
  }
  encArgs(enc) {
    const mb = (MBPS[this.conf.res] || 15) * (this.conf.fps >= 60 ? 1.6 : 1);
    const b = Math.round(mb) + 'M', mx = Math.round(mb * 1.5) + 'M', bs = Math.round(mb * 2) + 'M', g = String(this.conf.fps);
    if (enc.id === 'nvenc') return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-b:v', b, '-maxrate', mx, '-bufsize', bs, '-g', g, '-forced-idr', '1'];
    if (enc.id === 'amf') return ['-c:v', 'h264_amf', '-usage', 'transcoding', '-quality', 'speed', '-rc', 'vbr_peak', '-b:v', b, '-maxrate', mx, '-bufsize', bs, '-g', g];
    if (enc.id === 'qsv') return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-b:v', b, '-maxrate', mx, '-bufsize', bs, '-g', g];
    // sans carte graphique, la 4K est très lourde pour le processeur : réglage le plus rapide
    return ['-c:v', 'libx264', '-preset', this.conf.res >= 2160 ? 'ultrafast' : 'veryfast', '-b:v', b, '-maxrate', mx, '-bufsize', bs, '-g', g, '-pix_fmt', 'yuv420p'];
  }

  // ---------- réglages venus de l'interface ----------
  setConfig(c) {
    const n = Object.assign({}, this.conf, c || {});
    n.res = RES[+n.res] ? +n.res : 1080; n.fps = +n.fps === 30 ? 30 : 60; n.dur = Math.max(10, Math.min(600, +n.dur || 60)); n.monitor = +n.monitor || 0;
    n.games = Array.isArray(n.games) ? n.games.filter(g => g && g.exe).map(g => ({ name: String(g.name || g.exe), exe: String(g.exe) })) : [];
    this.conf = n;
    this.tick();
    return this.state();
  }

  // ---------- programmes en cours (jeu lancé, fenêtre au premier plan, écrans) ----------
  startScan() {
    if (process.platform !== 'win32' || this.scanProc) return;
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', this.o.scanScript], { windowsHide: true });
    this.scanProc = p;
    let buf = '';
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d) => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const s = JSON.parse(line);
          const arr = (v) => (v == null ? [] : (Array.isArray(v) ? v : [v]));
          this.scan = { fg: String(s.fg || ''), running: arr(s.running).map(String), screens: arr(s.screens) };
          this.tick();
        } catch (e) { /* ligne illisible */ }
      }
    });
    p.on('close', () => { this.scanProc = null; if (!this.closed) setTimeout(() => this.startScan(), 5000); });
    p.on('error', () => { this.scanProc = null; });
    clearInterval(this.scanTimer);
    const ask = () => { try { if (this.scanProc) this.scanProc.stdin.write(['scan'].concat(this.conf.games.map(g => g.exe)).join('|') + '\n'); } catch (e) { /* ignoré */ } };
    this.scanTimer = setInterval(ask, 4000);
    setTimeout(ask, 300);
  }
  runningGame() {
    const r = this.scan.running.map(x => x.toLowerCase());
    return this.conf.games.find(g => r.includes(g.exe.toLowerCase())) || null;
  }
  primaryIdx() { const p = this.scan.screens.find(s => s && s.primary); return p ? +p.i || 0 : 0; }
  target(game) {
    const c = this.conf;
    if (c.src === 'jeu' && game) return { kind: 'win', exe: game.exe, name: game.name };
    if (c.src === 'choisir') return { kind: 'mon', idx: c.monitor, name: 'Écran ' + (c.monitor + 1) };
    return { kind: 'mon', idx: this.primaryIdx(), name: 'Écran principal' };
  }
  gameName() {
    if (this.cur && this.cur.target.kind === 'win') return this.cur.target.name;
    const fg = this.scan.fg.toLowerCase();
    const g = this.conf.games.find(x => x.exe.toLowerCase().replace(/\.exe$/, '') === fg);
    return g ? g.name : 'Écran';
  }

  // ---------- la mémoire : démarrer, arrêter ----------
  tick() {
    if (this.closed) return;
    if (!this.available()) { this.pushState(); return; }
    const c = this.conf, game = this.runningGame();
    const want = !!(this.rec.on || (!c.paused && (c.when === 'toujours' || (c.when === 'jeu' && game))));
    const target = this.target(game);
    const key = JSON.stringify([target, c.res, c.fps]);
    if (!want) { if (this.proc) this.stop(); }
    else if (!this.proc && !this.starting && !this.stopping) { if (Date.now() >= this.retryAt) this.start(target, key); else { clearTimeout(this.retryT); this.retryT = setTimeout(() => this.tick(), this.retryAt - Date.now() + 50); } }
    else if (this.proc && key !== this.key && !this.rec.on && !this.stopping) { this.stop().then(() => this.tick()); }
    this.pushState();
  }
  async start(target, key) {
    this.starting = true; this.pushState();
    try {
      await this.probe();
      const list = this.cands();
      if (!list.length) { this.error = 'Ce PC ne permet pas de filmer l’écran (Windows 10 récent ou Windows 11 nécessaire).'; return; }
      if (this.cand >= list.length) { this.cand = list.length - 1; }
      const c = list[this.cand];
      const dir = this.o.temp;
      this.cleanTemp();
      fs.mkdirSync(dir, { recursive: true });
      this.segs = new Map(); this.listSeen = '';
      this.t0us = Date.now() * 1000;
      const t0s = (this.t0us / 1e6).toFixed(6);
      const id = `${process.pid}-${Date.now()}`;
      const pa = this.pipePath('pc', id), pb = this.pipePath('voix', id);
      await this.openPipe('a', pa.listen); await this.openPipe('b', pb.listen);
      const fc = `${this.videoChain(c, target)},setpts='(RTCTIME-${this.t0us})/(TB*1000000)'[v];` +
        // son : calé sur l'heure du premier paquet, puis compté échantillon par échantillon (régulier)
        `[0:a]asetpts='(STARTT-${t0s})/TB+NB_CONSUMED_SAMPLES/(SR*TB)',asplit=2[p1][p2];` +
        `[1:a]asetpts='(STARTT-${t0s})/TB+NB_CONSUMED_SAMPLES/(SR*TB)',asplit=2[m1][m2];` +
        '[p1][m1]amix=inputs=2:normalize=0:duration=longest[mix]';
      const audioIn = (p) => ['-thread_queue_size', '4096', '-use_wallclock_as_timestamps', '1', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', p.input];
      const args = ['-hide_banner', '-loglevel', 'warning', ...audioIn(pa), ...audioIn(pb), '-copyts', '-filter_complex', fc,
        '-map', '[v]', '-map', '[mix]', '-map', '[m2]', '-map', '[p2]', ...this.encArgs(c.enc), '-force_key_frames', 'expr:gte(t,n_forced*1)',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
        '-metadata:s:a:0', 'title=Tout', '-metadata:s:a:1', 'title=Ma voix', '-metadata:s:a:2', 'title=Son du PC',
        '-f', 'segment', '-segment_time', String(SEG), '-segment_format', 'mpegts',
        '-segment_list', path.join(dir, 'liste.csv'), '-segment_list_type', 'csv', '-segment_list_size', '900', '-segment_list_flags', '+live',
        path.join(dir, 's%06d.ts')];
      const p = spawn(this.o.ffmpeg, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
      this.proc = p; this.key = key; this.cur = { target, c }; this.startedAt = Date.now(); this.errLines = []; this.error = '';
      if (this.rec.on && this.rec.mark !== -1) this.rec.mark = -1;
      p.stderr.setEncoding('utf8');
      p.stderr.on('data', (d) => { String(d).split(/\r?\n/).forEach(l => { l = l.trim(); if (l) { this.errLines.push(l); if (this.errLines.length > 30) this.errLines.shift(); } }); });
      p.on('error', () => { /* géré par close */ });
      p.on('close', (code) => this.onExit(p, code));
      clearInterval(this.listT); this.listT = setInterval(() => this.readList(), 500);
      clearInterval(this.pumpT); this.pumpT = setInterval(() => this.pump(), 100);
    } catch (e) {
      this.error = 'Démarrage impossible : ' + e.message;
      this.retryAt = Date.now() + 10000;
    } finally { this.starting = false; this.pushState(); }
  }
  // tuyau nommé de Windows : le logiciel écoute, FFmpeg le lit comme un fichier
  pipePath(tag, id) { const n = `\\\\.\\pipe\\thedeck-${tag}-${id}`; return { listen: n, input: n }; }
  openPipe(k, name) {
    return new Promise((resolve) => {
      const srv = net.createServer((sock) => {
        this.pipes[k] = sock;
        sock.on('error', () => { /* FFmpeg arrêté */ });
        sock.on('close', () => { if (this.pipes[k] === sock) this.pipes[k] = null; });
      });
      srv.on('error', () => resolve(false));
      srv.listen(name, () => resolve(true));
      this.servers.push(srv);
    });
  }
  // son reçu de l'interface (float 32 bits, 48 kHz, stéréo)
  writeAudio(k, buf) {
    this.lastData[k] = Date.now();
    const s = this.pipes[k];
    if (s && !s.destroyed && s.writableLength < 4e6) { try { s.write(buf); } catch (e) { /* ignoré */ } }
  }
  // sans son de l'interface (au démarrage, micro absent…), on envoie du silence pour que l'image continue
  pump() {
    const now = Date.now();
    ['a', 'b'].forEach(k => {
      const s = this.pipes[k];
      if (s && !s.destroyed && now - this.lastData[k] > 500 && s.writableLength < 1e6) { try { s.write(Buffer.alloc(4800 * 2 * 4)); } catch (e) { /* ignoré */ } }
    });
  }
  closePipes() {
    ['a', 'b'].forEach(k => { if (this.pipes[k]) { try { this.pipes[k].destroy(); } catch (e) { /* ignoré */ } this.pipes[k] = null; } });
    this.servers.forEach(s => { try { s.close(); } catch (e) { /* ignoré */ } });
    this.servers = [];
  }
  stop() {
    if (!this.proc) return Promise.resolve();
    if (this.stopping) return this.stopping;
    const p = this.proc;
    this.stopping = new Promise((resolve) => {
      const done = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(() => { try { p.kill(); } catch (e) { /* ignoré */ } }, 4000);
      p.once('close', done);
      try { p.stdin.write('q\n'); } catch (e) { try { p.kill(); } catch (er) { /* ignoré */ } }
    }).then(() => { this.stopping = null; });
    this.pushState();
    return this.stopping;
  }
  onExit(p, code) {
    if (this.proc !== p) return;
    this.proc = null; this.key = '';
    clearInterval(this.listT); clearInterval(this.pumpT);
    this.readList();
    this.closePipes();
    const asked = !!this.stopping;
    const hadSegs = this.segs.size > 0;
    if (this.rec.on && hadSegs && !asked) this.recStop(true);
    if (!asked) {
      const last = (this.errLines || []).filter(l => !/^\s*(Last message repeated|frame=)/.test(l)).slice(-1)[0] || ('code ' + code);
      if (!hadSegs && Date.now() - this.startedAt < 20000) {
        this.fails++;
        if (this.fails >= 2 && this.probed && this.cand < this.cands().length - 1) { this.cand++; this.fails = 0; }
        else if (this.fails >= 2) this.error = 'L’enregistreur ne démarre pas : ' + last;
      } else this.fails = 0;
      this.retryAt = Date.now() + 2500;
      setTimeout(() => this.tick(), 2600);
    }
    if (!this.rec.on && !this.locks) { this.segs = new Map(); this.cleanTemp(); }
    this.pushState();
  }
  cleanTemp() {
    if (this.locks) return;
    try { fs.readdirSync(this.o.temp).forEach(f => { try { fs.unlinkSync(path.join(this.o.temp, f)); } catch (e) { /* ignoré */ } }); } catch (e) { /* pas de dossier */ }
  }
  // liste des morceaux écrits par FFmpeg (nom, début, fin)
  readList() {
    let txt = '';
    try { txt = fs.readFileSync(path.join(this.o.temp, 'liste.csv'), 'utf8'); } catch (e) { return; }
    if (txt === this.listSeen) return;
    this.listSeen = txt;
    txt.split(/\r?\n/).forEach(line => {
      const m = /^(s\d+\.ts),([\d.]+),([\d.]+)/.exec(line.trim());
      if (m && !this.segs.has(m[1])) this.segs.set(m[1], { name: m[1], file: path.join(this.o.temp, m[1]), start: +m[2], end: +m[3] });
    });
    this.fails = 0;
    const all = [...this.segs.values()];
    const lastEnd = all.length ? all[all.length - 1].end : 0;
    // on efface ce qui est trop vieux (sauf pendant un enregistrement ou un assemblage)
    if (!this.locks) {
      let keepAfter = lastEnd - (this.conf.dur + 3 * SEG);
      if (this.rec.on) keepAfter = this.rec.mark < 0 ? -Infinity : Math.min(keepAfter, this.rec.mark - SEG);
      all.forEach(s => { if (s.end < keepAfter) { try { fs.unlinkSync(s.file); } catch (e) { /* ignoré */ } this.segs.delete(s.name); } });
    }
    const w = this.waiters; this.waiters = [];
    w.forEach(fn => fn(lastEnd));
    this.pushState();
  }
  lastEnd() { const a = [...this.segs.values()]; return a.length ? a[a.length - 1].end : 0; }
  waitSegment(t, ms) {
    return new Promise((resolve) => {
      if (this.lastEnd() >= t) { resolve(); return; }
      const timer = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== fn); resolve(); }, ms);
      const fn = (end) => { if (end >= t) { clearTimeout(timer); resolve(); } else this.waiters.push(fn); };
      this.waiters.push(fn);
    });
  }

  // ---------- fichiers ----------
  newFile(game, ext, suffix) {
    const dir = this.folder();
    fs.mkdirSync(dir, { recursive: true });
    const base = `${safeName(game)} ${stamp(new Date())}${suffix || ''}`;
    let name = `${base}.${ext}`, k = 2;
    while (fs.existsSync(path.join(dir, name))) name = `${base} (${k++}).${ext}`;
    return path.join(dir, name);
  }
  async concat(list, ss, dur, out) {
    const lf = path.join(this.o.temp, `assemblage-${Date.now()}.txt`);
    fs.writeFileSync(lf, list.map(s => `file '${fwd(s.file)}'`).join('\n') + '\n');
    const args = ['-y', '-hide_banner', '-loglevel', 'error'];
    if (ss > 0.05) args.push('-ss', ss.toFixed(3));
    args.push('-f', 'concat', '-safe', '0', '-i', lf);
    if (dur) args.push('-t', dur.toFixed(3));
    args.push('-map', '0', '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero',
      '-metadata:s:a:0', 'handler_name=Tout', '-metadata:s:a:1', 'handler_name=Ma voix', '-metadata:s:a:2', 'handler_name=Son du PC', out);
    const r = await this.run(args, 600000);
    try { fs.unlinkSync(lf); } catch (e) { /* ignoré */ }
    if (r.code !== 0 || !fs.existsSync(out)) throw new Error('assemblage impossible (' + (r.out.trim().split(/\r?\n/).pop() || r.code) + ')');
  }
  async thumbFor(file) {
    const st = fs.statSync(file);
    const key = crypto.createHash('sha1').update(file + '|' + st.size + '|' + st.mtimeMs).digest('hex').slice(0, 20);
    const out = path.join(this.thumbsDir(), key + '.jpg');
    if (!fs.existsSync(out)) {
      fs.mkdirSync(this.thumbsDir(), { recursive: true });
      if (/\.png$/i.test(file)) {
        const img = this.o.nativeImage.createFromPath(file);
        if (img.isEmpty()) return '';
        fs.writeFileSync(out, img.resize({ width: 320 }).toJPEG(72));
      } else {
        const d = this.index[path.basename(file)];
        const at = d && d.dur ? Math.min(1, d.dur / 2) : 0.5;
        const r = await this.run(['-y', '-hide_banner', '-loglevel', 'error', '-ss', at.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '5', out], 30000);
        if (r.code !== 0 || !fs.existsSync(out)) return '';
      }
    }
    return 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64');
  }
  async durationOf(file) {
    const r = await this.run(['-hide_banner', '-i', file], 20000);
    const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(r.out);
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null;
  }
  remember(file, info) { this.index[path.basename(file)] = Object.assign({}, this.index[path.basename(file)] || {}, info); this.saveIndex(); }
  async saved(kind, file, game, dur) {
    this.remember(file, { kind, game, dur });
    let thumb = '';
    try { thumb = await this.thumbFor(file); } catch (e) { /* pas de miniature */ }
    const info = { kind, file, name: path.basename(file), game, dur, thumb, when: Date.now() };
    this.emit('saved', info);
    return Object.assign({ ok: true }, info);
  }

  // ---------- les trois actions ----------
  async clip() {
    if (!this.available()) return { ok: false, message: 'L’enregistreur n’est pas installé avec cette version.' };
    if (!this.proc || !this.segs.size) {
      const why = this.conf.paused ? 'La mémoire est à l’arrêt : rallumez-la pour faire des clips.'
        : (this.conf.when === 'jamais' ? 'La mémoire est réglée sur « Jamais » : seule la case ENREGISTRER filme.'
          : (this.conf.when === 'jeu' && !this.runningGame() ? 'La mémoire attend qu’un jeu de « Mes espaces » soit lancé.' : 'La mémoire démarre : réessayez dans quelques secondes.'));
      return { ok: false, message: why };
    }
    const pressed = this.nowRel();
    const game = this.gameName();
    this.locks++;
    try {
      await this.waitSegment(pressed, (SEG + 3) * 1000);
      const all = [...this.segs.values()];
      const end = all[all.length - 1].end;
      const from = end - this.conf.dur;
      const picked = all.filter(s => s.end > from);
      if (!picked.length) return { ok: false, message: 'La mémoire est encore vide.' };
      const ss = Math.max(0, from - picked[0].start);
      const out = this.newFile(game, 'mp4', '');
      await this.concat(picked, ss, null, out);
      return await this.saved('clip', out, game, Math.round(Math.min(this.conf.dur, end - picked[0].start)));
    } catch (e) { return { ok: false, message: 'Clip non enregistré : ' + e.message }; }
    finally { this.locks--; }
  }
  recStart() {
    if (!this.available()) return { ok: false, message: 'L’enregistreur n’est pas installé avec cette version.' };
    this.rec = { on: true, since: Date.now(), mark: this.proc && this.segs.size ? this.nowRel() : -1, game: this.gameName() };
    this.tick();
    return { ok: true, rec: true };
  }
  async recStop(crashed) {
    if (!this.rec.on) return { ok: false, message: 'Aucun enregistrement en cours.' };
    const pressed = this.nowRel(), mark = this.rec.mark, game = this.rec.game || this.gameName();
    this.locks++;
    try {
      if (!crashed && this.proc) await this.waitSegment(pressed, (SEG + 3) * 1000);
      const all = [...this.segs.values()];
      const picked = mark < 0 ? all : all.filter(s => s.end > mark);
      this.rec = { on: false, since: 0, mark: -1 };
      if (!picked.length) return { ok: false, message: 'Rien n’a été filmé.' };
      const ss = mark < 0 ? 0 : Math.max(0, mark - picked[0].start);
      const out = this.newFile(game, 'mp4', ' (vidéo)');
      await this.concat(picked, ss, null, out);
      return await this.saved('video', out, game, Math.round(picked[picked.length - 1].end - picked[0].start - ss));
    } catch (e) { this.rec = { on: false, since: 0, mark: -1 }; return { ok: false, message: 'Vidéo non enregistrée : ' + e.message }; }
    finally { this.locks--; this.tick(); }
  }
  async shot() {
    if (!this.available()) return { ok: false, message: 'L’enregistreur n’est pas installé avec cette version.' };
    await this.probe();
    const game = this.gameName();
    const target = this.cur ? this.cur.target : this.target(this.runningGame());
    const out = this.newFile(game, 'png', '');
    const tries = [];
    if (this.probed.gfx) tries.push({ cap: 'gfx' });
    if (this.probed.dda) tries.push({ cap: 'dda' });
    for (const c of tries) {
      const r = await this.run(['-y', '-hide_banner', '-loglevel', 'error', '-filter_complex', this.videoChain(c, target, true), '-frames:v', '1', out], 20000);
      if (r.code === 0 && fs.existsSync(out)) return this.saved('capture', out, game, null);
    }
    return { ok: false, message: 'Capture impossible.' };
  }

  // ---------- « Mes clips » ----------
  async list() {
    const dir = this.folder();
    let names = [];
    try { names = fs.readdirSync(dir).filter(f => VIDEO_EXT.test(f)); } catch (e) { /* pas encore de dossier */ }
    let items = names.map(n => { try { const st = fs.statSync(path.join(dir, n)); return { n, st }; } catch (e) { return null; } }).filter(Boolean);
    items.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
    const total = items.reduce((s, x) => s + x.st.size, 0);
    items = items.slice(0, 120);
    const out = [];
    let changed = false;
    for (const { n, st } of items) {
      const file = path.join(dir, n);
      const d = this.index[n] || {};
      const kind = /\.png$/i.test(n) ? 'capture' : (d.kind || (/ \(vidéo\)/i.test(n) ? 'video' : 'clip'));
      let dur = d.dur;
      if (kind !== 'capture' && (dur == null || d.size !== st.size)) { dur = await this.durationOf(file); this.index[n] = Object.assign({}, d, { dur: dur == null ? null : Math.round(dur), size: st.size }); changed = true; }
      const m = /^(.*?) (\d{4})-(\d{2})-(\d{2}) (\d{2})h(\d{2})/.exec(n);
      const game = d.game || (m ? m[1] : n.replace(VIDEO_EXT, ''));
      let thumb = '';
      try { thumb = await this.thumbFor(file); } catch (e) { /* ignoré */ }
      out.push({ file, name: n, kind, game, dur: dur == null ? null : Math.round(dur), size: st.size, when: st.mtimeMs, thumb });
    }
    if (changed) this.saveIndex();
    let free = null;
    try { fs.mkdirSync(dir, { recursive: true }); const s = fs.statfsSync(dir); free = s.bavail * s.bsize; } catch (e) { /* inconnu */ }
    return { folder: dir, items: out, total, free, count: names.length };
  }
  async trim(file, a, b) {
    const f = this.inside(file); if (!f || !/\.mp4$/i.test(f)) return { ok: false, message: 'Fichier introuvable.' };
    const base = path.basename(f).replace(/\.mp4$/i, '').replace(/ \(coupé\)$/, '');
    const dir = path.dirname(f);
    let out = path.join(dir, base + ' (coupé).mp4'), k = 2;
    while (fs.existsSync(out)) out = path.join(dir, `${base} (coupé ${k++}).mp4`);
    const len = Math.max(0.5, b - a);
    const r = await this.run(['-y', '-hide_banner', '-loglevel', 'error', '-ss', Math.max(0, a).toFixed(3), '-i', f, '-t', len.toFixed(3), '-map', '0', '-c', 'copy', '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero', out], 600000);
    if (r.code !== 0 || !fs.existsSync(out)) return { ok: false, message: 'Découpe impossible.' };
    const d = this.index[path.basename(f)] || {};
    this.remember(out, { kind: d.kind || 'clip', game: d.game, dur: Math.round(len) });
    return { ok: true, file: out, name: path.basename(out) };
  }
  rename(file, newName) {
    const f = this.inside(file); if (!f) return { ok: false, message: 'Fichier introuvable.' };
    const ext = path.extname(f);
    const base = safeName(String(newName || '').replace(VIDEO_EXT, ''));
    let out = path.join(path.dirname(f), base + ext), k = 2;
    if (out.toLowerCase() === f.toLowerCase()) return { ok: true, file: f };
    while (fs.existsSync(out)) out = path.join(path.dirname(f), `${base} (${k++})${ext}`);
    try { fs.renameSync(f, out); } catch (e) { return { ok: false, message: 'Renommage impossible : le fichier est peut-être ouvert.' }; }
    const old = this.index[path.basename(f)];
    if (old) { delete this.index[path.basename(f)]; this.index[path.basename(out)] = old; this.saveIndex(); }
    return { ok: true, file: out, name: path.basename(out) };
  }
  async remove(file) {
    const f = this.inside(file); if (!f) return { ok: false, message: 'Fichier introuvable.' };
    try { await this.o.shell.trashItem(f); } catch (e) { return { ok: false, message: 'Suppression impossible : le fichier est peut-être ouvert.' }; }
    delete this.index[path.basename(f)]; this.saveIndex();
    return { ok: true };
  }
  copy(file) {
    const f = this.inside(file); if (!f) return Promise.resolve({ ok: false, message: 'Fichier introuvable.' });
    return new Promise((resolve) => {
      const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', 'Set-Clipboard -LiteralPath $env:DECK_FILE'], { windowsHide: true, env: Object.assign({}, process.env, { DECK_FILE: f }) });
      p.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, message: 'Copie impossible.' }));
      p.on('error', () => resolve({ ok: false, message: 'PowerShell introuvable.' }));
    });
  }

  // ---------- état envoyé à l'interface ----------
  state() {
    const all = [...this.segs.values()];
    const buf = all.length ? Math.min(this.conf.dur, all[all.length - 1].end - all[0].start) : 0;
    const game = this.runningGame();
    return {
      available: this.available(),
      capturing: !!this.proc,
      running: !!this.proc && all.length > 0,
      starting: this.starting || (!!this.proc && !all.length),
      waiting: !this.proc && !this.conf.paused && this.conf.when === 'jeu' && !game && !this.rec.on,
      paused: !!this.conf.paused,
      when: this.conf.when,
      rec: { on: this.rec.on, since: this.rec.since },
      enc: this.probed ? { label: this.probed.enc.label, gpu: this.probed.enc.id !== 'x264' } : null,
      target: this.cur && this.proc ? this.cur.target.name : '',
      game: game ? game.name : '',
      buffer: Math.round(buf),
      folder: this.folder(),
      screens: this.scan.screens,
      error: this.error
    };
  }
  pushState() {
    clearTimeout(this.pushT);
    this.pushT = setTimeout(() => this.emit('state', this.state()), 60);
  }
  init() { this.cleanTemp(); this.startScan(); this.tick(); }
  async shutdown() {
    this.closed = true;
    clearInterval(this.scanTimer);
    if (this.scanProc) { try { this.scanProc.kill(); } catch (e) { /* ignoré */ } }
    if (this.proc) { try { this.proc.stdin.write('q\n'); } catch (e) { /* ignoré */ } const p = this.proc; setTimeout(() => { try { p.kill(); } catch (e) { /* ignoré */ } }, 1500); }
    this.closePipes();
  }
}

module.exports = { ClipRecorder };
