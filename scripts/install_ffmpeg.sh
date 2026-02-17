#!/bin/bash
# Install FFmpeg static build via npm
# Powered by Glass Stone LLC 2026

set -e

# Configuration
TARGET_DIR="$(pwd)/backend/bin"
mkdir -p "$TARGET_DIR"

echo "📦 Installing FFmpeg from npm package..."

# Check if ffmpeg-static is available
FFMPEG_PATH="$(pwd)/installer/node_modules/ffmpeg-static/ffmpeg"

if [ ! -f "$FFMPEG_PATH" ]; then
    echo "⚠️ ffmpeg-static not found globally, checking local installer..."
    cd installer
    npm install ffmpeg-static
    cd ..
fi

# Determine source path based on OS (npm package structure)
# The binary is usually at node_modules/ffmpeg-static/ffmpeg (a wrapper script?) 
# actually it points to the binary.
# Let's verify where it is.
# Using node to find it is properly reliable.

echo "🔍 Locating FFmpeg binary..."
FFMPEG_BIN=$(node -e 'console.log(require("./installer/node_modules/ffmpeg-static"))')

if [ -z "$FFMPEG_BIN" ]; then
    echo "❌ Could not locate ffmpeg binary from ffmpeg-static package"
    exit 1
fi

echo "📋 Copying from $FFMPEG_BIN..."
cp "$FFMPEG_BIN" "$TARGET_DIR/ffmpeg"

chmod +x "$TARGET_DIR/ffmpeg"
echo "✅ FFmpeg installed to $TARGET_DIR/ffmpeg"
"$TARGET_DIR/ffmpeg" -version | head -n 1
