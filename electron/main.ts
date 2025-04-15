// electron/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
import isDev from 'electron-is-dev';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    // titleBarStyle: ,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, // 保持為 false 以提高安全性
      contextIsolation: true, // 推薦，保護 main/renderer 邊界
      preload: path.join(__dirname, 'preload.js'), // 將建立 preload 腳本 (稍後)
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000' // 開發模式下加載 Next.js 開發伺服器
    : url.format({
        pathname: path.join(__dirname, '../out/index.html'), // 生產模式下加載 Next.js 匯出的靜態檔案
        protocol: 'file:',
        slashes: true,
      });

  mainWindow.loadURL(startUrl);

  if (isDev) {
    // Automatically open the DevTools in dev mode
    mainWindow.webContents.openDevTools();
  }

  mainWindow.removeMenu();
  mainWindow.maximize();

  // Enable file drop events
  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  
	globalShortcut.register('f5', function() {
		console.log('f5 is pressed')
		mainWindow?.reload()
	})
	globalShortcut.register('CommandOrControl+R', function() {
		console.log('CommandOrControl+R is pressed')
		mainWindow?.reload()
	})

  mainWindow?.webContents.on('before-input-event', (_, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
    }
});
}

// (可選) 建立 Preload 腳本 (用於安全地暴露 Node API 給 Renderer)
// 在 electron/ 資料夾內建立 preload.ts
// 稍後會配置 tsconfig 來編譯它

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // 在 macOS 上，除非使用者明確按下 Cmd + Q，否則應用程式及其選單列通常會保持活動狀態。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在 macOS 上，當點擊 dock 圖標且沒有其他視窗開啟時，通常會重新建立一個視窗。
  if (mainWindow === null) {
    createWindow();
  }
});

// (可選) 在這裡處理來自 Renderer 的 IPC 訊息
// ipcMain.on('some-event', (event, arg) => {
//   console.log(arg); // prints "ping"
//   // 做一些事情...
//   event.reply('some-reply', 'pong');
// });

// Add IPC handlers for file operations
ipcMain.handle('save-file', async (event, data, fileName) => {
  const userDataPath = path.join(app.getPath('userData'), 'ImportedAssets');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  const filePath = path.join(userDataPath, fileName);
  await fs.promises.writeFile(filePath, Buffer.from(data));
  return `file://${filePath.replace(/\\/g, '/')}`;
});

ipcMain.handle('read-file', async (event, filePath) => {
  // Remove file:// prefix if present
  if (filePath.startsWith('file://')) {
    filePath = filePath.substring(7);
  }
  
  const data = await fs.promises.readFile(filePath);
  return data.buffer;
});

ipcMain.handle('get-app-data-path', async (event) => {
  const userDataPath = path.join(app.getPath('userData'), 'ImportedAssets');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  return userDataPath;
});