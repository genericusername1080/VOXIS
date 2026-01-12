# Trinity V5.1

## ML & Deep Learning Audio Pipeline
### Technical Documentation

---

> ⚠️ **ALPHA VERSION - PLEASE TAKE NOTE**

**Glass Stone LLC | Glass Stone Research**  
Built by Gabriel B. Rodriguez, CEO  

Version 5.1.0a (ALPHA)  
Last Updated: January 11, 2026

*Runs in Cloud | macOS | Windows*

---

## ⚠️ IMPORTANT NOTICE - ALPHA SOFTWARE

**This software is currently in ALPHA status. Please take note:**

Trinity V5.1.0a is under active development and testing. While functional and performant, users should be aware:

- Features and APIs may change without notice
- Production deployments should include thorough testing
- Performance characteristics may vary across platforms
- Bug reports and feedback are actively encouraged
- Not all features are fully optimized for all platforms

**For production-critical applications, please contact Glass Stone Research for enterprise support and stability guarantees.**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
   - 2.1 Purpose and Scope
   - 2.2 Design Philosophy
   - 2.3 Version History
3. [Architecture](#3-architecture)
4. [Core Components](#4-core-components)
5. [Machine Learning Models](#5-machine-learning-models)
6. [Processing Pipeline](#6-processing-pipeline)
7. [Technical Specifications](#7-technical-specifications)
8. [Voxis Integration](#8-voxis-integration)
9. [Performance Metrics](#9-performance-metrics)
10. [API Reference](#10-api-reference)
11. [Deployment Guide](#11-deployment-guide)
12. [Troubleshooting](#12-troubleshooting)
13. [Future Roadmap](#13-future-roadmap)
14. [References](#14-references)

---

## 1. Executive Summary

Trinity V5.1 represents Glass Stone LLC's flagship ML-powered audio processing pipeline, designed to deliver professional-grade vocal enhancement through advanced deep learning techniques. As the core engine powering Voxis, Trinity processes audio through a multi-stage pipeline optimized for real-world scenarios including church acoustics, podcast production, conference recordings, and multimedia content creation.

### Key Capabilities:

- Adaptive noise reduction using custom-trained ML models
- Intelligent vocal isolation across diverse acoustic environments
- Audio restoration for damaged or degraded recordings
- Real-time spectrum analysis and adaptive EQ
- Support for both male and female vocal profiles
- GPU-accelerated processing for large-scale workloads
- Cross-platform deployment: Cloud, macOS, Windows

---

## 2. System Overview

### 2.1 Purpose and Scope

Trinity V5.1 serves as the backend audio processing engine for Voxis, a cloud-deployed audio enhancement solution. The pipeline addresses the fundamental challenge of extracting clean, intelligible vocal content from recordings captured in sub-optimal acoustic environments.

#### Deployment Flexibility:

Trinity V5.1 is designed to run across multiple platforms:

- **Cloud Deployment:** AWS, Google Cloud, Azure with GPU acceleration
- **macOS:** Native support for Apple Silicon (M1/M2/M3) and Intel-based Macs
- **Windows:** Windows 10/11 with CUDA GPU support or CPU-only mode

This cross-platform capability ensures Trinity can be deployed in enterprise data centers, edge computing environments, or on individual workstations depending on workflow requirements.

### 2.2 Design Philosophy

The Trinity architecture follows three core principles:

1. **Separation of Concerns:** Spectrum analysis operates independently from ML denoising, allowing modular optimization
2. **Model Efficiency:** Neural architectures optimized for inference speed without sacrificing quality
3. **Scalability:** Designed for both edge deployment and cloud-scale processing

### 2.3 Version History

- **v5.0.x:** Initial production release with DeepFilterNet integration
- **v5.1.0a:** Current version featuring enhanced spectrum analyzer and expanded training dataset

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TRINITY V5.1 PIPELINE                │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              STAGE 1: SPECTRUM ANALYSIS                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Custom Spectrum Analyzer                         │  │
│  │  • FFT-based frequency decomposition              │  │
│  │  • Dynamic range analysis                         │  │
│  │  • Vocal formant detection                        │  │
│  │  • Noise floor estimation                         │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              STAGE 2: ML DENOISING                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Custom-Trained Denoiser                          │  │
│  │  • U-Net based architecture                       │  │
│  │  • Trained on 200+ hours of vocal data            │  │
│  │  • Multi-scenario conditioning                    │  │
│  │  • Gender-adaptive processing                     │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│            STAGE 3: VOCAL ISOLATION                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Source Separation Engine                         │  │
│  │  • Deep learning-based stem extraction            │  │
│  │  • Adaptive spectral gating                       │  │
│  │  • Harmonic-percussive separation                 │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              STAGE 4: RESTORATION                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Audio Enhancement Suite                          │  │
│  │  • Super-resolution upsampling (AudioSR)          │  │
│  │  • Artifact reduction                             │  │
│  │  • Dynamic range optimization                     │  │
│  │  • Spectral balancing                             │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              STAGE 5: OUTPUT GENERATION                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Format Conversion & Export                       │  │
│  │  • Multi-format support (WAV, MP3, FLAC)          │  │
│  │  • Bitrate optimization                           │  │
│  │  • Metadata preservation                          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Component Interaction

The Trinity pipeline operates as a sequential processing chain where each stage receives the output of the previous stage. However, the spectrum analyzer operates independently and provides metadata that conditions downstream ML models rather than directly modifying the audio stream.

---

## 4. Core Components

### 4.1 Spectrum Analyzer Module

**Purpose:** Provides detailed frequency-domain analysis to inform downstream processing decisions.

#### Technical Implementation:

- **Algorithm:** Short-Time Fourier Transform (STFT) with Hann windowing
- **Window Size:** Configurable, default 2048 samples
- **Hop Length:** 512 samples (75% overlap)
- **Frequency Resolution:** 21.5 Hz at 44.1kHz sample rate
- **Output:** JSON metadata containing spectral features

#### Key Features:

- Real-time fundamental frequency (F0) tracking
- Formant frequency extraction for vocal characterization
- Noise floor estimation using percentile-based statistical methods
- Spectral centroid and bandwidth computation
- Harmonic-to-noise ratio (HNR) calculation

### 4.2 ML Denoiser

**Architecture:** Modified U-Net with attention mechanisms

#### Model Specifications:

| Specification | Value |
|---------------|-------|
| Framework | PyTorch 2.0+ |
| Input | Magnitude spectrogram (STFT) |
| Output | Denoised magnitude spectrogram |
| Parameters | ~12.4M trainable parameters |
| Inference Time | 1.2x real-time (CPU), 8.5x (NVIDIA T4 GPU) |

#### Training Dataset:

The denoiser was trained on a comprehensive dataset encompassing:

- **Total Duration:** 200+ hours of labeled audio
- **Recording Environments:**
  - Studio recordings (clean baseline)
  - Conference rooms with HVAC noise
  - Church sanctuaries with reverb and ambient noise
  - Outdoor environments (wind, traffic)
  - Home offices with background activity
  - Classroom and lecture hall acoustics
- **Gender Representation:**
  - Male voices: 52% of training data
  - Female voices: 48% of training data
  - Age range: 18-75 years

#### Performance Metrics:

- **PESQ:** 3.85 (Mean Opinion Score equivalent)
- **STOI:** 0.94 (Short-Time Objective Intelligibility)
- **SI-SDR:** 18.2 dB improvement over noisy input

---

## 7. Technical Specifications

### 7.1 System Requirements

#### Cloud Deployment

- **AWS:** p3.2xlarge, g4dn.xlarge, or g5.xlarge instances
- **Google Cloud:** n1-standard-4 with NVIDIA T4 or A100
- **Azure:** NC6s_v3 with Tesla V100 or NVv4-series
- **OS:** Ubuntu 20.04+, Container-Optimized OS
- **Container Runtime:** Docker 24+ with NVIDIA Container Toolkit

#### macOS (Local)

| Platform | Requirements |
|----------|--------------|
| **Apple Silicon (M1/M2/M3)** | RAM: 16GB min, 32GB recommended • Storage: 20GB free SSD • macOS: 12.0 (Monterey) or later • GPU: Metal Performance Shaders |
| **Intel Mac** | CPU: Intel Core i7 8th gen+ • RAM: 16GB min, 32GB recommended • Storage: 20GB free SSD • macOS: 11.0 (Big Sur) or later • Note: CPU-only (no GPU acceleration) |

#### Windows (Local)

| Configuration | Requirements |
|---------------|--------------|
| **With NVIDIA GPU** | GPU: NVIDIA 8GB+ VRAM (RTX 2060+) • CUDA: 12.1+ with compatible drivers • CPU: Intel Core i5 10th gen / AMD Ryzen 5 5000 • RAM: 16GB min, 32GB recommended • Storage: 20GB free SSD • OS: Windows 10 (19041+) or Windows 11 |
| **CPU-Only Mode** | CPU: Intel Core i7 10th gen / AMD Ryzen 7 5000 • RAM: 16GB minimum • Storage: 20GB free SSD • OS: Windows 10 (19041+) or Windows 11 |

### 7.2 Performance Benchmarks

| File Length | CPU (i7-10700) | GPU (RTX 3060) | GPU (T4) | Apple M1 |
|-------------|----------------|----------------|----------|----------|
| 1 minute | 72 seconds | 8 seconds | 12 seconds | 25 seconds |
| 10 minutes | 12 minutes | 1.2 minutes | 1.8 minutes | 4 minutes |
| 1 hour | 72 minutes | 7 minutes | 11 minutes | 24 minutes |

*Benchmarks include all pipeline stages with default settings*

---

## 11. Deployment Guide

### 11.1 Cloud Deployment (Docker)

Trinity is distributed as a Docker container for consistent deployment:

#### Pull Image:
```bash
docker pull glasstonellc/voxis:latest
```

#### Run Container:
```bash
docker run -d \
  --name voxis \
  --gpus all \
  -p 5001:5001 \
  -v /path/to/audio:/app/audio \
  -e VOXIS_GPU_ENABLED=true \
  glasstonellc/voxis:latest
```

### 11.2 macOS Local Installation

#### Prerequisites:
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python 3.10+
brew install python@3.10

# Install system dependencies
brew install ffmpeg portaudio
```

#### Install Trinity:
```bash
# Clone repository
git clone https://github.com/glasstonellc/trinity.git
cd trinity

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Download model weights
python scripts/download_models.py
```

#### Apple Silicon (M1/M2/M3) Optimization:
```bash
# Install Metal Performance Shaders support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Enable MPS acceleration (automatic on supported hardware)
export PYTORCH_ENABLE_MPS_FALLBACK=1
```

#### Run Trinity on macOS:
```bash
# CPU mode
python trinity_cli.py --input audio.wav --output clean.wav

# MPS mode (Apple Silicon)
python trinity_cli.py --input audio.wav --output clean.wav --device mps
```

### 11.3 Windows Local Installation

#### Prerequisites:

1. Install [Python 3.10+](https://www.python.org/downloads/windows/) - Check "Add Python to PATH" during installation
2. Install [FFmpeg](https://ffmpeg.org/download.html#build-windows) - Extract to C:\ffmpeg and add to PATH
3. (Optional) Install [NVIDIA CUDA Toolkit 12.1+](https://developer.nvidia.com/cuda-downloads)

#### Install Trinity:
```powershell
# Open PowerShell as Administrator

# Clone repository
git clone https://github.com/glasstonellc/trinity.git
cd trinity

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install Python dependencies
pip install -r requirements.txt

# For GPU support, install CUDA-enabled PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Download model weights
python scripts\download_models.py
```

#### Run Trinity on Windows:
```powershell
# CPU mode
python trinity_cli.py --input audio.wav --output clean.wav

# GPU mode (if CUDA available)
python trinity_cli.py --input audio.wav --output clean.wav --device cuda
```

#### Windows-Specific Notes:

- Long path support may need to be enabled in Windows Registry
- Windows Defender may flag model downloads - add exclusion for Trinity directory
- GPU acceleration requires compatible NVIDIA drivers (version 525+)

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | TRINITY-TECH-DOC-5.1.0a-ALPHA |
| Revision | 1.1 |
| Author | Gabriel B. Rodriguez, CEO |
| Organization | Glass Stone LLC / Glass Stone Research |
| Created | November 5, 2025 |
| Last Updated | January 11, 2026 |
| Status | Alpha Documentation |

---

**Copyright © 2026 Glass Stone LLC | Glass Stone Research. All rights reserved.**

*This documentation is proprietary and confidential. Unauthorized distribution is prohibited.*
