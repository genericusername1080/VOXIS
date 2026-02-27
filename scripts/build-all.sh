#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  VOXIS v4.0.0 Always-On Distribution Build Script
#  Powered by Trinity v8.1 | Built by Glass Stone
#  Version: 4.0.0
# ═══════════════════════════════════════════════════════════════════════════════
#
#  Usage: ./build-all.sh [mac|win|linux|all]
#
#  This script builds everything in the correct order:
#    0. Verify AI models and dependencies
#    1. Python backend (PyInstaller)
#    2. React frontend (Vite)
#    3. Electron installer (electron-builder)
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLATFORM=${1:-mac}

# Helper functions
log_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is required but not installed."
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
#  HEADER
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}  VOXIS v4.0.0 Always-On Distribution Build System${NC}"
echo -e "${MAGENTA}  Powered by Trinity v8.1 | Built by Glass Stone${NC}"
echo -e "${MAGENTA}  Copyright (c) 2026 Glass Stone. All rights reserved.${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  PREFLIGHT CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

log_step "PREFLIGHT CHECKS"

cd "$PROJECT_ROOT"
echo "Project root: $PROJECT_ROOT"
echo "Target platform: $PLATFORM"

# Check required tools
check_command python3
check_command npm
check_command node

# Check Python version and venv
if [ -d "backend/venv" ]; then
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        PYTHON_CMD="backend/venv/Scripts/python.exe"
        PIP_CMD="$PYTHON_CMD -m pip"
    else
        PYTHON_CMD="backend/venv/bin/python"
        PIP_CMD="$PYTHON_CMD -m pip"
    fi
    
    if [ ! -f "$PYTHON_CMD" ]; then
        log_warning "venv directory exists but python binary not found. Falling back to system python."
        PYTHON_CMD="python3"
        if command -v pip3 &> /dev/null; then PIP_CMD="pip3"; else PIP_CMD="pip"; fi
    else
        log_info "Using venv Python: $PYTHON_CMD"
    fi
else
    PYTHON_CMD="python3"
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
    else
        log_error "pip/pip3 is required but not installed."
        exit 1
    fi
fi

PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
log_info "Python version: $PYTHON_VERSION"

# Check Node version
NODE_VERSION=$(node --version)
log_info "Node version: $NODE_VERSION"

log_success "All required tools found"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 0: VERIFY AI MODELS
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 0: VERIFY AI MODELS"

# Check for Trinity Denoise (DeepFilterNet) models
if [ -d "backend/models/TrinityDenoise" ] && [ "$(ls -A backend/models/TrinityDenoise 2>/dev/null)" ]; then
    DF_SIZE=$(du -sh backend/models/TrinityDenoise 2>/dev/null | cut -f1)
    log_success "DeepFilterNet models found ($DF_SIZE)"
else
    log_warning "DeepFilterNet models not found"
    log_info "Run: $PYTHON_CMD backend/download_models.py --deepfilternet"
fi

# Check for Trinity Upscale (AudioSR) models (optional, large)
if [ -d "backend/models/TrinityUpscale" ] && [ "$(ls -A backend/models/TrinityUpscale 2>/dev/null)" ]; then
    ASR_SIZE=$(du -sh backend/models/TrinityUpscale 2>/dev/null | cut -f1)
    log_success "AudioSR models found ($ASR_SIZE)"
else
    log_warning "AudioSR models not found (optional, ~9GB)"
    log_info "Models will be downloaded on first use if needed"
fi

# Check for Trinity Restore (VoiceRestore) checkpoint
if [ -f "backend/models/TrinityRestore/voicerestore-1.1.pth" ]; then
    VR_SIZE=$(du -sh backend/models/TrinityRestore/voicerestore-1.1.pth 2>/dev/null | cut -f1)
    log_success "VoiceRestore checkpoint found ($VR_SIZE)"
else
    log_warning "VoiceRestore checkpoint not found (needed for Restore mode)"
    log_info "Download from: https://drive.google.com/drive/folders/1uBJNp4mrPJQY9WEaiTI9u09IsRg1lAPR"
    log_info "Place at: backend/models/TrinityRestore/voicerestore-1.1.pth"
fi

# Check VOXIS Sharding (audio-separator / MDX-NET)
if $PYTHON_CMD -c "from audio_separator.separator import Separator; print('ok')" 2>/dev/null | grep -q "ok"; then
    log_success "VOXIS Sharding (audio-separator) available"
else
    log_warning "VOXIS Sharding (audio-separator) not installed"
    log_info "Install with: pip install audio-separator[cpu]"
fi

# Check TorchCodec (optional)
if $PYTHON_CMD -c "import torchcodec; print('ok')" 2>/dev/null | grep -q "ok"; then
    log_success "TorchCodec available"
else
    log_warning "TorchCodec not available (optional — AudioSR will use fallback)"
    log_info "Install with: pip install torchcodec"
fi

# Verify all required repos are cloned
for REPO_DIR in "backend/audio_noise_reduction" "backend/voicerestore_repo" "backend/uvr5_ui"; do
    if [ -d "$REPO_DIR" ]; then
        log_success "Repo present: $REPO_DIR"
    else
        log_warning "Repo missing: $REPO_DIR"
    fi
done

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1: PREPARE BINARIES
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 1: PREPARE BINARIES"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf backend/build backend/dist

# Create bin directories
mkdir -p backend/bin/{mac,win,linux}

# Bundle FFmpeg based on platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    FFMPEG_PATH=$(which ffmpeg 2>/dev/null || true)
    if [ -n "$FFMPEG_PATH" ] && [ -f "$FFMPEG_PATH" ]; then
        echo "Bundling FFmpeg from: $FFMPEG_PATH"
        cp -f "$FFMPEG_PATH" backend/bin/mac/ 2>/dev/null && log_success "FFmpeg bundled for macOS" || log_warning "Could not copy FFmpeg"
    else
        log_warning "FFmpeg not found in PATH"
        log_info "Install with: brew install ffmpeg"
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    FFMPEG_PATH=$(which ffmpeg.exe 2>/dev/null || true)
    if [ -n "$FFMPEG_PATH" ] && [ -f "$FFMPEG_PATH" ]; then
        echo "Bundling FFmpeg from: $FFMPEG_PATH"
        cp -f "$FFMPEG_PATH" backend/bin/win/ 2>/dev/null && log_success "FFmpeg bundled for Windows" || log_warning "Could not copy FFmpeg"
    else
        log_warning "FFmpeg not found in PATH"
        log_info "Install from: https://ffmpeg.org/download.html or 'winget install ffmpeg'"
    fi
else
    FFMPEG_PATH=$(which ffmpeg 2>/dev/null || true)
    if [ -n "$FFMPEG_PATH" ] && [ -f "$FFMPEG_PATH" ]; then
        echo "Bundling FFmpeg from: $FFMPEG_PATH"
        cp -f "$FFMPEG_PATH" backend/bin/linux/ 2>/dev/null && log_success "FFmpeg bundled for Linux" || log_warning "Could not copy FFmpeg"
    else
        log_warning "FFmpeg not found in PATH"
        log_info "Install with: sudo apt install ffmpeg"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1.5: INSTALL ALL PYTHON DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 1.5: INSTALL ALL PYTHON DEPENDENCIES"

echo "Installing backend requirements..."
$PIP_CMD install -r backend/requirements.txt --quiet
echo "Installing audio-separator for VOXIS Sharding..."
$PIP_CMD install "audio-separator[cpu]" --quiet 2>/dev/null || log_warning "audio-separator install failed (optional)"
echo "Installing AudioSR..."
$PIP_CMD install "audiosr>=0.0.7" --quiet --no-deps 2>/dev/null || log_warning "AudioSR install failed"
echo "Installing TorchCodec (optional)..."
$PIP_CMD install torchcodec --quiet 2>/dev/null || log_warning "TorchCodec install failed (optional — will use fallback)"
log_success "Python dependencies installed"

# Clone required repos if missing
echo "Checking required repositories..."
[ ! -d "backend/audio_noise_reduction" ] && git clone --depth 1 https://github.com/Yazdi9/Audio-Noise-Reduction.git backend/audio_noise_reduction 2>/dev/null || true
[ ! -d "backend/voicerestore_repo" ] && git clone --depth 1 https://github.com/skirdey/voicerestore.git backend/voicerestore_repo 2>/dev/null || true
[ ! -d "backend/uvr5_ui" ] && git clone --depth 1 https://github.com/Eddycrack864/UVR5-UI.git backend/uvr5_ui 2>/dev/null || true
log_success "All repositories verified"

# Download Models
echo "Downloading AI models for offline usage..."
$PYTHON_CMD backend/download_models.py

# Ensure UVR model is present in backend/models/TrinityDense
echo "Checking UVR model..."
mkdir -p backend/models/TrinityDense
$PYTHON_CMD -c "from audio_separator.separator import Separator; Separator(model_file_dir='backend/models/TrinityDense').load_model('UVR-MDX-NET-Voc_FT.onnx')" 2>/dev/null || log_warning "Failed to download UVR model"

# Copy PhaseLimiter binary
echo "Copying PhaseLimiter binary..."
if [ -f "backend/voxis_engine/models/phaselimiter_core/build/bin/phase_limiter" ]; then
    cp "backend/voxis_engine/models/phaselimiter_core/build/bin/phase_limiter" "backend/bin/mac/"
    log_success "PhaseLimiter binary copied to backend/bin/mac/"
else
    log_warning "PhaseLimiter binary not found (mastering will fail)"
fi

log_success "Models and binaries prepared"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2: BUILD PYTHON BACKEND
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 2: BUILD PYTHON BACKEND"

# Ensure PyInstaller is installed
echo "Checking PyInstaller..."
$PIP_CMD install pyinstaller --quiet

# Run PyInstaller
echo "Running PyInstaller (this may take several minutes)..."
$PYTHON_CMD -m PyInstaller --noconfirm --clean --distpath backend/dist --workpath backend/build backend/voxis.spec

# Verify output
if [ -f "backend/dist/voxis_backend/voxis_backend" ] || [ -f "backend/dist/voxis_backend/voxis_backend.exe" ]; then
    BACKEND_SIZE=$(du -sh backend/dist/voxis_backend 2>/dev/null | cut -f1)
    log_success "Backend built successfully ($BACKEND_SIZE)"
else
    log_error "Backend build failed - executable not found"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3: BUILD REACT FRONTEND
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 3: BUILD REACT FRONTEND"

cd "$PROJECT_ROOT"
echo "Installing frontend dependencies..."
npm install --silent

echo "Building frontend..."
npm run build

# Verify output
if [ -f "dist/index.html" ]; then
    FRONTEND_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
    log_success "Frontend built successfully ($FRONTEND_SIZE)"
else
    log_error "Frontend build failed - index.html not found"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4: BUILD ELECTRON INSTALLER
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 4: BUILD ELECTRON INSTALLER ($PLATFORM)"

cd "$PROJECT_ROOT/installer"
echo "Installing Electron dependencies..."
npm install --silent

echo "Building installer for $PLATFORM..."
case $PLATFORM in
    mac)
        npm run build:mac
        ;;
    mac-arm64)
        npm run build:mac-arm64
        ;;
    mac-x64)
        npm run build:mac-x64
        ;;
    win)
        npm run build:win
        ;;
    linux)
        npm run build:linux
        ;;
    all)
        npm run build:all
        ;;
    *)
        log_error "Unknown platform: $PLATFORM"
        echo "Usage: ./build-all.sh [mac|mac-arm64|mac-x64|win|linux|all]"
        exit 1
        ;;
esac

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 5: ORGANIZE RELEASE
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 5: ORGANIZE RELEASE"

cd "$PROJECT_ROOT"
VERSION=$(node -p "require('./package.json').version")
RELEASE_DIR="releases/v$VERSION"

echo "Version: $VERSION"
echo "Release directory: $RELEASE_DIR"

mkdir -p "$RELEASE_DIR"

# Copy installers
echo "Copying installers..."
cp installer/dist/*.dmg "$RELEASE_DIR/" 2>/dev/null || true
cp installer/dist/*.AppImage "$RELEASE_DIR/" 2>/dev/null || true
cp installer/dist/*.exe "$RELEASE_DIR/" 2>/dev/null || true
cp installer/dist/*.deb "$RELEASE_DIR/" 2>/dev/null || true
cp installer/dist/*.rpm "$RELEASE_DIR/" 2>/dev/null || true
cp installer/dist/*.zip "$RELEASE_DIR/" 2>/dev/null || true

# Create combined archive
echo "Creating archive..."
cd "$RELEASE_DIR"
if ls *.dmg *.AppImage *.exe 2>/dev/null; then
    zip -j "VOXIS-Installers-$VERSION.zip" *.dmg *.AppImage *.exe 2>/dev/null || \
    zip -j "VOXIS-Installers-$VERSION.zip" *.dmg *.AppImage 2>/dev/null || \
    zip -j "VOXIS-Installers-$VERSION.zip" *.dmg 2>/dev/null || \
    log_warning "Could not create combined archive"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  COMPLETE
# ═══════════════════════════════════════════════════════════════════════════════

log_step "BUILD COMPLETE"

cd "$PROJECT_ROOT"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  VOXIS v$VERSION Distribution Build Complete!${NC}"
echo -e "${GREEN}  Copyright (c) 2026 Glass Stone. All rights reserved.${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Release artifacts in: $RELEASE_DIR"
echo ""
ls -lh "$RELEASE_DIR" 2>/dev/null || true
echo ""

# Print summary
echo -e "${CYAN}Summary:${NC}"
echo -e "  Backend:    $(du -sh backend/dist/voxis_backend 2>/dev/null | cut -f1 || echo 'N/A')"
echo -e "  Frontend:   $(du -sh dist 2>/dev/null | cut -f1 || echo 'N/A')"
echo -e "  Installers: $(du -sh installer/dist 2>/dev/null | cut -f1 || echo 'N/A')"
echo ""

log_success "All done! 🎉"
