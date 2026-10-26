// Pont sécurisé entre l'interface et le système
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deck', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  createBackup: (cfg) => ipcRenderer.invoke('backup:create', cfg),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  readBackup: (name) => ipcRenderer.invoke('backup:read', name),
  openBackupsFolder: () => ipcRenderer.invoke('backup:open-folder'),
  exportSpace: (space) => ipcRenderer.invoke('space:export', space),
  importSpace: () => ipcRenderer.invoke('space:import'),
  chooseExe: () => ipcRenderer.invoke('dialog:exe'),
  runApp: (action) => ipcRenderer.invoke('app:run', action),
  version: () => ipcRenderer.invoke('app:version'),
  env: () => ipcRenderer.invoke('app:env'),
  setStartWithWindows: (on) => ipcRenderer.invoke('app:start-with-windows', on),
  setShortcuts: (list) => ipcRenderer.invoke('shortcuts:set', list),
  onShortcut: (cb) => ipcRenderer.on('shortcut', (e, id) => cb(id)),
  discordConnect: (creds, auto) => ipcRenderer.invoke('discord:connect', creds, auto),
  discordDisconnect: () => ipcRenderer.invoke('discord:disconnect'),
  discordState: () => ipcRenderer.invoke('discord:state'),
  discordRun: (op, arg) => ipcRenderer.invoke('discord:run', op, arg),
  onDiscordState: (cb) => ipcRenderer.on('discord-state', (e, st) => cb(st))
});
