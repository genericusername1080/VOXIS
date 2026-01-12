# Deployment Guide
**VOXIS v1.0.5**

This guide covers deployment strategies for Local, Docker, and Cloud environments.

## 1. Local Development (macOS/Linux)

The `run-local.sh` script is the primary entry point for development. It handles dependency checks, environment setup, and process monitoring.

```bash
# Start all services (Backend + Frontend)
./run-local.sh
```

**Features:**
- Checks for Node.js, Python 3, and FFmpeg
- Auto-installs FFmpeg if missing (via brew/apt/dnf)
- Sets up Python venv
- Starts Backend (Gunicorn) at port 5001
- Starts Frontend (Vite) at port 5173
- **Watchdog**: Monitors backend health every 30s and restarts if it crashes.

## 2. Docker Deployment

VOXIS is fully containerized.

### Build & Run
```bash
# Build and start services
docker compose up --build -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Docker Structure
- **Backend**: `python:3.11-slim` base. Installs FFmpeg, system libs, and Python dependencies.
- **Frontend**: Currently managed via host or separate build step (for production, typically built to static assets and served via Nginx).

## 3. Production Configuration (Gunicorn)

The backend uses Gunicorn for production-grade performance. Configuration is in `backend/gunicorn.conf.py`.

```python
# Key Settings
bind = "0.0.0.0:5001"
workers = 2              # (2 x CPUs) + 1 recommended
threads = 4              # Threads per worker for concurrent IO
worker_class = "gthread" # Threaded worker for async tasks
timeout = 300            # 5 minute timeout for long processing
```

## 4. Environment Variables

Configure the application via environment variables or `.env` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `VOXIS_ENV` | `production` | Environment mode |
| `VOXIS_PORT` | `5001` | Backend port |
| `VOXIS_HOST` | `0.0.0.0` | Bind address |
| `VOXIS_DEBUG` | `false` | Flask debug mode |
| `VOXIS_UPLOAD_DIR` | `./uploads` | Storage path for uploads |
| `VOXIS_OUTPUT_DIR` | `./outputs` | Storage path for results |
| `VOXIS_MAX_FILE_SIZE` | `524288000` | Max upload size (bytes) |
| `VOXIS_JOB_TIMEOUT` | `24` | Hours to keep files before cleanup |
| `VOXIS_RATE_LIMIT` | `30` | Requests per minute per IP |

## 5. Cloud Deployment (AWS/GCP/Railway)

### Railway / Render / Heroku
1.  Connect your GitHub repository.
2.  Set Build Command: `pip install -r backend/requirements.txt`
3.  Set Start Command: `gunicorn --chdir backend --config backend/gunicorn.conf.py server:app`
4.  Ensure `ffmpeg` is available in the runtime environment (most platforms support this via buildpacks).

### AWS EC2 / DigitalOcean
1.  Provision Ubuntu instance.
2.  Install Docker & Docker Compose.
3.  Clone repo.
4.  Run `docker compose up -d`.
5.  Set up Nginx reverse proxy to map domain -> localhost:5001 / localhost:5173.

## Troubleshooting

- **"FFmpeg not found"**: Ensure `ffmpeg` is installed. Run `brew install ffmpeg` or `sudo apt install ffmpeg`.
- **"Port 5001 in use"**: Kill stale processes using `lsof -ti:5001 | xargs kill -9`.
- **"Upload 413 Error"**: Increase `VOXIS_MAX_FILE_SIZE` or check Nginx `client_max_body_size`.
