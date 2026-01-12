/**
 * VOXIS Desktop Application - Main Process
 * Powered by Trinity | Built by Glass Stone
 * 
 * Manages:
 * - Application window lifecycle
 * - Python backend process
 * - System tray integration
 * - Auto-updates (future)
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

// Configuration
const isDev = !app.isPackaged;
const BACKEND_PORT = 5001;
const FRONTEND_PORT = 5173;

// Process references
let mainWindow = null;
let backendProcess = null;
let splashWindow = null;

// Paths
function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

// =============================================================================
// SPLASH SCREEN
// =============================================================================

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
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

  // Load frontend
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, 'dist' is copied to 'resources/dist'
    // We are in 'resources/app.asar/main.js' or 'resources/main.js' depending on packaging
    // The reliable way is using process.resourcesPath
    const indexPath = path.join(process.resourcesPath, 'dist', 'index.html');
    console.log('[VOXIS] Loading frontend from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// =============================================================================
// BACKEND MANAGEMENT
// =============================================================================

async function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('[VOXIS] Starting backend...');
    
    const backendPath = getResourcePath('backend');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Check if we're in dev mode or packaged
    let startCmd, startArgs, startOptions;
    
    if (isDev) {
      // Development: Use existing venv
      const venvPython = path.join(backendPath, 'venv', 'bin', 'python');
      const serverPath = path.join(backendPath, 'server.py');
      
      startCmd = fs.existsSync(venvPython) ? venvPython : pythonCmd;
      startArgs = [serverPath];
      startOptions = { cwd: backendPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT } };
      startOptions = { cwd: backendPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT } };
    } else {
      // Production: Use bundled executable
      const backendDistPath = getResourcePath(path.join('backend', 'dist', 'voxis_backend'));
      const execName = process.platform === 'win32' ? 'voxis_backend.exe' : 'voxis_backend';
      const execPath = path.join(backendDistPath, execName);

      if (fs.existsSync(execPath)) {
        console.log('[VOXIS] Found bundled backend executable:', execPath);
        startCmd = execPath;
        startArgs = [];
        startOptions = { cwd: backendDistPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT, VOXIS_ROOT_PATH: backendDistPath } };
      } else {
        // Fallback to python script if executable not found (or legacy build)
        console.log('[VOXIS] Bundled executable not found, falling back to python script');
        startCmd = pythonCmd;
        startArgs = [path.join(backendPath, 'server.py')];
        startOptions = { cwd: backendPath, env: { ...process.env, VOXIS_PORT: BACKEND_PORT } };
      }
    }
    
    console.log(`[VOXIS] Spawning backend: ${startCmd} ${startArgs.join(' ')}`);
    backendProcess = spawn(startCmd, startArgs, startOptions);
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data}`);
    });
    
    backendProcess.on('error', (err) => {
      console.error('[VOXIS] Failed to start backend:', err);
      reject(err);
    });
    
    backendProcess.on('exit', (code) => {
      console.log(`[VOXIS] Backend exited with code ${code}`);
      backendProcess = null;
    });
    
    // Wait for backend to be ready
    waitForBackend(60000)
      .then(resolve)
      .catch(reject);
  });
}

function waitForBackend(timeoutMs) {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Backend startup timeout'));
        return;
      }
      
      http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('[VOXIS] Backend is ready');
          resolve();
        } else {
          setTimeout(check, 500);
        }
      }).on('error', () => {
        setTimeout(check, 500);
      });
    };
    
    setTimeout(check, 1000); // Initial delay
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[VOXIS] Stopping backend...');
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${backendProcess.pid} /T /F`);
    } else {
      backendProcess.kill('SIGTERM');
    }
    backendProcess = null;
  }
}

// =============================================================================
// IPC HANDLERS
// =============================================================================

ipcMain.handle('get-backend-status', async () => {
  try {
    const response = await fetch(`http://localhost:${BACKEND_PORT}/api/health`);
    const data = await response.json();
    return { online: true, data };
  } catch {
    return { online: false };
  }
});

ipcMain.handle('restart-backend', async () => {
  stopBackend();
  await new Promise(r => setTimeout(r, 1000));
  return startBackend();
});

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  isDev
}));

// =============================================================================
// APP LIFECYCLE
// =============================================================================

app.whenReady().then(async () => {
  createSplashWindow();
  
  try {
    await startBackend();
    createMainWindow();
  } catch (err) {
    console.error('[VOXIS] Startup failed:', err);
    dialog.showErrorBox('VOXIS Startup Error', 
      'Failed to start the audio processing backend.\n\n' +
      'Please ensure Python 3.9+ and FFmpeg are installed.\n\n' +
      `Error: ${err.message}`
    );
    if (splashWindow) splashWindow.close();
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[VOXIS] Uncaught exception:', err);
  stopBackend();
});
