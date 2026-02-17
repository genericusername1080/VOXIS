/**
 * VOXIS 4 Dense — Electron Main Process
 * Powered by Trinity 8.1 | Built by Glass Stone
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

// Config
const isDev = !app.isPackaged;
const BACKEND_PORT = 5001;
const FRONTEND_PORT = 5173;

// Process refs
let mainWindow = null;
let backendProcess = null;
let splashWindow = null;

function getResourcePath(rel) {
  return isDev ? path.join(__dirname, '..', rel) : path.join(process.resourcesPath, rel);
}

// =============================================================================
// SPLASH
// =============================================================================

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

// =============================================================================
// MAIN WINDOW
// =============================================================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(process.resourcesPath, 'dist', 'index.html');
    console.log('[VOXIS Dense] Loading frontend:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// =============================================================================
// BACKEND
// =============================================================================

async function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('[VOXIS Dense] Starting backend...');
    const backendPath = getResourcePath('backend');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    let startCmd, startArgs, startOptions;

    if (isDev) {
      const venvPython = path.join(backendPath, 'venv', 'bin', 'python');
      startCmd = fs.existsSync(venvPython) ? venvPython : pythonCmd;
      startArgs = [path.join(backendPath, 'server.py')];
      startOptions = { cwd: backendPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT } };
    } else {
      const distPath = getResourcePath(path.join('backend', 'dist', 'voxis_backend'));
      const execName = process.platform === 'win32' ? 'voxis_backend.exe' : 'voxis_backend';
      const execPath = path.join(distPath, execName);

      if (fs.existsSync(execPath)) {
        console.log('[VOXIS Dense] Found bundled backend:', execPath);
        startCmd = execPath;
        startArgs = [];
        startOptions = { cwd: distPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT, VOXIS_ROOT_PATH: distPath } };
      } else {
        console.log('[VOXIS Dense] Fallback to python script');
        startCmd = pythonCmd;
        startArgs = [path.join(backendPath, 'server.py')];
        startOptions = { cwd: backendPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT } };
      }
    }

    console.log(`[VOXIS Dense] Spawning: ${startCmd} ${startArgs.join(' ')}`);
    backendProcess = spawn(startCmd, startArgs, startOptions);

    backendProcess.stdout.on('data', (d) => console.log(`[Backend] ${d}`));
    backendProcess.stderr.on('data', (d) => console.error(`[Backend] ${d}`));
    backendProcess.on('error', (err) => { console.error('[VOXIS Dense] Backend error:', err); reject(err); });
    backendProcess.on('exit', (code) => { console.log(`[VOXIS Dense] Backend exited: ${code}`); backendProcess = null; });

    waitForBackend(60000).then(resolve).catch(reject);
  });
}

function waitForBackend(timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) { reject(new Error('Backend startup timeout')); return; }
      http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) { console.log('[VOXIS Dense] Backend ready'); resolve(); }
        else setTimeout(check, 500);
      }).on('error', () => setTimeout(check, 500));
    };
    setTimeout(check, 1000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[VOXIS Dense] Stopping backend...');
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${backendProcess.pid} /T /F`);
    } else {
      backendProcess.kill('SIGTERM');
    }
    backendProcess = null;
  }
}

// =============================================================================
// IPC
// =============================================================================

ipcMain.handle('get-backend-status', async () => {
  try {
    const res = await fetch(`http://localhost:${BACKEND_PORT}/api/health`);
    return { online: true, data: await res.json() };
  } catch { return { online: false }; }
});

ipcMain.handle('restart-backend', async () => {
  stopBackend();
  await new Promise(r => setTimeout(r, 1000));
  return startBackend();
});

ipcMain.handle('get-app-info', () => ({
  name: 'VOXIS 4 Dense',
  version: app.getVersion(),
  platform: process.platform,
  isDev
}));

// Model management IPC
ipcMain.handle('get-model-status', async () => {
  try {
    const res = await fetch(`http://localhost:${BACKEND_PORT}/api/models`);
    return await res.json();
  } catch { return { error: 'Backend unreachable' }; }
});

ipcMain.handle('download-models', async (_, modelId) => {
  try {
    const body = modelId ? JSON.stringify({ model_id: modelId }) : '{}';
    const res = await fetch(`http://localhost:${BACKEND_PORT}/api/models/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    return await res.json();
  } catch { return { error: 'Backend unreachable' }; }
});

ipcMain.handle('cancel-model-download', async () => {
  try {
    const res = await fetch(`http://localhost:${BACKEND_PORT}/api/models/cancel`, { method: 'POST' });
    return await res.json();
  } catch { return { error: 'Backend unreachable' }; }
});

// =============================================================================
// LIFECYCLE
// =============================================================================

app.whenReady().then(async () => {
  createSplashWindow();
  try {
    await startBackend();
    createMainWindow();
  } catch (err) {
    console.error('[VOXIS Dense] Startup failed:', err);
    dialog.showErrorBox('VOXIS Dense — Startup Error',
      'Failed to start the audio processing backend.\n\n' +
      'Please ensure Python 3.9+ and FFmpeg are installed.\n\n' +
      `Error: ${err.message}`
    );
    if (splashWindow) splashWindow.close();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopBackend());

process.on('uncaughtException', (err) => {
  console.error('[VOXIS Dense] Uncaught exception:', err);
  stopBackend();
});
