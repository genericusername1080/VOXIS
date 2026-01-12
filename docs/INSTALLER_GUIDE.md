# VOXIS Desktop Installer Guide

**Powered by Trinity | Built by Glass Stone | Gabriel Rodriguez, CEO 2026**

---

## 📥 Download

### macOS
| Installer | Architecture | Size |
|-----------|--------------|------|
| `VOXIS-1.0.5-arm64.dmg` | Apple Silicon (M1/M2/M3) | ~360 MB |
| `VOXIS-1.0.5.dmg` | Intel Mac | ~365 MB |

### Windows
| Installer | Architecture | Size |
|-----------|--------------|------|
| `VOXIS-Setup-1.0.5.exe` | Windows 10/11 (x64) | ~350 MB |

### Linux
| Installer | Format | Size |
|-----------|--------|------|
| `VOXIS-1.0.5.AppImage` | AppImage | ~350 MB |

---

## 🚀 Installation

### macOS

1. Open the DMG file
2. Drag **VOXIS** to **Applications**
3. **First launch**: Right-click → **Open** (bypasses Gatekeeper)
4. App will automatically start the backend

> **Tip**: If you see "App is damaged", run:
> ```bash
> xattr -cr /Applications/VOXIS.app
> ```

### Windows

1. Run `VOXIS-Setup-1.0.5.exe`
2. Follow the installer wizard
3. Launch from **Start Menu** or **Desktop shortcut**

> **Windows Defender**: Click "More info" → "Run anyway"

### Linux

```bash
chmod +x VOXIS-1.0.5.AppImage
./VOXIS-1.0.5.AppImage
```

---

## ⚙️ System Requirements

### Minimum
- **OS**: macOS 11+, Windows 10, Ubuntu 20.04+
- **RAM**: 8 GB
- **Storage**: 1 GB free space
- **Python**: 3.9+ (must be in PATH)
- **FFmpeg**: Required for audio conversion

### Recommended
- **RAM**: 16 GB
- **CPU**: Apple M1/M2/M3 or Intel i7/AMD Ryzen 7
- **Storage**: SSD with 5 GB free space

---

## 🔧 Installing Prerequisites

### macOS (Homebrew)
```bash
brew install python@3.11 ffmpeg
```

### Windows
1. [Python 3.11](https://www.python.org/downloads/) - Check "Add to PATH"
2. [FFmpeg](https://www.gyan.dev/ffmpeg/builds/) - Add `bin/` to PATH

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3 python3-pip ffmpeg
```

---

## 🏗️ Building from Source

### Prerequisites
- Node.js 18+
- npm 9+

### Build Commands

```bash
# Clone and install
git clone https://github.com/glassstone/voxis.git
cd voxis/installer
npm install

# Build for your platform
npm run build:mac     # macOS (ARM64 + x64)
npm run build:win     # Windows (x64)
npm run build:linux   # Linux (AppImage + deb)
```

### Output
Installers are created in `installer/dist/`:
- `VOXIS-1.0.5-arm64.dmg` (macOS ARM)
- `VOXIS-1.0.5.dmg` (macOS Intel)
- `VOXIS-Setup-1.0.5.exe` (Windows)
- `VOXIS-1.0.5.AppImage` (Linux)

---

## 🔄 CI/CD (GitHub Actions)

Automatic builds are triggered on version tags:

```bash
git tag v1.0.6
git push origin v1.0.6
```

GitHub Actions builds for all platforms and creates a release.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "App is damaged" (macOS) | `xattr -cr /Applications/VOXIS.app` |
| Backend won't start | Ensure Python 3.9+ is in PATH |
| "resampy" module error | Already bundled in v1.0.5+ |
| Port 5001 in use | Kill existing: `lsof -ti:5001 \| xargs kill` |
| Export fails | Install FFmpeg and restart app |
| Windows SmartScreen | Click "More info" → "Run anyway" |
| Black screen on launch | Update to v1.0.5+ (path fix applied) |

---

## 📁 App Data Locations

### macOS
- **App**: `/Applications/VOXIS.app`
- **Logs**: `~/Library/Logs/VOXIS/`
- **Data**: `~/Library/Application Support/VOXIS/`

### Windows
- **App**: `C:\Program Files\VOXIS\`
- **Logs**: `%APPDATA%\VOXIS\logs\`
- **Data**: `%APPDATA%\VOXIS\`

### Linux
- **AppImage**: Wherever you placed it
- **Data**: `~/.config/VOXIS/`
