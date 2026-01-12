# VOXIS Audio Restoration System
**Version 1.0.5** | **Powered by Trinity** | **Built by Glass Stone**  
**Gabriel Rodriguez, CEO 2026**

---

## 🎧 What is VOXIS?

VOXIS is a professional audio restoration application with Swiss Design aesthetics. It combines AI-powered denoising, neural upscaling, and spectral analysis into a seamless workflow.

### Deployment Options

| Option | Best For | Get Started |
|--------|----------|-------------|
| **Desktop App** | Local processing, offline use | [Download Installer](#-desktop-installer) |
| **Web/Cloud** | Browser access, GPU acceleration | [Deploy to Cloud](#-cloud-deployment) |
| **Local Dev** | Development, testing | [Run Locally](#-quick-start) |

---

## 💾 Desktop Installer

Download the native app for your platform:

### macOS
| File | Architecture |
|------|--------------|
| `VOXIS-1.0.5-arm64.dmg` | Apple Silicon (M1/M2/M3) |
| `VOXIS-1.0.5.dmg` | Intel Mac |

### Windows
| File | Architecture |
|------|--------------|
| `VOXIS-Setup-1.0.5.exe` | Windows 10/11 (x64) |

> **First Launch (macOS)**: Right-click → Open to bypass Gatekeeper

For build instructions, see [Installer Guide](docs/INSTALLER_GUIDE.md).

---

## ☁️ Cloud Deployment

Deploy VOXIS as a web application with GPU acceleration:

```bash
./deploy-web.sh up prod
```

Features:
- 🖥️ Nginx reverse proxy (port 80/443)
- 🐍 Flask backend with Gunicorn
- ⚡ Optional NVIDIA GPU support
- 📦 Docker containerized

See [Cloud README](cloud/README.md) for full setup.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.9+
- FFmpeg

### One-Command Start
```bash
./run-local.sh
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5001 |
| Health | http://localhost:5001/api/health |

---

## ✨ Trinity Engine

| Feature | Technology | Description |
|---------|------------|-------------|
| **Denoise** | DeepFilterNet | AI noise reduction with 3 profiles |
| **Upscale** | AudioSR | Neural super-resolution (2×/4×) |
| **Export** | FFmpeg | WAV, FLAC, MP3 at broadcast quality |

### Noise Profiles
- **Auto**: Intelligent analysis, balanced results
- **Aggressive**: Maximum noise removal
- **Gentle**: Preserves subtle audio details

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Trinity Technical Docs](docs/TRINITY_TECHNICAL.md) | ML pipeline architecture |
| [User Guide](docs/USER_GUIDE.md) | How to use the app |
| [Installer Guide](docs/INSTALLER_GUIDE.md) | Desktop app installation |
| [Deployment](docs/DEPLOYMENT.md) | Docker, Cloud, Environment |
| [Architecture](docs/ARCHITECTURE.md) | System design |
| [API Reference](docs/API_REFERENCE.md) | REST endpoints |

---

## 🛠 Project Structure

```
VOXIS/
├── backend/          # Flask API + Python processing
├── components/       # React UI components
├── services/         # TypeScript API services
├── installer/        # Electron desktop app
├── cloud/            # GPU cloud deployment
├── docs/             # Documentation
└── run-local.sh      # Development startup
```

---

## 📄 License

MIT © Glass Stone 2026
