# VOXIS Build System

## Quick Start

```bash
# Build everything for macOS
./scripts/build-all.sh mac

# Build for all platforms
./scripts/build-all.sh all
```

## What Gets Built

| Step | Output |
|------|--------|
| 1. Backend | `backend/dist/voxis_backend/` |
| 2. Frontend | `dist/` |
| 3. Installer | `installer/dist/` |
| 4. Release | `releases/v{VERSION}/` |

## Requirements

- Python 3.11+
- Node.js 18+
- FFmpeg (optional, for audio)

## Platforms

| Command | Output |
|---------|--------|
| `./scripts/build-all.sh mac` | `.dmg` files |
| `./scripts/build-all.sh linux` | `.AppImage` files |
| `./scripts/build-all.sh win` | `.exe` files |
| `./scripts/build-all.sh all` | All of the above |
