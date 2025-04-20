// electron/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path'; // Use default import for path
import url from 'url'; // Use default import for url
import isDev from 'electron-is-dev';
import fs from 'fs'; // Use default import for fs
import Store from 'electron-store';
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Replicate __dirname functionality in ESM
const __filename = fileURLToPath(import.meta.url);
// __dirname here will point to the 'dist' folder where main.mjs is located after compilation
const __dirname = path.dirname(__filename);

console.log('main.ts __dirname', __dirname);
console.log('main.ts __filename', __filename);

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


  const RESOURCES_PATH = isDev
    ? path.join(__dirname, '../../assets')
    : path.join(process.resourcesPath, 'assets')

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths)
  }

  const PRELOAD_PATH = path.join(__dirname, 'preload.mjs')

  mainWindow = new BrowserWindow({
    // titleBarStyle: ,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH, // Change to preload.mjs
      sandbox: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3030'
    : `file://${path.join(__dirname, '../../frontend/build/index.html')}`

  console.log('startUrl:', startUrl); // Log the final URL
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


  globalShortcut.register('f5', function () {
    console.log('f5 is pressed')
    mainWindow?.reload()
  })
  globalShortcut.register('CommandOrControl+R', function () {
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

/*
 * ======================================================================================
 *                                IPC Main Events
 * ======================================================================================
 */

// Add IPC handlers for file operations
ipcMain.handle('save-file', async (event, data, fileName) => {
  const userDataPath = path.join(app.getPath('userData'), 'ImportedAssets');

  // Create directory if it doesn't exist
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const filePath = path.join(userDataPath, fileName);
  await fs.promises.writeFile(filePath, Buffer.from(data));
  return url.pathToFileURL(filePath).toString();
});

ipcMain.handle('read-file', async (event, fileUrl) => {
  // Convert file URL string back to path
  const filePath = fileURLToPath(fileUrl);
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

ipcMain.handle('load-image-data', async (event, fileUrl) => {
  // Convert file URL string back to path
  const filePath = fileURLToPath(fileUrl);

  try {
    const data = await fs.promises.readFile(filePath);
    // Determine image type based on extension (basic example)
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg'; // Default
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    // Add more types as needed

    const base64Data = `data:${mimeType};base64,${data.toString('base64')}`;
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

// Add this handler if you keep the invoke in preload
ipcMain.handle('echo', (event, message) => {
  console.log('Received echo:', message);
  return `Main process received: ${message}`;
});