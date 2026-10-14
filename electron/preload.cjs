const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sendAlert: (title, body) => ipcRenderer.send('app:alert', { title, body }),
});
