// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// 在這裡暴露你想要從 Next.js (Renderer) 呼叫的 Main Process 功能
// 範例：暴露一個簡單的 ping/pong
contextBridge.exposeInMainWorld('electronAPI', {
  // 範例：發送事件到 Main Process
  sendEvent: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  // 範例：接收來自 Main Process 的回覆
  handleReply: (channel: string, func: (...args: any[]) => void) => {
    // 移除之前的監聽器以避免記憶體洩漏
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  // 你可以暴露更多 Node.js 或 Electron 的 API，但要謹慎
  // 例如：獲取 app 版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version') // 需要在 main.ts 中用 ipcMain.handle 處理
});

console.log('Preload script loaded.');