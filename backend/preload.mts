import { contextBridge, ipcRenderer } from 'electron';

ipcRenderer.invoke('echo', 'Preload script is loaded').then(response => {
  console.log('IPC test response:', response);
}).catch(err => {
  console.error('IPC test failed:', err);
});

try {

  // expose the electronAPI to the renderer process
  contextBridge.exposeInMainWorld('electron', {
    // File handling
    saveFile: (data: Buffer, fileName: string) => ipcRenderer.invoke('save-file', data, fileName),
    writeFile: (filePath: string, data: ArrayBuffer) => ipcRenderer.invoke('writeFile', filePath, data), // TODO: repeated
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
      get: (key: string) => ipcRenderer.invoke('get-user-preference', key),
      set: (key: string, value: any) => ipcRenderer.invoke('set-user-preference', key, value),
      getAll: () => ipcRenderer.invoke('get-all-user-preferences'),
      setAll: (preferences: any) => ipcRenderer.invoke('set-all-user-preferences', preferences),
      reset: () => ipcRenderer.invoke('reset-user-preferences')
    },

    // File dialogs
    showOpenDialog: () => ipcRenderer.invoke('showOpenDialog'),
    showSaveDialog: (defaultName: string) => ipcRenderer.invoke('showSaveDialog', defaultName),
  });

} catch (error) {
  console.error('Error in preload.mts:', error);
}
console.log('preload.mts loaded.');