// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';


ipcRenderer.invoke('echo', 'Preload script is loaded').then(response => {
  console.log('IPC test response:', response);
}).catch(err => {
  console.error('IPC test failed:', err);
});

// expose the electronAPI to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // File handling
  saveFile: (data: Buffer, fileName: string) => ipcRenderer.invoke('save-file', data, fileName),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

  // Add a reliable indicator that we're in Electron
  isElectron: true,

  // Also expose Electron version info
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  },

  // Simple test method
  ping: () => 'pong'
});

console.log('Preload script loaded.');