# VOXIS Cloud Deployment

**GPU-Accelerated Audio Restoration for Demanding Workloads**

Powered by Trinity | Built by Glass Stone | Gabriel Rodriguez, CEO 2026

---

## Overview

The cloud deployment is designed for:
- 🎧 **Large Files**: Up to 2GB per upload
- ⚡ **GPU Acceleration**: DeepFilterNet + AudioSR on NVIDIA CUDA
- ⏱️ **Long Jobs**: Up to 72-hour processing timeout
- 🌐 **Web Access**: Full browser-based interface

---

## Quick Start

### Prerequisites
- Docker 24+
- Docker Compose v2
- (Optional) NVIDIA GPU with CUDA 12.1+

### Deploy

```bash
cd cloud

# Development mode
./deploy.sh up

# Production mode (with SSL, Redis, scaling)
./deploy.sh up prod
```

### Access
| Service | URL |
|---------|-----|
| Web UI | http://localhost |
| API | http://localhost:5001 |
| Health | http://localhost:5001/api/health |

---

## Commands

| Command | Description |
|---------|-------------|
| `./deploy.sh up` | Start (dev mode) |
| `./deploy.sh up prod` | Start (production) |
| `./deploy.sh down` | Stop services |
| `./deploy.sh logs` | View logs |
| `./deploy.sh build` | Rebuild images |
| `./deploy.sh status` | Check status |
| `./deploy.sh restart` | Restart services |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 NGINX (Port 80/443)             │
│         Serves React Frontend + SSL             │
│         Proxies /api/* to Backend               │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         VOXIS Backend (Port 5001)               │
│    Flask + Gunicorn • 2 Workers • 4 Threads     │
├─────────────────────────────────────────────────┤
│  DeepFilterNet  │  AudioSR  │  FFmpeg  │ NumPy  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                REDIS (Optional)                 │
│              Job Queue + Caching                │
└─────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VOXIS_GPU_ENABLED` | `false` | Enable GPU acceleration |
| `VOXIS_MAX_FILE_SIZE` | `2147483648` | Max upload (2GB) |
| `VOXIS_JOB_TIMEOUT` | `72` | Job timeout in hours |
| `VOXIS_DEBUG` | `false` | Debug mode |

### GPU Support

For NVIDIA GPU acceleration:

1. Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. Verify: `docker run --rm --gpus all nvidia/cuda:12.1.0-base nvidia-smi`
3. Deploy with GPU: `./deploy.sh up prod`

---

## SSL/HTTPS Setup

1. Create `ssl/` directory:
   ```bash
   mkdir -p ssl
   ```

2. Add certificates:
   - `ssl/fullchain.pem`
   - `ssl/privkey.pem`

3. Uncomment HTTPS block in `nginx.conf`

4. Restart:
   ```bash
   ./deploy.sh restart
   ```

---

## Scaling

### Horizontal Scaling
Edit `docker-compose.prod.yml`:
```yaml
backend:
  deploy:
    replicas: 4  # Increase workers
```

### Resource Limits
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 8G
```

---

## Cloud Providers

### AWS EC2
1. Launch GPU instance (p3.2xlarge or g4dn.xlarge)
2. Install Docker + NVIDIA Container Toolkit
3. Clone repo and run `./cloud/deploy.sh up prod`

### Google Cloud
1. Create Compute Engine VM with GPU
2. Use Container-Optimized OS or Ubuntu
3. Install deps and deploy

### DigitalOcean
1. Create GPU Droplet (if available) or CPU Droplet
2. Install Docker Compose
3. Deploy

---

## Monitoring

### Logs
```bash
./deploy.sh logs

# Specific service
docker compose logs -f backend
```

### Health Check
```bash
curl http://localhost:5001/api/health
```

### Stats
```bash
curl http://localhost:5001/api/stats
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Container won't start | Check logs: `./deploy.sh logs` |
| GPU not detected | Verify NVIDIA Container Toolkit |
| Port 80 in use | Stop existing: `sudo lsof -ti:80 \| xargs kill` |
| Out of memory | Increase Docker memory limit |
| Slow processing | Enable GPU or increase replicas |
