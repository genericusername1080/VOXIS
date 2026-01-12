#!/bin/bash
# VOXIS Icon Generator
# Converts PNG to platform-specific formats

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$SCRIPT_DIR/../build"
SOURCE_ICON="$BUILD_DIR/icon.png"

echo "🎨 VOXIS Icon Generator"
echo "======================"

# Check source exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Source icon not found: $SOURCE_ICON"
    exit 1
fi

# macOS: Create ICNS
if command -v iconutil &> /dev/null; then
    echo "📦 Creating macOS ICNS..."
    
    ICONSET_DIR="$BUILD_DIR/icon.iconset"
    mkdir -p "$ICONSET_DIR"
    
    # Generate all required sizes
    sips -z 16 16     "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png"
    sips -z 32 32     "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png"
    sips -z 32 32     "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png"
    sips -z 64 64     "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png"
    sips -z 128 128   "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png"
    sips -z 256 256   "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png"
    sips -z 256 256   "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png"
    sips -z 512 512   "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png"
    sips -z 512 512   "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512.png"
    sips -z 1024 1024 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png"
    
    iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
    rm -rf "$ICONSET_DIR"
    
    echo "✅ Created icon.icns"
fi

# Windows ICO: Use ImageMagick if available
if command -v convert &> /dev/null; then
    echo "📦 Creating Windows ICO..."
    
    convert "$SOURCE_ICON" \
        -define icon:auto-resize=256,128,64,48,32,16 \
        "$BUILD_DIR/icon.ico"
    
    echo "✅ Created icon.ico"
else
    echo "⚠️  ImageMagick not found. Install with: brew install imagemagick"
    echo "   Using PNG as fallback (electron-builder will convert)"
fi

# Linux: Copy various sizes
echo "📦 Creating Linux icons..."
mkdir -p "$BUILD_DIR/icons"
for SIZE in 16 32 48 64 128 256 512; do
    sips -z $SIZE $SIZE "$SOURCE_ICON" --out "$BUILD_DIR/icons/${SIZE}x${SIZE}.png" 2>/dev/null || true
done
echo "✅ Created Linux icons"

echo ""
echo "🎉 Icon generation complete!"
ls -la "$BUILD_DIR/"
