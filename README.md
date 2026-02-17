# VOXIS 3.2 Dense
**Powered by Trinity v7** | **Built by Glass Stone**
**Gabriel Rodriguez, CEO 2026**

---

## What is VOXIS 3.2 Dense?

VOXIS 3.2 Dense is a professional audio restoration application built with Swiss Design principles. It combines the Dense Source Separator (UVR5), Dense Neural Filter (DeepFilterNet), and Dense Diffusion Upscaler (AudioSR) into a 7-step pipeline for broadcast-quality results.

### Pipeline

```
UPLOAD → INGEST → ANALYSIS → DENSE (UVR5) → DENOISE → UPSCALE → EXPORT
```

### Processing Modes

| Mode | Description |
|------|-------------|
| **Standard** | Diffusion-based restoration — DeepFilterNet + AudioSR (default) |
| **Extreme** | Full UVR5 separation + maximum noise reduction + aggressive upscale |

---

## Desktop Installer

Download the native app for your platform:

### macOS
| File | Architecture |
|------|--------------|
| `VOXIS-Dense-3.2.0-arm64.dmg` | Apple Silicon (M1/M2/M3/M4) |
| `VOXIS-Dense-3.2.0.dmg` | Intel Mac |

### Windows
| File | Architecture |
|------|--------------|
| `VOXIS-Dense-Setup-3.2.0.exe` | Windows 10/11 (x64) |

> **First Launch (macOS)**: Right-click → Open to bypass Gatekeeper

For build instructions, see [Installer Guide](docs/INSTALLER_GUIDE.md).

---

## Cloud Deployment

Deploy VOXIS Dense as a web application with GPU acceleration:

```bash
./deploy-web.sh up prod
```

See [Cloud README](cloud/README.md) for full setup.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.9+
- FFmpeg

### Install & Run

```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
```

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

## Trinity v7 Engine

| Model | Engine | Description |
|-------|--------|-------------|
| **Dense Spectrum Analyzer** | noisereduce | Spectral noise profiling |
| **Dense Source Separator** | UVR5 / audio-separator | Source separation and vocal isolation |
| **Dense Neural Filter** | DeepFilterNet | AI noise reduction (HIGH mode, unlimited attenuation) |
| **Dense Diffusion Upscaler** | AudioSR | Neural super-resolution (48kHz, 2ch, 24-bit) |
| **Dense Audio Encoder** | FFmpeg | WAV, FLAC, MP3 320kbps |

### Output Specs
- Sample rate: 48,000 Hz
- Channels: 2 (stereo)
- Bit depth: 24-bit PCM
- Formats: WAV, FLAC, MP3

---

## Documentation

| Document | Description |
|----------|-------------|
| [Trinity v7 Technical PDF](docs/Trinity_V7_Technical_Documentation.pdf) | Full ML pipeline architecture and specs |
| [Trinity Technical (MD)](docs/TRINITY_TECHNICAL.md) | Technical reference (markdown) |
| [Installer Guide](docs/INSTALLER_GUIDE.md) | Desktop app installation |
| [API Reference](docs/API_REFERENCE.md) | REST endpoints |

---

## Project Structure

```
VOXIS/
├── backend/          # Flask API + Python audio pipeline
│   ├── server.py     # REST API server
│   ├── pipeline.py   # Audio processing pipeline
│   └── config.py     # Backend configuration
├── components/       # React UI components (Swiss Design)
├── services/         # TypeScript API service
├── installer/        # Electron desktop app (macOS/Windows/Linux)
├── cloud/            # GPU cloud deployment (Docker)
├── docs/             # Documentation
├── App.tsx           # Main React application
├── types.ts          # TypeScript type definitions
├── index.html        # Entry point
└── run-local.sh      # Development startup
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6
- **Backend**: Python 3.9+, Flask, PyTorch
- **Desktop**: Electron 39, electron-builder
- **Design**: Swiss Design System (Inter + JetBrains Mono)
- **AI/ML**: Dense Neural Filter (DeepFilterNet), Dense Diffusion Upscaler (AudioSR), Dense Source Separator (UVR5)

---

## License

MIT (c) Glass Stone 2026
