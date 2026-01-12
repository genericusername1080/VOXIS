#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  VOXIS Complete Build Script
#  Powered by Trinity | Built by Glass Stone
# ═══════════════════════════════════════════════════════════════════════════════
#
#  Usage: ./build-all.sh [mac|win|linux|all]
#
#  This script builds everything in the correct order:
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

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is required but not installed."
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
#  PREFLIGHT CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

log_step "PREFLIGHT CHECKS"

cd "$PROJECT_ROOT"
echo "Project root: $PROJECT_ROOT"

# Check required tools
check_command python3
check_command npm
check_command node

log_success "All required tools found"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1: BUILD PYTHON BACKEND
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 1: BUILD PYTHON BACKEND"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf backend/build backend/dist

# Create bin directories
mkdir -p backend/bin/{mac,win,linux}

# Bundle FFmpeg if available
if [[ "$OSTYPE" == "darwin"* ]]; then
    FFMPEG_PATH=$(which ffmpeg 2>/dev/null || true)
    if [ -n "$FFMPEG_PATH" ] && [ -f "$FFMPEG_PATH" ]; then
        echo "Bundling FFmpeg from: $FFMPEG_PATH"
        cp -f "$FFMPEG_PATH" backend/bin/mac/ 2>/dev/null || log_warning "Could not copy FFmpeg"
    else
        log_warning "FFmpeg not found - audio conversion may not work"
    fi
fi

# Run PyInstaller
echo "Running PyInstaller..."
python3 -m PyInstaller --clean --distpath backend/dist --workpath backend/build backend/voxis.spec

# Verify output
if [ -f "backend/dist/voxis_backend/voxis_backend" ]; then
    log_success "Backend built successfully"
else
    log_error "Backend build failed - executable not found"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2: BUILD REACT FRONTEND
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 2: BUILD REACT FRONTEND"

cd "$PROJECT_ROOT"
echo "Installing frontend dependencies..."
npm install --silent

echo "Building frontend..."
npm run build

# Verify output
if [ -f "dist/index.html" ]; then
    log_success "Frontend built successfully"
else
    log_error "Frontend build failed - index.html not found"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3: BUILD ELECTRON INSTALLER
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 3: BUILD ELECTRON INSTALLER ($PLATFORM)"

cd "$PROJECT_ROOT/installer"
echo "Installing Electron dependencies..."
npm install --silent

echo "Building installer..."
case $PLATFORM in
    mac)
        npm run build:mac
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
        echo "Usage: ./build-all.sh [mac|win|linux|all]"
        exit 1
        ;;
esac

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4: ORGANIZE RELEASE
# ═══════════════════════════════════════════════════════════════════════════════

log_step "STEP 4: ORGANIZE RELEASE"

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

# Create combined archive
echo "Creating archive..."
cd "$RELEASE_DIR"
zip -j "VOXIS-Installers-$VERSION.zip" *.dmg *.AppImage *.exe 2>/dev/null || \
zip -j "VOXIS-Installers-$VERSION.zip" *.dmg *.AppImage 2>/dev/null || \
log_warning "Could not create archive"

# ═══════════════════════════════════════════════════════════════════════════════
#  COMPLETE
# ═══════════════════════════════════════════════════════════════════════════════

log_step "BUILD COMPLETE"

cd "$PROJECT_ROOT"
echo ""
echo "Release artifacts in: $RELEASE_DIR"
echo ""
ls -lh "$RELEASE_DIR" 2>/dev/null || true
echo ""
log_success "All done!"
