const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: () => true,
  getCurrentVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => process.platform,
  startUpdate: (url, filename) => ipcRenderer.send('start-update', { url, filename }),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, value) => callback(value)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, message) => callback(message)),
  onUpdateComplete: (callback) => ipcRenderer.on('update-complete', () => callback())
});
