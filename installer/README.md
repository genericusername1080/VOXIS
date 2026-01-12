# VOXIS Desktop Installer

**Standalone Electron installer for VOXIS Audio Restoration**

Powered by Trinity | Built by Glass Stone | Gabriel Rodriguez, CEO 2026

## Quick Start

```bash
# Install dependencies
npm install

# Build the main app first (from parent directory)
cd .. && npm run build && cd installer

# Build installer for your platform
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
npm run build:all      # All platforms
```

## Output

Installers are created in `dist/`:

| Platform | Files |
|----------|-------|
| macOS | `VOXIS-1.0.5.dmg`, `VOXIS-1.0.5-mac.zip` |
| Windows | `VOXIS Setup 1.0.5.exe`, `VOXIS 1.0.5.exe` (portable) |
| Linux | `VOXIS-1.0.5.AppImage`, `voxis_1.0.5_amd64.deb` |

## Prerequisites

Users need to install:
- Python 3.9+
- FFmpeg

## Structure

```
installer/
├── main.js          # Electron main process
├── preload.js       # IPC bridge
├── splash.html      # Loading screen
├── assets/          # Icons and backgrounds
├── package.json     # Build configuration
└── dist/            # Built installers (after build)
```
