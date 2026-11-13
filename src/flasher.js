// The Deck — installer le programme de l'écran (ESP32-P4) depuis le logiciel, sans page internet.
// Le programme est rangé dans le logiciel (src/firmware/, ajouté par GitHub à la fabrication, lu par main.js) ; l'outil
// d'installation est esptool-js (src/vendor/esptool.js). L'écran se branche sur sa prise « USB TO UART ».
'use strict';

ui.fw = { state: 'idle', pct: 0, msg: '', info: null };   // idle | port | connect | write | done | err

// Prises série des cartes : pont USB-série de la prise « USB TO UART » (WCH CH34x, Silicon Labs, FTDI), puis Espressif
const FW_VIDS = [0x1A86, 0x10C4, 0x0403, 0x303A];

async function fwInfo() {
  if (ui.fw.info !== null) return ui.fw.info;
  try { ui.fw.info = (await api.fwInfo()) || false; } catch (e) { ui.fw.info = false; }
  return ui.fw.info;
}

function fwLoadTool() {
  if (window.esptooljs) return Promise.resolve(window.esptooljs);
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'vendor/esptool.js';
    s.onload = () => (window.esptooljs ? ok(window.esptooljs) : ko(new Error('outil absent')));
    s.onerror = () => ko(new Error('outil absent'));
    document.head.appendChild(s);
  });
}

function fwSet(state, msg, pct) {
  ui.fw.state = state;
  if (msg !== undefined) ui.fw.msg = msg;
  if (pct !== undefined) ui.fw.pct = pct;
  if (ui.view === 'appareil') render();
}

// choisit le bon fichier selon la version de la puce : v3 (cartes récentes) ou v1.x (premières cartes)
const fwFileFor = (info, chipRev) => (chipRev >= 300 ? info.files.rev3 : info.files.rev1);

async function fwInstall() {
  if (['port', 'connect', 'write'].includes(ui.fw.state)) return;
  const info = await fwInfo();
  if (!info) { toast('Le programme de l’écran n’est fourni qu’avec la version fabriquée par GitHub.', 'err', 6000); return; }
  let port = null, transport = null;
  try {
    fwSet('port', 'Choix de la prise USB…', 0);
    try {
      port = await navigator.serial.requestPort({ filters: FW_VIDS.map(v => ({ usbVendorId: v })) });
    } catch (e) {
      fwSet('err', 'Écran introuvable. Branchez-le sur sa prise « USB TO UART » (en bas du côté gauche), puis réessayez.');
      return;
    }
    if (deckLink.port === port) await deckClose();
    const T = await fwLoadTool();
    fwSet('connect', 'Connexion à l’écran…');
    transport = new T.Transport(port, false);
    const term = { clean() {}, writeLine(l) { console.log('[écran]', l); }, write(t) { /* rien */ } };
    const loader = new T.ESPLoader({ transport, baudrate: 921600, romBaudrate: 115200, terminal: term });
    const chip = await loader.main();
    if (!/P4/i.test(chip)) throw new Error('Cette carte n’est pas un écran The Deck (' + chip + ').');
    const rev = await loader.chip.getChipRevision(loader);
    const f = fwFileFor(info, rev);
    const bin = await api.fwRead(f.file);
    if (!bin) throw new Error('fichier du programme absent');
    const data = new Uint8Array(bin);
    fwSet('write', 'Installation…', 0);
    await loader.writeFlash({
      fileArray: [{ data, address: 0 }],
      flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep',
      eraseAll: false, compress: true,
      reportProgress: (i, written, total) => {
        const p = Math.floor(written / total * 100);
        if (p !== ui.fw.pct) fwSet('write', 'Installation…', p);
      }
    });
    await loader.after('hard_reset');
    fwSet('done', `Programme version ${info.version} installé (puce v${Math.floor(rev / 100)}.${rev % 100}). L’écran redémarre.`, 100);
  } catch (e) {
    console.error(e);
    fwSet('err', 'L’installation n’a pas abouti : ' + (e && e.message ? e.message : e) + '. Débranchez et rebranchez l’écran, puis réessayez.');
  } finally {
    if (transport) { try { await transport.disconnect(); } catch (e) { /* déjà fermé */ } }
  }
}

function flasherPanel() {
  const f = ui.fw, info = f.info;
  if (info === null) fwInfo().then(() => { if (ui.view === 'appareil') render(); });
  const busy = ['port', 'connect', 'write'].includes(f.state);
  const bar = f.state === 'write' || f.state === 'done'
    ? `<div style="height:10px;border-radius:5px;background:#1A222B;overflow:hidden"><div style="height:100%;width:${f.pct}%;background:var(--amber)"></div></div><div class="small mono">${f.pct} %</div>` : '';
  const msg = f.msg ? `<div class="${f.state === 'err' ? 'warn' : f.state === 'done' ? 'note' : 'small muted'}">${esc(f.msg)}</div>` : '';
  return `<div class="panel" style="flex:1 1 360px;min-width:0"><h2 class="disp">Programme de l’écran</h2>
    <div style="line-height:1.6">${info ? `Version fournie avec ce logiciel : <b class="mono">${esc(info.version)}</b>` : info === false ? 'Pas de programme de l’écran dans cette version du logiciel (seulement dans celle fabriquée par GitHub).' : '…'}</div>
    <div class="small muted">1. Branchez l’écran sur sa prise <b>« USB TO UART »</b> (en bas du côté gauche).<br>2. Cliquez sur « Installer ». Ne débranchez pas pendant l’installation (environ 1 minute).</div>
    ${bar}${msg}
    <div class="row"><button class="btn pri" data-act="fw-install" ${busy || !info ? 'disabled' : ''}>${busy ? 'Installation en cours…' : 'Installer le programme de l’écran'}</button></div></div>`;
}

Object.assign(ACTIONS, {
  'fw-install': () => { fwInstall(); }
});
