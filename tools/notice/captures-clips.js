const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'img') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const STUB = `
(() => {
  let store = null; const L = [];
  const thumb = (c1, c2) => { const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'); const g = x.createLinearGradient(0,0,320,180); g.addColorStop(0,c1); g.addColorStop(1,c2); x.fillStyle=g; x.fillRect(0,0,320,180); return c.toDataURL('image/jpeg'); };
  const now = Date.now();
  window.deck = {
    loadConfig: async () => store, saveConfig: async (c) => { store = JSON.parse(JSON.stringify(c)); return true; },
    createBackup: async () => 'x', listBackups: async () => [], readBackup: async () => null, openBackupsFolder: async () => null,
    exportSpace: async () => null, importSpace: async () => null, chooseExe: async () => null,
    runApp: async () => ({ ok: true, message: '' }), version: async () => '1.1.1', env: async () => ({}), setStartWithWindows: async (on) => on,
    setShortcuts: async () => ({}), onShortcut: () => {},
    discordConnect: async () => ({ status: 'off' }), discordDisconnect: async () => ({ status: 'off' }), discordState: async () => ({ status: 'off' }),
    discordRun: async () => ({ ok: true, message: '' }), onDiscordState: () => {},
    mediaWatch: async () => true, mediaKey: async () => true, onMediaState: () => {},
    clipsConfig: async (c) => ({ available: true, capturing: true, running: true, starting: false, waiting: false, paused: !!c.paused, when: c.when, rec: { on: false, since: 0 }, enc: { label: 'NVIDIA', gpu: true }, target: 'Star Citizen', game: 'Star Citizen', buffer: 60, folder: 'C:\\\\Users\\\\Clément\\\\Videos\\\\The Deck\\\\Clips', screens: [{ i: 0, primary: true, w: 2560, h: 1440 }, { i: 1, primary: false, w: 1920, h: 1080 }], error: '' }),
    clipsState: async () => ({ available: true }),
    clipsAction: async (op) => { if (op === 'clip') { setTimeout(() => L.forEach(f => f({ kind: 'clip', file: 'C:/x/n.mp4', name: 'Star Citizen 2026-10-27 19h12.mp4', game: 'Star Citizen', dur: 60, thumb: thumb('#5a2','#e83'), when: Date.now() })), 300); return { ok: true }; } return { ok: true, rec: true }; },
    clipsAudio: (k, d) => { window.__aud = (window.__aud||0) + 1; window.__len = d.length; }, clipsScreenSource: async () => '',
    clipsList: async () => ({ folder: 'x', total: 4.2e9, free: 312e9, count: 9, items: [
      ['clip','Star Citizen',0.02,60,190e6,'#3B2A8F','#E0533D'],['clip','Star Citizen',0.04,30,95e6,'#0E4D64','#7CC4FF'],['capture','Star Citizen',0.045,null,3e6,'#3A2A10','#FFB547'],
      ['video','Star Citizen',0.08,1452,2.6e9,'#1B3A2A','#3FB97A'],['clip','Écran',1.1,120,380e6,'#2A1530','#FF7EB6'],['clip','Star Citizen',1.2,60,190e6,'#15202B','#8E9BFF']
    ].map((r, i) => ({ file: 'C:/x/' + i + '.mp4', name: r[1] + ' 2026-10-2' + (7 - Math.floor(r[2])) + ' 18h' + (10 + i) + (r[0]==='video'?' (vidéo)':'') + (r[0]==='capture'?'.png':'.mp4'), kind: r[0], game: r[1], dur: r[3], size: r[4], when: now - r[2] * 86400000, thumb: thumb(r[5], r[6]) })) }),
    clipsOpenFolder: async () => null, clipsShow: async () => null, clipsCopy: async () => ({ ok: true }), clipsDelete: async () => ({ ok: true }), clipsRename: async () => ({ ok: true }), clipsTrim: async () => ({ ok: true }), clipsFileUrl: async () => '', clipsChooseFolder: async () => null,
    onClipsState: () => {}, onClipsSaved: (f) => L.push(f)
  };
})();`;
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const p = await b.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 2 });
  await p.addInitScript(STUB);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').resolve(__dirname, '../../src/index.html')).href); await p.waitForTimeout(900);
  await p.click('button.nav[data-view="clips"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { SOUND.state.inputs = [{ id: 'x', label: 'Microphone (SteelSeries Sonar - Microphone)' }, { id: 'y', label: 'SteelSeries Sonar - Stream' }]; SOUND.state.ready = true; cfg.audio.micIn = 'x'; render(); });
  await p.setViewportSize({ width: 1320, height: 1170 }); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'clips-reglages.png' });
  await p.setViewportSize({ width: 1320, height: 900 });
    await p.click('[data-act="clips-tab"][data-v="biblio"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'clips-biblio.png', fullPage: true });
  // espace Clips + aperçu
  const id = await p.evaluate(() => cfg.spaces.find(s => s.layout === 'clips').id);
  await p.evaluate((id) => openSim(id), id); await p.waitForTimeout(500);
  await (await p.$('#sim .deck')).screenshot({ path: OUT + 'clips-ecran.png' });
  await p.dispatchEvent('#sim [data-simclip="clip"]', 'pointerdown'); await p.waitForTimeout(150);
  await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup')));
  await p.waitForTimeout(700);
  await (await p.$('#sim .deck')).screenshot({ path: OUT + 'clips-ecran-toast.png' });
  await p.dispatchEvent('#sim [data-simclip="dur"]', 'pointerdown'); await p.waitForTimeout(200);
  console.log('dur after', await p.evaluate(() => cfg.clips.dur));
  // case clip dans Star Citizen
  await p.evaluate(() => { ui.modal = null; const s = cfg.spaces.find(s => s.name === 'Star Citizen'); s.pages[0].cells[14] = cell('Clip', 'retour', { type: 'clip', op: 'clip' }, { mode: 'tap', holdMs: 1500 }, '#FF6B79'); ui.spaceId = s.id; ui.page = 0; ui.cell = 14; ui.view = 'editeur'; commit(); });
  await p.setViewportSize({ width: 1320, height: 1080 }); await p.waitForTimeout(200);
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + 'clips-case.png' });
  console.log('audio msgs', await p.evaluate(() => [window.__aud, window.__len, CLIPAUDIO.state.error]));
  console.log('ERR', errs);
  await b.close();
})();
