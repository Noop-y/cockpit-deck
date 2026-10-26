// The Deck — processus principal (Electron)
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu, shell, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { DiscordRPC } = require('./discord-rpc');

const ESPRESSIF_VID = 12346; // 0x303A, fabricant de l'ESP32-P4

let win = null;
let tray = null;
let quitting = false;

const dataDir = () => app.getPath('userData');
const configPath = () => path.join(dataDir(), 'config.json');
const backupDir = () => path.join(dataDir(), 'sauvegardes');
const psPath = () => path.join(dataDir(), 'placer-fenetre.ps1');
const mediaPsPath = () => path.join(dataDir(), 'lecture-en-cours.ps1');
const keysPsPath = () => path.join(dataDir(), 'touches-media.ps1');
let discord = null;

// ---------- fenêtre ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    show: !process.argv.includes('--cache'),
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#0B0F14',
    title: 'The Deck ' + app.getVersion(),
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // liens externes (portail Discord…) : navigateur par défaut
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });

  // Port série (USB) : choisit automatiquement l'écran The Deck (ESP32-P4)
  const ses = win.webContents.session;
  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    const esp = portList.find(p => parseInt(p.vendorId, 10) === ESPRESSIF_VID);
    callback(esp ? esp.portId : '');
  });
  ses.setPermissionCheckHandler((wc, permission) => permission === 'serial' || permission === 'clipboard-sanitized-write');
  ses.setDevicePermissionHandler(details => details.deviceType === 'serial');

  // Fermer la fenêtre la cache près de l'horloge, sans arrêter le logiciel
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('The Deck ' + app.getVersion());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir The Deck', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { win.show(); win.focus(); });
}

// ---------- script de placement des fenêtres (Windows) ----------
const PS_SCRIPT = String.raw`param(
  [string]$Exe,
  [string]$ArgList = "",
  [string]$Proc = "",
  [string]$Screen = "gauche",
  [string]$Pos = "plein",
  [string]$Mode = "front"
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CDW {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
[CDW]::SetProcessDPIAware() | Out-Null
$screens = @([System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.Bounds.X })
if ($Screen -eq "droite") { $s = $screens[$screens.Count - 1] } else { $s = $screens[0] }
$a = $s.WorkingArea
$half = [int]($a.Width / 2)
switch ($Pos) {
  "gauche" { $x = $a.X; $w = $half }
  "droite" { $x = $a.X + $half; $w = $a.Width - $half }
  default  { $x = $a.X; $w = $a.Width }
}
$y = $a.Y; $h = $a.Height
if (-not $Proc) { $Proc = [IO.Path]::GetFileNameWithoutExtension($Exe) }
function Get-Windows { @(Get-Process -Name $Proc -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) }
$before = @(Get-Windows | ForEach-Object { $_.MainWindowHandle })
$target = $null
if ($Mode -eq "front" -and $before.Count -gt 0) { $target = $before[0] }
if (-not $target) {
  if ($ArgList) { Start-Process -FilePath $Exe -ArgumentList $ArgList } else { Start-Process -FilePath $Exe }
  for ($i = 0; $i -lt 80 -and -not $target; $i++) {
    Start-Sleep -Milliseconds 250
    foreach ($p in Get-Windows) {
      if ($before -notcontains $p.MainWindowHandle) { $target = $p.MainWindowHandle; break }
    }
    if (-not $target -and $Mode -eq "front") { $now = @(Get-Windows); if ($now.Count -gt 0) { $target = $now[0].MainWindowHandle } }
  }
}
if (-not $target) { exit 2 }
Start-Sleep -Milliseconds 300
[CDW]::ShowWindow($target, 9) | Out-Null
[CDW]::MoveWindow($target, $x, $y, $w, $h, $true) | Out-Null
[CDW]::SetForegroundWindow($target) | Out-Null
exit 0
`;

// ---------- lecteur (Spotify et autres) ----------
// Lit le morceau en cours avec les commandes multimédia de Windows (sans compte, sans connexion internet).
const MEDIA_PS = String.raw`$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Out-State($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)); [Console]::Out.Flush() }
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
  function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
  [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch { Out-State @{ error = 'Commandes multimédia de Windows indisponibles.' }; exit 3 }
$lastKey = ''; $lastStatus = ''; $coverRetry = 0
while ($true) {
  try {
    $s = $null
    foreach ($x in $mgr.GetSessions()) { if ($x.SourceAppUserModelId -like '*Spotify*') { $s = $x } }
    if (-not $s) { $s = $mgr.GetCurrentSession() }
    if (-not $s) {
      if ($lastKey -ne 'none') { Out-State @{ none = $true }; $lastKey = 'none'; $lastStatus = '' }
    } else {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $st = $s.GetPlaybackInfo().PlaybackStatus.ToString()
      $key = "$($p.Title)|$($p.Artist)|$($p.AlbumTitle)"
      if ($key -ne $lastKey) { $coverRetry = 3 }
      if ($key -ne $lastKey -or $st -ne $lastStatus -or $coverRetry -gt 0) {
        $cover = $null
        if ($coverRetry -gt 0 -and $p.Thumbnail) {
          try {
            $stream = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $size = [uint32]$stream.Size
            $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
            Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
            $bytes = New-Object byte[] $size
            $reader.ReadBytes($bytes)
            $cover = 'data:' + $stream.ContentType + ';base64,' + [Convert]::ToBase64String($bytes)
            $reader.Dispose(); $stream.Dispose()
          } catch { $cover = $null }
          $coverRetry--
        }
        $o = [ordered]@{ title = $p.Title; artist = $p.Artist; album = $p.AlbumTitle; status = $st; app = $s.SourceAppUserModelId }
        if ($cover) { $o.cover = $cover }
        Out-State $o
        $lastKey = $key; $lastStatus = $st
      }
    }
  } catch { }
  Start-Sleep -Milliseconds 700
}
`;
// Touches multimédia (précédent, lecture/pause, suivant, volume) envoyées par le PC, pour tester sans l'écran
const KEYS_PS = String.raw`Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CDK {
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static void Press(byte vk) { keybd_event(vk, 0, 1, UIntPtr.Zero); keybd_event(vk, 0, 3, UIntPtr.Zero); }
}
"@
$map = @{ prev = 0xB1; next = 0xB0; play = 0xB3; vplus = 0xAF; vmoins = 0xAE; muet = 0xAD }
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $k = $line.Trim()
  if ($map.ContainsKey($k)) { [CDK]::Press([byte]$map[$k]) }
}
`;

function ensurePsScript() {
  try { fs.writeFileSync(psPath(), PS_SCRIPT, 'utf8'); } catch (e) { /* ignoré */ }
  // BOM UTF-8 : PowerShell 5 lit alors correctement les accents
  try { fs.writeFileSync(mediaPsPath(), '\ufeff' + MEDIA_PS, 'utf8'); } catch (e) { /* ignoré */ }
  try { fs.writeFileSync(keysPsPath(), '\ufeff' + KEYS_PS, 'utf8'); } catch (e) { /* ignoré */ }
}

let mediaProc = null, mediaWanted = false, mediaRestart = null, keysProc = null;
function sendMedia(st) { if (win && !win.isDestroyed()) win.webContents.send('media-state', st); }
function startMediaWatch() {
  mediaWanted = true;
  if (process.platform !== 'win32') { sendMedia({ unavailable: true, message: 'Le lecteur ne fonctionne que sous Windows.' }); return; }
  if (mediaProc) return;
  const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', mediaPsPath()], { windowsHide: true });
  mediaProc = ps;
  let buf = '';
  ps.stdout.setEncoding('utf8');
  ps.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      try { sendMedia(JSON.parse(line)); } catch (e) { /* ligne incomplète */ }
    }
  });
  ps.on('close', (code) => {
    mediaProc = null;
    if (code === 3) return;                       // Windows trop ancien : on n'insiste pas
    if (mediaWanted && !quitting) { clearTimeout(mediaRestart); mediaRestart = setTimeout(startMediaWatch, 5000); }
  });
  ps.on('error', () => { mediaProc = null; sendMedia({ unavailable: true, message: 'PowerShell introuvable.' }); });
}
function stopMediaWatch() {
  mediaWanted = false; clearTimeout(mediaRestart);
  if (mediaProc) { try { mediaProc.kill(); } catch (e) { /* ignoré */ } mediaProc = null; }
}
function mediaKey(k) {
  if (process.platform !== 'win32') return false;
  if (!keysProc) {
    keysProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', keysPsPath()], { windowsHide: true });
    keysProc.on('close', () => { keysProc = null; });
    keysProc.on('error', () => { keysProc = null; });
  }
  try { keysProc.stdin.write(k + '\n'); return true; } catch (e) { return false; }
}

function runAppAction(a) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ ok: false, message: 'Le placement des fenêtres ne fonctionne que sous Windows.' });
      return;
    }
    if (!a || !a.exe) {
      resolve({ ok: false, message: 'Aucun programme choisi pour cette case.' });
      return;
    }
    // %LOCALAPPDATA% etc. -> chemins réels
    const expand = (s) => String(s || '').replace(/%([^%]+)%/g, (m, v) => process.env[v] || m);
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', psPath(),
      '-Exe', expand(a.exe), '-Screen', a.screen || 'gauche', '-Pos', a.position || 'plein', '-Mode', a.ifOpen || 'front'];
    if (a.args) { args.push('-ArgList', expand(a.args)); }
    if (a.processName) { args.push('-Proc', a.processName); }
    const ps = spawn('powershell.exe', args, { windowsHide: true });
    let err = '';
    ps.stderr.on('data', d => { err += d.toString(); });
    ps.on('close', code => {
      if (code === 0) resolve({ ok: true, message: 'Fenêtre ouverte et placée.' });
      else if (code === 2) resolve({ ok: false, message: 'Le programme ne s\u2019est pas ouvert à temps, ou son nom de processus est différent.' });
      else resolve({ ok: false, message: 'Erreur de placement : ' + (err.trim().split('\n')[0] || 'code ' + code) });
    });
    ps.on('error', e => resolve({ ok: false, message: 'PowerShell introuvable : ' + e.message }));
  });
}

// ---------- codes secrets (mot de passe OBS, Client Secret Discord) ----------
// Chiffrés avec la protection de Windows (DPAPI) : seule votre session Windows, sur ce PC, peut les relire.
// Copié sur un autre PC ou ouvert par un autre compte, le fichier ne contient rien d'utilisable.
const SECRETS = [['obs', 'password'], ['discord', 'clientSecret']];
const TAG = 'dpapi:';
const canSeal = () => { try { return safeStorage.isEncryptionAvailable(); } catch (e) { return false; } };
function sealText(v) { return canSeal() ? TAG + safeStorage.encryptString(v).toString('base64') : v; }
function openText(v) {
  if (typeof v !== 'string' || !v.startsWith(TAG)) return v;
  try { return safeStorage.decryptString(Buffer.from(v.slice(TAG.length), 'base64')); } catch (e) { return ''; }
}
function sealSecrets(cfg) {
  if (!cfg) return cfg;
  const out = JSON.parse(JSON.stringify(cfg));
  SECRETS.forEach(([a, b]) => { const v = out[a] && out[a][b]; if (typeof v === 'string' && v && !v.startsWith(TAG)) out[a][b] = sealText(v); });
  return out;
}
function openSecrets(cfg) {
  if (!cfg) return cfg;
  SECRETS.forEach(([a, b]) => { if (cfg[a] && typeof cfg[a][b] === 'string') cfg[a][b] = openText(cfg[a][b]); });
  return cfg;
}
const hasClearSecret = (cfg) => !!cfg && canSeal() && SECRETS.some(([a, b]) => { const v = cfg[a] && cfg[a][b]; return typeof v === 'string' && v && !v.startsWith(TAG); });
function writeJsonAtomic(p, data) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, p);
}
// anciennes versions : chiffre les codes restés en clair dans la configuration et les sauvegardes
function sealExistingFiles() {
  const files = [configPath()];
  try { fs.readdirSync(backupDir()).filter(f => f.endsWith('.json')).forEach(f => files.push(path.join(backupDir(), f))); } catch (e) { /* pas de sauvegardes */ }
  files.forEach(f => { const d = readJson(f); if (hasClearSecret(d)) { try { writeJsonAtomic(f, sealSecrets(d)); } catch (e) { /* ignoré */ } } });
  // jeton Discord resté en clair
  const tok = path.join(dataDir(), 'discord-jeton.json');
  try { const t = fs.readFileSync(tok, 'utf8'); if (canSeal() && t && !t.startsWith(TAG)) fs.writeFileSync(tok, sealText(t)); } catch (e) { /* pas de jeton */ }
}

// ---------- ancien nom (Cockpit Deck) ----------
// Le logiciel s'appelait « Cockpit Deck » jusqu'à la version 0.4 : on reprend ses réglages et sauvegardes.
function migrateFromCockpitDeck() {
  const oldDir = path.join(app.getPath('appData'), 'Cockpit Deck');
  const newDir = dataDir();
  try {
    if (!fs.existsSync(path.join(newDir, 'config.json')) && fs.existsSync(path.join(oldDir, 'config.json'))) {
      fs.mkdirSync(newDir, { recursive: true });
      ['config.json', 'discord-jeton.json'].forEach(f => { const src = path.join(oldDir, f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(newDir, f)); });
      const oldBk = path.join(oldDir, 'sauvegardes');
      if (fs.existsSync(oldBk)) fs.cpSync(oldBk, backupDir(), { recursive: true });
    }
  } catch (e) { /* on repart d'une configuration neuve */ }
  // l'ancien lancement automatique « Cockpit Deck » ne doit plus démarrer
  try { app.setLoginItemSettings({ openAtLogin: false, name: 'Cockpit Deck' }); } catch (e) { /* ignoré */ }
}

// ---------- configuration et sauvegardes ----------
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function stamp() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}m${z(d.getSeconds())}`;
}

ipcMain.handle('config:load', () => openSecrets(readJson(configPath())));
ipcMain.handle('config:save', (e, cfg) => {
  fs.mkdirSync(dataDir(), { recursive: true });
  writeJsonAtomic(configPath(), sealSecrets(cfg));
  return true;
});
ipcMain.handle('backup:create', (e, cfg) => {
  fs.mkdirSync(backupDir(), { recursive: true });
  const name = `sauvegarde_${stamp()}.json`;
  fs.writeFileSync(path.join(backupDir(), name), JSON.stringify(sealSecrets(cfg)));
  // garde les 30 dernières
  const all = fs.readdirSync(backupDir()).filter(f => f.endsWith('.json')).sort();
  all.slice(0, Math.max(0, all.length - 30)).forEach(f => { try { fs.unlinkSync(path.join(backupDir(), f)); } catch (err) { /* ignoré */ } });
  return name;
});
ipcMain.handle('backup:list', () => {
  try { return fs.readdirSync(backupDir()).filter(f => f.endsWith('.json')).sort().reverse(); } catch (e) { return []; }
});
ipcMain.handle('backup:read', (e, name) => openSecrets(readJson(path.join(backupDir(), path.basename(name)))));
ipcMain.handle('backup:open-folder', () => { fs.mkdirSync(backupDir(), { recursive: true }); shell.openPath(backupDir()); });

ipcMain.handle('space:export', async (e, space) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter l\u2019espace',
    defaultPath: (space.name || 'espace').replace(/[\\/:*?"<>|]/g, '_') + '.deck',
    filters: [{ name: 'Espace The Deck', extensions: ['deck'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, JSON.stringify({ format: 'cockpit-deck-espace', version: 1, space }, null, 1));
  return r.filePath;
});
ipcMain.handle('space:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Importer un espace',
    properties: ['openFile'],
    filters: [{ name: 'Espace The Deck', extensions: ['deck', 'json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const data = readJson(r.filePaths[0]);
  return data && data.space ? data.space : { error: 'Ce fichier n\u2019est pas un espace The Deck.' };
});
ipcMain.handle('dialog:exe', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir un programme',
    properties: ['openFile'],
    filters: [{ name: 'Programmes', extensions: ['exe', 'lnk', 'bat', 'cmd'] }, { name: 'Tous les fichiers', extensions: ['*'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('app:run', (e, action) => runAppAction(action));
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:env', () => ({ localAppData: process.env.LOCALAPPDATA || '', programFiles: process.env.ProgramFiles || 'C:\\Program Files', programFilesX86: process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)' }));
ipcMain.handle('app:start-with-windows', (e, on) => {
  // version portable : pointer vers le vrai fichier .exe, pas vers sa copie temporaire
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  app.setLoginItemSettings({ openAtLogin: !!on, path: exe, args: ['--cache'] });
  return app.getLoginItemSettings({ path: exe, args: ['--cache'] }).openAtLogin;
});

// Touches réservées (F13 à F24) : l'écran les envoie, le logiciel exécute l'action
ipcMain.handle('shortcuts:set', (e, list) => {
  globalShortcut.unregisterAll();
  const results = {};
  (list || []).forEach(({ accel, id }) => {
    try {
      results[accel] = globalShortcut.register(accel, () => {
        if (win) win.webContents.send('shortcut', id);
      });
    } catch (err) {
      results[accel] = false;
    }
  });
  return results;
});

ipcMain.handle('media:watch', (e, on) => { if (on) startMediaWatch(); else stopMediaWatch(); return true; });
ipcMain.handle('media:key', (e, k) => mediaKey(String(k)));

// ---------- Discord ----------
ipcMain.handle('discord:connect', (e, creds, auto) => discord.connect(creds, auto));
ipcMain.handle('discord:disconnect', () => { discord.disconnect(false); discord.forgetToken(); return discord.state; });
ipcMain.handle('discord:state', () => discord.state);
ipcMain.handle('discord:run', async (e, op, arg) => {
  try { return { ok: true, message: await discord.run(op, arg) }; } catch (err) { return { ok: false, message: err.message }; }
});

// ---------- démarrage ----------
// Une seule copie à la fois. Si une copie plus ancienne tourne déjà (cachée près de l'horloge),
// elle se ferme et la nouvelle version prend sa place.
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
const gotLock = app.requestSingleInstanceLock({ version: app.getVersion() });
if (!gotLock) {
  if (process.argv.includes('--relance')) {
    app.exit(0);
  } else {
    // laisse à l'ancienne copie le temps de se fermer, puis relance cette version
    setTimeout(() => {
      app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath, args: process.argv.slice(1).concat(['--relance']) });
      app.exit(0);
    }, 2500);
  }
} else {
  app.on('second-instance', (event, argv, cwd, data) => {
    if (data && data.version && newer(data.version, app.getVersion())) { quitting = true; app.quit(); return; }
    if (win) { win.show(); win.focus(); }
  });
  app.whenReady().then(() => {
    ensurePsScript();
    migrateFromCockpitDeck();
    sealExistingFiles();
    discord = new DiscordRPC(path.join(dataDir(), 'discord-jeton.json'), { seal: sealText, open: openText });
    discord.on('state', (st) => { if (win && !win.isDestroyed()) win.webContents.send('discord-state', st); });
    createWindow();
    createTray();
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopMediaWatch();
    if (keysProc) { try { keysProc.kill(); } catch (e) { /* ignoré */ } }
  });
  app.on('window-all-closed', () => { /* reste près de l'horloge */ });
}
