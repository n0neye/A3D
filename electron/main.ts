// electron/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, protocol } from 'electron';
import * as path from 'path';
import * as url from 'url';
import isDev from 'electron-is-dev';
import * as fs from 'fs';
import Store from 'electron-store';

let mainWindow: BrowserWindow | null;

// Define preference types
interface UserPreferences {
  falApiKey: string;
  theme: 'light' | 'dark';
}

interface ElectronStoreWithAPI<T extends Record<string, any>> extends Store<T> {
  get: (key?: string) => any;
  set: (key: string | Partial<T>, value?: any) => void;
  store: T;
  clear: () => void;
}

const userPrefs = new Store<UserPreferences>({
  name: 'user-preferences',
  defaults: {
    falApiKey: '',
    theme: 'dark'
  },
  schema: {
    falApiKey: {
      type: 'string'
    },
    theme: {
      type: 'string',
      enum: ['light', 'dark']
    }
  },
}) as ElectronStoreWithAPI<UserPreferences>;

function createWindow() {
  mainWindow = new BrowserWindow({
    // titleBarStyle: ,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, // Keep false to improve security
      contextIsolation: true, // Recommended, protects main/renderer boundaries
      preload: path.join(__dirname, 'preload.js'), // Will create preload script (later)
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3030' // Load Next.js dev server in development mode
    : url.format({
        pathname: path.join(__dirname, '../out/index.html'), // Load Next.js exported static files in production mode
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

// (Optional) Create Preload script (used to safely expose Node API to Renderer)
// Create preload.ts in the electron/ folder
// Will configure tsconfig to compile it later

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // On macOS, applications and their menu bar typically stay active unless the user explicitly quits with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, when clicking the dock icon and no other windows are open, a new window is typically created
  if (mainWindow === null) {
    createWindow();
  }
});

// (Optional) Handle IPC messages from Renderer here
// ipcMain.on('some-event', (event, arg) => {
//   console.log(arg); // prints "ping"
//   // Do something...
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

ipcMain.handle('load-image-data', async (event, filePath) => {
  // Remove file:// prefix if present
  if (filePath.startsWith('file://')) {
    filePath = filePath.substring(7);
  }
  
  try {
    const data = await fs.promises.readFile(filePath);
    const base64Data = `data:image/jpeg;base64,${data.toString('base64')}`;
    return base64Data;
  } catch (error) {
    console.error('Error loading image', error);
    throw error;
  }
});

// Handle preferences via IPC
ipcMain.handle('get-preference', async (event, key) => {
  return userPrefs.get(key);
});

ipcMain.handle('set-preference', async (event, key, value) => {
  userPrefs.set(key, value);
  return true;
});

ipcMain.handle('get-all-preferences', async () => {
  return userPrefs.store;
});

ipcMain.handle('set-all-preferences', async (event, preferences) => {
  userPrefs.set(preferences);
  return true;
});

ipcMain.handle('reset-preferences', async () => {
  userPrefs.clear();
  return true;
});