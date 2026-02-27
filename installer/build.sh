#!/bin/bash
# VOXIS Installer Build Script (Wrapper)
# Redirects to the main build-all.sh script which handles backend building and dependencies correctly.
#
# Usage: ./build.sh [mac|mac-arm64|mac-x64|win|linux|all]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
PLATFORM=${1:-mac}

echo "═══════════════════════════════════════════════"
echo "  VOXIS Build Wrapper"
echo "  Redirecting to scripts/build-all.sh"
echo "═══════════════════════════════════════════════"

# Normalization removed to allow specific architecture builds
# if [[ "$PLATFORM" == "mac-arm64" ]] || [[ "$PLATFORM" == "mac-x64" ]]; then
#     echo "⚠️  Specific architecture requested ($PLATFORM), but full macOS build will be performed."
#     PLATFORM="mac"
# fi

# Execute the main build script
exec "$PARENT_DIR/scripts/build-all.sh" "$PLATFORM"
