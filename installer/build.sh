#!/bin/bash
# VOXIS Installer Build Script
# Builds the main app, then packages it as an Electron installer

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

echo "═══════════════════════════════════════════════"
echo "  VOXIS Desktop Installer Build"
echo "  Powered by Trinity | Built by Glass Stone"
echo "═══════════════════════════════════════════════"
echo ""

# Step 1: Build the React frontend
echo "📦 Building React frontend..."
cd "$PARENT_DIR"
npm run build
echo "✅ Frontend built"

# Step 2: Install installer dependencies
echo ""
echo "📦 Installing Electron dependencies..."
cd "$SCRIPT_DIR"
npm install
echo "✅ Dependencies installed"

echo ""
echo "📦 Bundling FFmpeg..."
bash "$PARENT_DIR/scripts/install_ffmpeg.sh"


# Step 3: Build for target platform
PLATFORM=${1:-mac}
echo ""
echo "🔨 Building for: $PLATFORM"

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
    echo "❌ Unknown platform: $PLATFORM"
    echo "Usage: ./build.sh [mac|win|linux|all]"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Build Complete!"
echo "  Output: $SCRIPT_DIR/dist/"
echo "═══════════════════════════════════════════════"
ls -lh "$SCRIPT_DIR/dist/"
