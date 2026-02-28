#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  VOXIS Auto-Installer v4.0.0 — macOS Desktop Setup
#  Powered by Trinity v8.1 | Built by Glass Stone
#  Copyright (c) 2026 Glass Stone. All rights reserved.
#
#  Usage:
#    Simply double-click "Install-VOXIS.command" which launches this script.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
APP_NAME="VOXIS"
DMG_PATTERN="VOXIS-*.dmg"
INSTALL_DIR="/Applications"
DRIVE_URL="https://drive.google.com/drive/folders/1aOCz4ElOn6vS007eRpkm0TfiVeyAUn_o?usp=sharing"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────────
log_header() {
  echo ""
  echo -e "${MAGENTA}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}${BOLD}  VOXIS Web Auto-Installer${NC}"
  echo -e "${MAGENTA}${BOLD}  Powered by Trinity v8.1 | Built by Glass Stone${NC}"
  echo -e "${MAGENTA}${BOLD}  Copyright (c) 2026 Glass Stone. All rights reserved.${NC}"
  echo -e "${MAGENTA}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
  echo ""
}

log_step()    { echo -e "\n${BLUE}▶  $1${NC}"; }
log_ok()      { echo -e "${GREEN}✓  $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
log_error()   { echo -e "${RED}✗  $1${NC}"; }
log_info()    { echo -e "${CYAN}ℹ  $1${NC}"; }
die()         { log_error "$1"; echo ""; read -p "Press Enter to exit..." -r; exit 1; }

# ── Main Script ──────────────────────────────────────────────────────────────

log_header

# 1. Ask for admin permissions if needed for /Applications
if [ ! -w "/Applications" ]; then
    log_info "Administrator privileges are required to install to /Applications."
    sudo -v || die "Failed to get administrator privileges."
fi

# 2. Find Archive
log_step "Looking for downloaded VOXIS archive..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOWNLOADS_DIR="$HOME/Downloads"
DMG_PATH=""

# Check script dir
FOUND_IN_DIR=$(find "$SCRIPT_DIR" -maxdepth 1 -name "$DMG_PATTERN" | head -n 1)
if [ -n "$FOUND_IN_DIR" ]; then
    DMG_PATH="$FOUND_IN_DIR"
    log_ok "Found archive in current folder: $(basename "$DMG_PATH")"
else
    # Check Downloads
    FOUND_IN_DL=$(find "$DOWNLOADS_DIR" -maxdepth 1 -name "$DMG_PATTERN" | sort -r | head -n 1)
    if [ -n "$FOUND_IN_DL" ]; then
        DMG_PATH="$FOUND_IN_DL"
        log_ok "Found archive in Downloads folder: $(basename "$DMG_PATH")"
    fi
fi

if [ -z "$DMG_PATH" ]; then
    log_warn "Could not find the VOXIS dmg file ($DMG_PATTERN)!"
    echo ""
    echo -e "Please download the Mac DMG file from Google Drive:"
    echo -e "${CYAN}👉 $DRIVE_URL${NC}"
    echo ""
    echo -e "${YELLOW}Once downloaded, place the DMG file in the same folder as this script, or leave it in your Downloads folder, and run this setup again.${NC}"
    die "Missing payload."
fi

# 3. Mount DMG
log_step "Mounting DMG and installing..."

MOUNT_POINT=$(mktemp -d)
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet || die "Failed to mount DMG."

APP_SRC=$(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" | head -1)
if [ -z "$APP_SRC" ]; then
    hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    die "No .app found in DMG"
fi

APP_BASENAME=$(basename "$APP_SRC")
INSTALL_DEST="/Applications/$APP_BASENAME"

# 4. Remove prior install
if [ -d "$INSTALL_DEST" ]; then
    log_warn "Removing existing installation..."
    rm -rf "$INSTALL_DEST"
fi

# 5. Copy App
log_info "Copying to /Applications... (This may take a few minutes for the 4GB+ AI models)"
cp -R "$APP_SRC" "/Applications/" || {
    hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    die "Copy failed."
}

# 6. Clear quarantine
log_info "Clearing Gatekeeper quarantine..."
xattr -rd com.apple.quarantine "$INSTALL_DEST" 2>/dev/null || true

# 7. Unmount
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
log_ok "Installation complete."

# 8. Cleanup Prompt
echo ""
read -p "Would you like to delete the massive downloaded DMG file to save space? [Y/n] " REPLY
REPLY="${REPLY:-Y}"
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    log_step "Cleaning up archive..."
    rm -f "$DMG_PATH"
    log_ok "Archive deleted."
fi

# 9. Success & Launch
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓  VOXIS v4.0.0 installed successfully!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

read -p "Launch VOXIS now? [Y/n] " RUN_NOW
RUN_NOW="${RUN_NOW:-Y}"
if [[ "$RUN_NOW" =~ ^[Yy]$ ]]; then
    log_step "Launching VOXIS..."
    open -a "VOXIS" 2>/dev/null || open "$INSTALL_DEST"
fi
