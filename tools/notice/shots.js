const { chromium } = require('playwright');
const STUB = `
(() => {
  let store = null;
  window.deck = {
    loadConfig: async () => store, saveConfig: async (c) => { store = JSON.parse(JSON.stringify(c)); return true; },
    createBackup: async () => 'sauvegarde_2026-10-26_21h40m12s.json',
    listBackups: async () => ['sauvegarde_2026-10-26_21h40m12s.json', 'sauvegarde_2026-10-26_18h02m51s.json', 'sauvegarde_2026-10-25_22h15m07s.json'],
    readBackup: async () => null, openBackupsFolder: async () => null,
    exportSpace: async () => null, importSpace: async () => null, chooseExe: async () => null,
    runApp: async () => ({ ok: true, message: 'Fenêtre ouverte et placée.' }),
    version: async () => '1.0.1', env: async () => ({}), setStartWithWindows: async (on) => on,
    setShortcuts: async () => ({}), onShortcut: () => {},
    discordConnect: async () => ({ status: 'off' }), discordDisconnect: async () => ({ status: 'off' }), discordState: async () => ({ status: 'off' }),
    discordRun: async () => ({ ok: true, message: '' }), onDiscordState: () => {},
    mediaWatch: async () => true, mediaKey: async () => true, onMediaState: () => {}
  };
})();`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1320, height: 860 }, deviceScaleFactor: 2 });
  await p.addInitScript(STUB);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(require('path').resolve(__dirname, '../../src/index.html')).href); await p.waitForTimeout(500);
  const shot = async (n, opt) => { await p.waitForTimeout(250); await p.screenshot(Object.assign({ path: require('path').join(__dirname, 'img', n + '.png') }, opt || {})); };
  const nav = async (v) => { await p.click(`button.nav[data-view="${v}"]`); await p.waitForTimeout(200); };
  // faux états Discord / lecteur
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 300; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 300, 300); g.addColorStop(0, '#E0533D'); g.addColorStop(1, '#3B2A8F'); x.fillStyle = g; x.fillRect(0, 0, 300, 300);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(150, 150, 70, 0, 7); x.fill(); x.fillStyle = '#222'; x.beginPath(); x.arc(150, 150, 14, 0, 7); x.fill();
    mstate = { title: 'Titre du morceau', artist: 'Nom de l’artiste', album: 'Nom de l’album', status: 'Playing', cover: c.toDataURL('image/jpeg', .9), app: 'Spotify.exe', none: false, unavailable: false };
  });
  await shot('espaces', { fullPage: false });
  // éditeur Star Citizen, case sélectionnée
  const sc = await p.evaluate(() => cfg.spaces[0].id);
  await p.click(`[data-act="open-space"][data-id="${sc}"]`); await p.waitForTimeout(200);
  await p.click('[data-act="cell"][data-i="1"]'); await shot('editeur');
  await p.click('[data-act="picto-open"]'); await shot('picto'); await p.keyboard.press('Escape');
  // case « ouvrir une appli » (Bureau)
  await nav('espaces');
  const bu = await p.evaluate(() => cfg.spaces.find(s => s.category === 'bureau').id);
  await p.click(`[data-act="open-space"][data-id="${bu}"]`); await p.waitForTimeout(200);
  await p.setViewportSize({ width: 1320, height: 1180 }); await p.click('[data-act="cell"][data-i="8"]'); await shot('appli'); await p.setViewportSize({ width: 1320, height: 860 });
  // nouvel espace / nouvelle catégorie
  await nav('espaces');
  await p.click('[data-act="new-space"][data-cat="jeu"]'); await shot('nouvel-espace'); await p.keyboard.press('Escape');
  await p.click('[data-act="cat-new"]'); await p.fill('#f-catname', 'Simulation'); await p.dispatchEvent('#f-catname', 'input'); await p.click('[data-act="cat-color"][data-v="#3FB97A"]'); await shot('categorie'); await p.keyboard.press('Escape');
  // accueil, apparence, connexions
  await nav('accueil'); await shot('accueil');
  await nav('apparence'); await shot('apparence');
  await p.setViewportSize({ width: 1320, height: 960 }); await nav('connexions'); await shot('connexions'); await p.setViewportSize({ width: 1320, height: 860 });
  // Discord (connecté pour l'exemple)
  await p.evaluate(() => { setD({ status: 'on', mute: false, deaf: false, outVolume: 100, inputId: 'a', outputId: 'y', inputs: [{ id: 'default', name: 'Par défaut (Windows)' }, { id: 'a', name: 'Micro USB' }], outputs: [{ id: 'default', name: 'Par défaut (Windows)' }, { id: 'y', name: 'Casque' }] }); cfg.discord.shortcuts = [{ id: 'x1', name: 'Appuyer pour parler', keys: 'Ctrl+Alt+Shift+P' }]; });
  await nav('espaces');
  const dc = await p.evaluate(() => cfg.spaces.find(s => s.category === 'discord').id);
  await p.click(`[data-act="open-space"][data-id="${dc}"]`); await p.setViewportSize({ width: 1320, height: 1320 }); await p.waitForTimeout(200); await shot('discord'); await p.setViewportSize({ width: 1320, height: 860 });
  await p.evaluate(() => setD({ status: 'off' }));
  // Spotify
  await nav('espaces');
  const sp = await p.evaluate(() => cfg.spaces.find(s => s.layout === 'player').id);
  await p.click(`[data-act="open-space"][data-id="${sp}"]`); await p.waitForTimeout(200); await shot('spotify');
  // simulateur : accueil puis Star Citizen
  await nav('espaces');
  await p.click('.head [data-act="simulate"]'); await shot('sim-accueil');
  await p.click('#sim [data-sim="space"]'); await p.waitForTimeout(200); await shot('sim-espace'); await p.keyboard.press('Escape');
  await nav('appareil'); await shot('appareil');
  await p.evaluate(async () => { ui.backups = await api.listBackups(); }); await nav('parametres'); await p.evaluate(async () => { ui.backups = await api.listBackups(); render(); }); await shot('parametres');
  console.log('ERR', errs); await b.close();
})();
