const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // File handling
    saveFile: (data, fileName) => ipcRenderer.invoke('save-file', data, fileName),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
    
    // Add a reliable indicator that we're in Electron
    isElectron: true,
    
    // Also expose Electron version info
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  }
); 