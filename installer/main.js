/**
 * VOXIS Desktop Application v4.0.0 Always-On - Main Process
 * Powered by Trinity v8.1 | Built by Glass Stone
 * Copyright (c) 2026 Glass Stone. All rights reserved.
 *
 * Manages:
 * - Application window lifecycle
 * - Python backend process (with VOXIS Sharding)
 * - System tray integration
 * - Auto-updates (future)
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Configuration
const isDev = !app.isPackaged;
const BACKEND_PORT = 5002;
const FRONTEND_PORT = 5173;

// Process references
let mainWindow = null;
let backendProcess = null;
let splashWindow = null;

// =============================================================================
// FIRST-RUN DETECTION
// =============================================================================

function isFirstRun() {
  const marker = path.join(app.getPath('userData'), '.voxis-initialized');
  return !fs.existsSync(marker);
}

function markInitialized() {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(
    path.join(userDataPath, '.voxis-initialized'),
    JSON.stringify({ version: app.getVersion(), date: new Date().toISOString() })
  );
}

async function runFirstTimeSetup() {
  console.log('[VOXIS] First run detected — running setup...');

  // Update splash with setup message
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `document.getElementById('status') && (document.getElementById('status').textContent = 'First-time setup...')`
    ).catch(() => { });
  }

  // Create required user-data directories
  const dirs = [
    path.join(app.getPath('userData'), 'outputs'),
    path.join(app.getPath('userData'), 'uploads'),
    path.join(app.getPath('userData'), 'logs'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  // macOS: remove quarantine flag from ENTIRE backend resources so Gatekeeper
  // doesn't scan every file on first launch (3.3GB — causes multi-minute freeze)
  if (process.platform === 'darwin') {
    const { execSync } = require('child_process');
    const resourceDirs = [
      getResourcePath('backend'),
      getResourcePath(path.join('backend', 'dist', 'voxis_backend')),
      getResourcePath(path.join('backend', 'bin')),
    ];
    for (const dir of resourceDirs) {
      if (fs.existsSync(dir)) {
        try {
          execSync(`xattr -rd com.apple.quarantine "${dir}"`, { stdio: 'ignore', timeout: 60000 });
          console.log(`[VOXIS] Removed quarantine from: ${dir}`);
        } catch (e) {
          console.warn(`[VOXIS] Could not remove quarantine from ${dir}:`, e.message);
        }
      }
    }
    // Ensure backend executable is runnable
    const backendExec = getResourcePath(path.join('backend', 'dist', 'voxis_backend', 'voxis_backend'));
    if (fs.existsSync(backendExec)) {
      try {
        execSync(`chmod +x "${backendExec}"`, { stdio: 'ignore' });
      } catch (e) {
        console.warn('[VOXIS] Could not chmod backend:', e.message);
      }
    }
  }

  markInitialized();
  console.log('[VOXIS] First-time setup complete.');
}

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
    width: 500,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: true,
    vibrancy: 'dark',
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

  // Window show is handled by the startup sequence after backend is ready
  // In dev mode, show immediately since backend is started separately
  if (isDev) {
    mainWindow.once('ready-to-show', () => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    });
  }

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
    } else {
      // Production: Use bundled executable
      const backendDistPath = getResourcePath(path.join('backend', 'dist', 'voxis_backend'));
      const execName = process.platform === 'win32' ? 'voxis_backend.exe' : 'voxis_backend';
      const execPath = path.join(backendDistPath, execName);

      // Add bundled bin to PATH for FFmpeg
      const binPath = getResourcePath(path.join('backend', 'bin'));
      const currentPath = process.env.PATH || '';
      const newPath = `${binPath}${path.delimiter}${currentPath}`;
      console.log('[VOXIS] Adding to PATH:', binPath);

      console.log('[VOXIS] Looking for backend at:', execPath);
      console.log('[VOXIS] resourcesPath:', process.resourcesPath);
      console.log('[VOXIS] backendDistPath:', backendDistPath);

      if (fs.existsSync(execPath)) {
        console.log('[VOXIS] Found bundled backend executable:', execPath);
        startCmd = execPath;
        startArgs = [];
        startOptions = {
          cwd: backendDistPath,
          env: {
            ...process.env,
            VOXIS_PORT: BACKEND_PORT,
            VOXIS_ROOT_PATH: backendDistPath,
            PATH: newPath
          }
        };
      } else {
        // Fallback to python script if executable not found (or legacy build)
        console.log('[VOXIS] Bundled executable not found, falling back to python script');
        startCmd = pythonCmd;
        startArgs = [path.join(backendPath, 'server.py')];
        startOptions = {
          cwd: backendPath,
          env: {
            ...process.env,
            VOXIS_PORT: BACKEND_PORT,
            PATH: newPath
          }
        };
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

    // Wait for backend to be ready (PyInstaller + PyTorch can take 3+ min on first launch)
    waitForBackend(300000)
      .then(resolve)
      .catch(reject);
  });
}

function waitForBackend(timeoutMs) {
  const startTime = Date.now();
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      attempts++;

      if (Date.now() - startTime > timeoutMs) {
        console.error(`[VOXIS] Backend failed to start after ${elapsed}s (${attempts} attempts)`);
        reject(new Error(`Backend startup timeout after ${elapsed}s`));
        return;
      }

      // Log progress every 10 attempts
      if (attempts % 10 === 0) {
        console.log(`[VOXIS] Waiting for backend... (${elapsed}s elapsed, attempt ${attempts})`);
        // Update splash screen if available
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.webContents.executeJavaScript(
            `document.getElementById('status') && (document.getElementById('status').textContent = 'Starting engine... ${elapsed}s')`
          ).catch(() => { });
        }
      }

      http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log(`[VOXIS] Backend is ready (took ${elapsed}s)`);
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      }).on('error', () => {
        setTimeout(check, 1000);
      });
    };

    setTimeout(check, 2000); // Initial delay — let the process start
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
// AUTO-UPDATE SYSTEM
// =============================================================================

function setupAutoUpdater() {
  // Configure updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    console.log('[VOXIS] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[VOXIS] Update available:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[VOXIS] App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[VOXIS] Download progress: ${Math.round(progress.percent)}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[VOXIS] Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[VOXIS] Auto-update error:', err.message);
    // Silently fail — unsigned apps can't auto-update on macOS
  });
}

// IPC: Check for updates
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (err) {
    console.error('[VOXIS] Update check failed:', err.message);
    return { success: false, error: err.message };
  }
});

// IPC: Download update
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Install update and restart
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// IPC: Open releases page (fallback for unsigned apps)
ipcMain.handle('open-releases-page', () => {
  shell.openExternal('https://github.com/genericusername1080/VOXIS/releases');
});

// =============================================================================
// APP LIFECYCLE
// =============================================================================

app.whenReady().then(async () => {
  createSplashWindow();
  setupAutoUpdater();

  try {
    // First-run setup (runs once after install)
    if (!isDev && isFirstRun()) {
      await runFirstTimeSetup();
    }

    // PERFORMANCE: Start backend and pre-create main window in parallel
    // The window stays hidden until backend is ready, but it's already loaded
    const backendReady = startBackend();

    // Pre-create the main window while backend starts (hidden)
    createMainWindow();

    // Wait for backend to be ready
    await backendReady;

    // Show the window now that backend is live
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (err) {
    console.error('[VOXIS] Startup failed:', err);
    dialog.showErrorBox('VOXIS Startup Error',
      'Failed to start the audio processing backend.\n\n' +
      'Please ensure Python 3.9+ and FFmpeg are installed,\n' +
      'or try reinstalling VOXIS from the DMG.\n\n' +
      'If running from the DMG directly, drag VOXIS to\n' +
      'Applications first, then launch from there.\n\n' +
      `Error: ${err.message}`
    );
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Check for updates after window is shown (non-blocking)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => { });
    }, 5000);
  }
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
