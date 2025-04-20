import { contextBridge, ipcRenderer } from 'electron';

ipcRenderer.invoke('echo', 'Preload script is loaded').then(response => {
  console.log('IPC test response:', response);
}).catch(err => {
  console.error('IPC test failed:', err);
});

console.log('preload.mts loading...');

try {

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

    // Add this method
    loadImageData: (filePath: string) => ipcRenderer.invoke('load-image-data', filePath),

    // Add user preferences API
    userPreferences: {
      get: (key: string) => ipcRenderer.invoke('get-preference', key),
      set: (key: string, value: any) => ipcRenderer.invoke('set-preference', key, value),
      getAll: () => ipcRenderer.invoke('get-all-preferences'),
      setAll: (preferences: any) => ipcRenderer.invoke('set-all-preferences', preferences),
      reset: () => ipcRenderer.invoke('reset-preferences')
    }
  });

} catch (error) {
  console.error('Error in preload.mts:', error);
}
console.log('preload.mts loaded.');