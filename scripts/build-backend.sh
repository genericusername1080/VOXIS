#!/bin/bash
# Build script for VOXIS Backend

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "[VOXIS] Building Backend Executable..."

# Clean previous builds
rm -rf backend/build backend/dist dist build

# Install dependencies if needed
# python3 -m pip install -r backend/requirements.txt

# Prepare bundled binaries
echo "[VOXIS] Bundling binaries..."
mkdir -p backend/bin/mac
mkdir -p backend/bin/win
mkdir -p backend/bin/linux

# On macOS, try to bundle local ffmpeg if available
if [[ "$OSTYPE" == "darwin"* ]]; then
    FFMPEG_PATH=$(which ffmpeg)
    if [ -n "$FFMPEG_PATH" ]; then
        echo "[VOXIS] Found FFmpeg at $FFMPEG_PATH, bundling..."
        cp "$FFMPEG_PATH" backend/bin/mac/
    else
        echo "[WARNING] FFmpeg not found. Please place ffmpeg binary in backend/bin/mac/ manually."
    fi
fi

# Run PyInstaller
# Note: Running from root, output will be in dist/ unless configured otherwise.
# We want output in backend/dist to match our package.json config
# or we move it afterwards.
# Actually, let's run it such that it outputs to backend/dist
python3 -m PyInstaller --clean --distpath backend/dist --workpath backend/build backend/voxis.spec

echo "[VOXIS] Build Complete. Artifact in backend/dist/voxis_backend"
