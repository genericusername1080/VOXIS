# ═══════════════════════════════════════════════════════════════════════════════
#  VOXIS Auto-Installer v4.0.0 — Windows Desktop Setup
#  Powered by Trinity v8.1 | Built by Glass Stone
#  Copyright (c) 2026 Glass Stone. All rights reserved.
#
#  Usage:
#    Simply double-click "Install-VOXIS.bat" which launches this script.
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# ── Config ───────────────────────────────────────────────────────────────────
$AppName        = "VOXIS"
$ZipPattern     = "VOXIS-windows-x64*.zip"
$InstallDir     = "$env:LOCALAPPDATA\Programs\$AppName"
# The provided Google Drive link goes to a folder, so we advise the user to download the ZIP directly.
$DriveFolderUrl = "https://drive.google.com/drive/folders/1aOCz4ElOn6vS007eRpkm0TfiVeyAUn_o?usp=sharing"

# ── Helpers ──────────────────────────────────────────────────────────────────
function Write-Header {
  Write-Host ""
  Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Magenta
  Write-Host "  VOXIS Web Auto-Installer" -ForegroundColor Magenta
  Write-Host "  Powered by Trinity v8.1 | Built by Glass Stone" -ForegroundColor Magenta
  Write-Host "  Copyright (c) 2026 Glass Stone. All rights reserved." -ForegroundColor Magenta
  Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Magenta
  Write-Host ""
}

function Write-Step   { param($msg) Write-Host "▶  $msg" -ForegroundColor Blue }
function Write-Ok     { param($msg) Write-Host "✓  $msg" -ForegroundColor Green }
function Write-Warn   { param($msg) Write-Host "⚠  $msg" -ForegroundColor Yellow }
function Write-Info   { param($msg) Write-Host "ℹ  $msg" -ForegroundColor Cyan }
function Write-Err    { param($msg) Write-Host "✗  $msg" -ForegroundColor Red }
function Fail         { param($msg) Write-Err $msg; Write-Host "`nPress any key to exit..."; $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown"); exit 1 }

# ── Detect Local Archive ─────────────────────────────────────────────────────────
function Find-Archive {
  Write-Step "Looking for downloaded VOXIS archive..."
  
  # Check current directory where script is running
  $LocalZip = Get-ChildItem -Path ".\" -Filter $ZipPattern -File | Select-Object -First 1
  if ($LocalZip) {
      Write-Ok "Found archive in current folder: $($LocalZip.Name)"
      return $LocalZip.FullName
  }

  # Check Downloads folder
  $DownloadsPath = [System.Environment]::GetFolderPath('UserProfile') + "\Downloads"
  $DownloadZip = Get-ChildItem -Path $DownloadsPath -Filter $ZipPattern -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($DownloadZip) {
      Write-Ok "Found archive in Downloads folder: $($DownloadZip.Name)"
      return $DownloadZip.FullName
  }

  return $null
}

# ── Extract ──────────────────────────────────────────────────────────────────
function Extract-Voxis {
  param($ZipPath)

  Write-Step "Extracting VOXIS to $InstallDir..."
  Write-Info "Please wait, this will take a few minutes for the 4GB+ AI models..."

  # Remove old installation if exists
  if (Test-Path $InstallDir) {
      Write-Info "Removing previous installation..."
      Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

  # Using Expand-Archive
  try {
      Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
  } catch {
      Fail "Extraction failed: $($_.Exception.Message)"
  }

  $ExePath = Join-Path $InstallDir "win-unpacked\VOXIS.exe"
  if (-not (Test-Path $ExePath)) {
      # Sometimes the zip structure is flat
      $ExePath = Join-Path $InstallDir "VOXIS.exe"
      if (-not (Test-Path $ExePath)) {
          Write-Warn "Extraction finished, but could not immediately locate VOXIS.exe"
          return $InstallDir
      }
  }

  Write-Ok "Extraction complete."
  return $ExePath
}

# ── Create Shortcuts ─────────────────────────────────────────────────────────
function Create-Shortcuts {
  param($ExePath)

  Write-Step "Creating Desktop & Start Menu shortcuts..."

  $WshShell = New-Object -comObject WScript.Shell
  
  # Desktop
  $DesktopPath = [System.Environment]::GetFolderPath('Desktop')
  $DesktopShortcut = $WshShell.CreateShortcut( (Join-Path $DesktopPath "VOXIS.lnk") )
  $DesktopShortcut.TargetPath = $ExePath
  $DesktopShortcut.WorkingDirectory = (Split-Path $ExePath)
  $DesktopShortcut.Save()
  Write-Info "Desktop Shortcut created"

  # Start Menu
  $StartMenuPath = Join-Path ([System.Environment]::GetFolderPath('Programs')) "Glass Stone"
  if (-not (Test-Path $StartMenuPath)) { New-Item -ItemType Directory -Force -Path $StartMenuPath | Out-Null }
  $StartMenuShortcut = $WshShell.CreateShortcut( (Join-Path $StartMenuPath "VOXIS.lnk") )
  $StartMenuShortcut.TargetPath = $ExePath
  $StartMenuShortcut.WorkingDirectory = (Split-Path $ExePath)
  $StartMenuShortcut.Save()
  Write-Info "Start Menu Shortcut created"

  Write-Ok "Shortcuts configured."
}

# ── Main ─────────────────────────────────────────────────────────────────────
function Main {
  Write-Header

  # Platform check
  if ($env:OS -ne "Windows_NT") {
    Fail "This script is for Windows only."
  }

  $Archive = Find-Archive
  
  if (-not $Archive) {
      Write-Err "Could not find the VOXIS zip file ($ZipPattern)!"
      Write-Host ""
      Write-Host "Please download the Windows ZIP file from Google Drive:" -ForegroundColor Cyan
      Write-Host "👉 $DriveFolderUrl" -ForegroundColor White
      Write-Host ""
      Write-Host "Once downloaded, place the ZIP file in the same folder as this script, or leave it in your Downloads folder, and run this setup again." -ForegroundColor Yellow
      Fail "Missing payload."
  }

  $ExePath = Extract-Voxis -ZipPath $Archive
  
  if ($ExePath -and (Test-Path $ExePath)) {
      Create-Shortcuts -ExePath $ExePath
  }

  # Cleanup prompt
  Write-Host ""
  $cleanup = Read-Host "Would you like to delete the massive downloaded ZIP file to save space? [Y/n]"
  if ($cleanup -eq "" -or $cleanup -match "^[Yy]") {
      Write-Step "Cleaning up archive..."
      try {
          Remove-Item -Path $Archive -Force
          Write-Ok "Archive deleted."
      } catch {
          Write-Warn "Could not delete archive: $($_.Exception.Message)"
      }
  }

  # Success banner
  Write-Host ""
  Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
  Write-Host "  ✓  VOXIS v4.0.0 installed successfully!" -ForegroundColor Green
  Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
  Write-Host ""
  
  $Answer = Read-Host "Launch VOXIS now? [Y/n]"
  if ($Answer -eq "" -or $Answer -match "^[Yy]") {
      Write-Step "Launching VOXIS..."
      Start-Process -FilePath $ExePath
  }
}

Main
