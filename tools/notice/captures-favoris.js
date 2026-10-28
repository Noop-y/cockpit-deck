// Captures du chapitre « Favoris et déplacement des cases » (version 1.1.1)
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'img') + '/';
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
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1320, height: 1000 }, deviceScaleFactor: 2 });
  await p.addInitScript(STUB);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(require('path').resolve(__dirname, '../../src/index.html')).href); await p.waitForTimeout(900);
  // quelques favoris : une case Star Citizen, Discord, un clip et un son
  await p.evaluate(() => {
    const add = (s, pi, ci) => { ui.spaceId = s.id; ui.page = pi; ui.cell = ci; ui.view = 'editeur'; toggleFav(); };
    const by = (k) => cfg.spaces.find(k);
    const sc = by(s => s.name === 'Star Citizen'), dc = by(s => s.category === 'discord'), sb = by(s => s.layout === 'soundboard');
    [0, 3, 6].forEach(i => add(sc, 0, i));
    add(sc, 1, 0);
    const di = dc.pages[0].cells.findIndex(Boolean); if (di >= 0) add(dc, 0, di);
    sc.pages[2].cells[14] = cell('Clip', 'retour', { type: 'clip', op: 'clip' }, { mode: 'tap', holdMs: 1500 }, '#FF6B79'); add(sc, 2, 14);
    sb.pages[0].cells[0] = newSoundCell('Airhorn', 'C:/Sons/airhorn.mp3'); sb.pages[0].cells[0].action.dur = 2.4; add(sb, 0, 0);
    // la case sélectionnée pour la capture du bouton
    ui.spaceId = sc.id; ui.page = 0; ui.cell = 0; ui.view = 'editeur'; commit();
  });
  await p.addStyleTag({ content: '.toast, .toasts, #toasts { display: none !important; }' });
  await p.waitForTimeout(400);
  await p.setViewportSize({ width: 1320, height: 1700 }); await p.waitForTimeout(200);
  const pb = await (await p.$('.panel:has([data-act="cell-fav"])')).boundingBox();
  const rb = await (await p.$('.panel [data-act="cell-fav"]')).boundingBox();
  const lb = await (await p.$('#f-type')).boundingBox();
  await p.screenshot({ path: OUT + 'fav-bouton.png', clip: { x: pb.x, y: lb.y - 40, width: pb.width, height: rb.y + rb.height + 24 - (lb.y - 40) } });
  await p.setViewportSize({ width: 1320, height: 1000 });
  // l'espace Favoris
  await p.evaluate(() => { ui.spaceId = favSpace().id; ui.page = 0; ui.cell = null; ui.view = 'editeur'; window.scrollTo(0, 0); render(); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + 'favoris.png', clip: { x: 232, y: 0, width: 1088, height: 560 } });
  // déplacer une case : en plein glissement
  await p.evaluate(() => { document.querySelector('.tabs').scrollIntoView(); });
  const a = await (await p.$('.grid .ecell[data-drag="1"]')).boundingBox(), c = await (await p.$('.grid .ecell[data-drag="7"]')).boundingBox();
  await p.mouse.move(a.x + 40, a.y + 40); await p.mouse.down(); await p.waitForTimeout(450);
  await p.mouse.move(c.x + 50, c.y + 30, { steps: 12 }); await p.waitForTimeout(150);
  const g = await (await p.$('.gridwrap')).boundingBox();
  await p.screenshot({ path: OUT + 'deplacer.png', clip: { x: g.x - 10, y: g.y - 10, width: g.width + 20, height: g.height - 30 } });
  await p.mouse.up();
  console.log('ERR', errs);
  await b.close();
})();
