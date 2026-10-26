// Cockpit Deck — processus principal (Electron)
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ESPRESSIF_VID = 12346; // 0x303A, fabricant de l'ESP32-P4

let win = null;
let tray = null;
let quitting = false;

const dataDir = () => app.getPath('userData');
const configPath = () => path.join(dataDir(), 'config.json');
const backupDir = () => path.join(dataDir(), 'sauvegardes');
const psPath = () => path.join(dataDir(), 'placer-fenetre.ps1');

// ---------- fenêtre ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    show: !process.argv.includes('--cache'),
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#0B0F14',
    title: 'Cockpit Deck',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Port série (USB) : choisit automatiquement l'écran Cockpit Deck (ESP32-P4)
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
  tray.setToolTip('Cockpit Deck');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir Cockpit Deck', click: () => { win.show(); win.focus(); } },
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

function ensurePsScript() {
  try { fs.writeFileSync(psPath(), PS_SCRIPT, 'utf8'); } catch (e) { /* ignoré */ }
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

// ---------- configuration et sauvegardes ----------
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function stamp() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}m${z(d.getSeconds())}`;
}

ipcMain.handle('config:load', () => readJson(configPath()));
ipcMain.handle('config:save', (e, cfg) => {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = configPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg));
  fs.renameSync(tmp, configPath());
  return true;
});
ipcMain.handle('backup:create', (e, cfg) => {
  fs.mkdirSync(backupDir(), { recursive: true });
  const name = `sauvegarde_${stamp()}.json`;
  fs.writeFileSync(path.join(backupDir(), name), JSON.stringify(cfg));
  // garde les 30 dernières
  const all = fs.readdirSync(backupDir()).filter(f => f.endsWith('.json')).sort();
  all.slice(0, Math.max(0, all.length - 30)).forEach(f => { try { fs.unlinkSync(path.join(backupDir(), f)); } catch (err) { /* ignoré */ } });
  return name;
});
ipcMain.handle('backup:list', () => {
  try { return fs.readdirSync(backupDir()).filter(f => f.endsWith('.json')).sort().reverse(); } catch (e) { return []; }
});
ipcMain.handle('backup:read', (e, name) => readJson(path.join(backupDir(), path.basename(name))));
ipcMain.handle('backup:open-folder', () => { fs.mkdirSync(backupDir(), { recursive: true }); shell.openPath(backupDir()); });

ipcMain.handle('space:export', async (e, space) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter l\u2019espace',
    defaultPath: (space.name || 'espace').replace(/[\\/:*?"<>|]/g, '_') + '.deck',
    filters: [{ name: 'Espace Cockpit Deck', extensions: ['deck'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, JSON.stringify({ format: 'cockpit-deck-espace', version: 1, space }, null, 1));
  return r.filePath;
});
ipcMain.handle('space:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Importer un espace',
    properties: ['openFile'],
    filters: [{ name: 'Espace Cockpit Deck', extensions: ['deck', 'json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const data = readJson(r.filePaths[0]);
  return data && data.space ? data.space : { error: 'Ce fichier n\u2019est pas un espace Cockpit Deck.' };
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

// ---------- démarrage ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    ensurePsScript();
    createWindow();
    createTray();
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => { /* reste près de l'horloge */ });
}
