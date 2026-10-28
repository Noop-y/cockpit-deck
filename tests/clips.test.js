// Test de l'enregistreur de clips (clips.js), sans Windows : une image de test remplace l'écran,
// un « la » remplace le son du PC. Vérifie mémoire → clip → vidéo longue → liste → découpe.
// Lancer : node --test        (FFmpeg doit être installé ; sinon le test est sauté)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ClipRecorder } = require('../clips');

let ffmpeg = process.env.FFMPEG || 'ffmpeg';
try { execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' }); } catch (e) { ffmpeg = null; }

test('enregistreur de clips : mémoire, clip, vidéo, liste, découpe', { skip: !ffmpeg && 'FFmpeg absent', timeout: 90000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-'));
  const sockDir = process.platform === 'win32' ? null : fs.mkdtempSync('/tmp/cd-');
  class T extends ClipRecorder {
    available() { return true; }
    async probe() { this.probed = { gfx: false, dda: false, enc: { id: 'x264', codec: 'libx264', label: '' } }; return this.probed; }
    cands() { return [{ cap: 'test', enc: this.probed.enc, mode: 'down' }]; }
    videoChain() { return 'testsrc2=size=1280x720:rate=30,realtime,format=nv12'; }
    pipePath(tag, id) {
      if (!sockDir) return super.pipePath(tag, id);
      const p = path.join(sockDir, tag + '.sock'); return { listen: p, input: 'unix:' + p };
    }
    startScan() {}
  }
  const r = new T({ ffmpeg, temp: path.join(dir, 'tmp'), data: path.join(dir, 'data'), videos: path.join(dir, 'videos'), scanScript: '', shell: { trashItem: async (f) => fs.unlinkSync(f) }, nativeImage: null });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  let ph = 0;
  const feed = setInterval(() => {
    const f = new Float32Array(2400 * 2);
    for (let i = 0; i < 2400; i++) { const v = 0.2 * Math.sin(ph); ph += 2 * Math.PI * 440 / 48000; f[2 * i] = v; f[2 * i + 1] = v; }
    r.writeAudio('a', Buffer.from(f.buffer));
  }, 50);
  const sleep = (ms) => new Promise(x => setTimeout(x, ms));
  try {
    r.setConfig({ when: 'toujours', dur: 10, res: 720, fps: 30 });
    await sleep(9000);
    assert.ok(r.segs.size > 0, 'la mémoire doit contenir des morceaux');
    const c = await r.clip();
    assert.ok(c.ok, 'clip : ' + c.message);
    assert.ok(fs.statSync(c.file).size > 100000, 'le clip doit être un vrai fichier');
    assert.ok(r.recStart().ok);
    await sleep(4000);
    const v = await r.recStop();
    assert.ok(v.ok, 'vidéo : ' + v.message);
    const l = await r.list();
    assert.strictEqual(l.items.length, 2);
    assert.deepStrictEqual(l.items.map(x => x.kind).sort(), ['clip', 'video']);
    const t = await r.trim(c.file, 1, 4);
    assert.ok(t.ok, 'découpe');
    r.setConfig({ when: 'jamais' });
    await sleep(2500);
    assert.strictEqual(r.proc, null, 'la mémoire doit s’arrêter');
  } finally {
    clearInterval(feed);
    await r.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
    if (sockDir) fs.rmSync(sockDir, { recursive: true, force: true });
  }
});

test('qualité 4K : taille d’image et débit', () => {
  const r = new ClipRecorder({ ffmpeg: null, temp: os.tmpdir(), data: os.tmpdir(), videos: os.tmpdir(), scanScript: '', shell: {}, nativeImage: null });
  r.setConfig({ res: 2160, fps: 60 });
  assert.strictEqual(r.conf.res, 2160);
  const nv = r.encArgs({ id: 'nvenc' });
  assert.strictEqual(nv[nv.indexOf('-b:v') + 1], '72M');                 // 45 Mbit/s × 1,6 à 60 images/s
  assert.ok(r.videoChain({ cap: 'dda', enc: { id: 'nvenc' }, mode: 'down' }, { kind: 'mon', idx: 0 }).includes('scale=3840:2160'));
  assert.strictEqual(r.encArgs({ id: 'x264' })[3], 'ultrafast');         // sans carte graphique : le plus rapide
  r.setConfig({ res: 999 });
  assert.strictEqual(r.conf.res, 1080);                                   // valeur inconnue : retour à 1080p
});
