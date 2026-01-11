# VOXIS Audio Restoration

**Powered by Trinity | Built by Glass Stone**

Professional audio restoration application following Swiss design principles.

## Features

- **Upload** - Accept any audio format (WAV, MP3, FLAC, OGG, M4A, etc.)
- **Spectrum Analysis** - Using [Yazdi9/Audio-Noise-Reduction](https://github.com/Yazdi9/Audio-Noise-Reduction) spectral gating
- **Denoising** - [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) AI-powered noise suppression (HIGH preset)
- **Upscaling** - [AudioSR](https://github.com/ORI-Muchim/AudioSR-Upsampling) super-resolution to 48kHz stereo
- **Export** - High-quality 24-bit WAV output

## Quick Start

### 1. Backend Setup (Python)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install PyTorch (CPU version)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# For GPU (CUDA 12.1):
# pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install dependencies
pip install -r requirements.txt

# Start server
python server.py
```

Server runs at: http://localhost:5000

### 2. Frontend Setup (Node.js)

```bash
# From project root
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/upload` | POST | Upload audio file |
| `/api/process` | POST | Start processing job |
| `/api/status/<job_id>` | GET | Get job status |
| `/api/download/<job_id>` | GET | Download processed file |

## Processing Pipeline

1. **Upload** → File uploaded to server
2. **Ingest** → Audio decoded and analyzed
3. **Spectrum Analysis** → Noise profile computed using spectral gating
4. **Denoise** → DeepFilterNet removes background noise (adjustable strength)
5. **Upscale** → AudioSR super-resolution to 48kHz
6. **Export** → 24-bit stereo WAV output

## Configuration

### Processing Options

- **Denoise Strength**: 0-100% (default: 75% HIGH)
- **High Precision Mode**: DeepFilterNet3 with advanced masking
- **Upscale Factor**: 1x, 2x, or 4x
- **Target Sample Rate**: 44.1kHz, 48kHz, or 96kHz
- **Output Channels**: Mono or Stereo

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite
- TailwindCSS
- D3.js (visualizations)

**Backend:**
- Python 3.9+
- Flask
- PyTorch
- noisereduce
- DeepFilterNet
- AudioSR (optional)

## License

MIT © Glass Stone

---

*Swiss Audio Architecture • VOXIS v1.0.5*
