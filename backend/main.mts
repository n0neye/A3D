// electron/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, protocol, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import isDev from 'electron-is-dev';
import fs from 'fs';
import Store from 'electron-store';
import fsPromises from 'fs/promises'; // Use promises version of fs
import { fileURLToPath } from 'url';

const __projectExtension = 'a3d';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    icon: getAssetPath('icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH, // Change to preload.mjs
      sandbox: false,
    },
  });

  const START_URL = isDev
    ? 'http://localhost:3030'
    : `file://${path.join(__dirname, '../../frontend/build/index.html')}`

  mainWindow.loadURL(START_URL);

  // Automatically open the DevTools in dev mode
  if (isDev) { mainWindow.webContents.openDevTools(); }

  mainWindow.removeMenu();
  mainWindow.maximize();

  // Enable file drop events
  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Global Shortcuts

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

// ======================================================================================
// App Events

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


// ======================================================================================
// IPC Main Events


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
ipcMain.handle('get-user-preference', async (event, key) => {
  return userPrefs.get(key);
});

ipcMain.handle('set-user-preference', async (event, key, value) => {
  userPrefs.set(key, value);
  return true;
});

ipcMain.handle('get-all-user-preferences', async () => {
  return userPrefs.store;
});

ipcMain.handle('set-all-user-preferences', async (event, preferences) => {
  userPrefs.set(preferences);
  return true;
});

ipcMain.handle('reset-user-preferences', async () => {
  userPrefs.clear();
  return true;
});

// Function to get the main window (adjust selector if needed)
function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0];
}

// Handle opening a project file
ipcMain.handle('showOpenDialog', async () => {
  const mainWindow = getMainWindow();
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    properties: ['openFile'],
    filters: [{ name: 'Project Files', extensions: [__projectExtension] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null; // User cancelled
  }

  const filePath = result.filePaths[0];
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8'); // Read as text for JSON parsing later
    return { filePath, content }; // Return both path and content
  } catch (error) {
    console.error('Error reading file:', error);
    // Optionally show an error dialog to the user
    dialog.showErrorBox('Error Opening File', `Could not read the file: ${filePath}\n${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
});

// Handle saving a project file (Save As)
ipcMain.handle('showSaveDialog', async (event, defaultName: string) => {
  const mainWindow = getMainWindow();
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project As',
    defaultPath: path.join(app.getPath('documents'), defaultName || 'scene-project.' + __projectExtension), // Suggest documents folder
    filters: [{ name: 'Project Files', extensions: [__projectExtension] }],
  });

  if (result.canceled || !result.filePath) {
    return null; // User cancelled
  }

  return result.filePath; // Return the chosen path
});

// Handle writing data to a specific file path
ipcMain.handle('writeFile', async (event, filePath: string, data: ArrayBuffer) => {
  if (!filePath) {
    console.error('writeFile IPC handler received null or empty filePath');
    return { success: false, error: 'No file path specified.' };
  }
  try {
    // Convert ArrayBuffer to Buffer for fs.writeFile
    const buffer = Buffer.from(data);
    await fsPromises.writeFile(filePath, buffer);
    return { success: true };
  } catch (error) {
    console.error(`Error writing file to ${filePath}:`, error);
    // Optionally show an error dialog
    dialog.showErrorBox('Error Saving File', `Could not save the file: ${filePath}\n${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Add this handler if you keep the invoke in preload
ipcMain.handle('echo', (event, message) => {
  console.log('Received echo:', message);
  return `Main process received: ${message}`;
});