# VOXIS Architecture Documentation
**Powered by Trinity | Built by Glass Stone**

## System Overview

VOXIS is a web-based professional audio restoration application designed with a "Swiss Design" philosophy. It uses a client-server architecture where a React frontend communicates with a Python Flask backend that orchestrates a series of AI audio processing models.

### High-Level Diagram

```mermaid
graph TD
    Client[Browser Client]
    LB[Load Balancer / Nginx]
    Backend[Backend Server (Gunicorn)]
    Worker[Processing Worker Thread]
    
    Client -->|HTTP/REST| LB
    LB -->|Proxy| Backend
    Backend -->|Spawns| Worker
    
    subgraph Trinity Engine
        Worker -->|Reads| Audio[Audio File]
        Worker -->|Step 1| Ingest[Librosa Ingest]
        Worker -->|Step 2| Spectrum[Spectral Analysis]
        Worker -->|Step 3| Denoise[DeepFilterNet]
        Worker -->|Step 4| Upscale[AudioSR/Resample]
        Worker -->|Step 5| Export[FFmpeg Convert]
    end
```

## Directory Structure

```
VOXIS/
├── backend/                 # Python Backend
│   ├── gunicorn.conf.py     # Production server config
│   ├── pipeline.py          # Core processing logic (Trinity)
│   ├── requirements.txt     # Python dependencies
│   ├── server.py            # Flask REST API
│   ├── Dockerfile           # Backend container definition
│   ├── uploads/             # Temporary upload storage
│   └── outputs/             # Processed file storage
│
├── components/              # React UI Components
│   ├── SwissSidebar.tsx     # Main controls (Trinity Settings)
│   ├── PipelineDisplay.tsx  # Progress visualization
│   ├── StartPanel.tsx       # Pre-processing stage UI
│   ├── OfflineBanner.tsx    # Network resilience UI
│   └── ...
│
├── services/                # Frontend Services
│   ├── apiService.ts        # API client & Circuit Breaker
│   └── networkResilience.ts # Offline detection hooks
│
├── docs/                    # Documentation
├── App.tsx                  # Main React Application
├── run-local.sh             # Local development script
└── docker-compose.yml       # Production orchestration
```

## Core Components

### 1. Frontend (React + Vite)
- **Design System**: "Swiss Design" - rigid grid, high contrast, Helvetica/Inter typography.
- **State Management**: React `useState`/`useEffect` with local storage persistence for job queues.
- **Network Resilience**: 
  - `OfflineBanner`: Detects network loss.
  - `apiService`: Implements exponential backoff retries and circuit breaker pattern.

### 2. Backend (Flask + Gunicorn)
- **Server**: Flask providing REST endpoints.
- **Execution**: Gunicorn with `gthread` workers for concurrent request handling.
- **Job Management**: In-memory job tracking with locking (`threading.Lock`) for thread safety.
- **Watchdog**: `run-local.sh` includes a monitoring loop that restarts the backend if health checks fail.

### 3. Trinity Engine (Audio Pipeline)
The core processing logic typically resides in `pipeline.py` (imported by server) and orchestrates:
1.  **Ingest**: Loading audio with `librosa`.
2.  **Spectrum**: Analyzing noise floor using `noisereduce`.
3.  **Denoise**: Applying `DeepFilterNet` models.
4.  **Upscale**: Neural upsampling via `AudioSR` or high-quality resampling.
5.  **Export**: Formatting output with `FFmpeg`/`pydub`.

## Data Flow

1.  **Stage**: User selects file. File is loaded into browser memory (blob).
2.  **Upload**: File is POSTed to `/api/upload`. Backend returns `file_id`.
3.  **Start**: User confirms settings. Request to `/api/process` with config & `file_id`.
4.  **Process**: Backend spawns thread. Updates in-memory job status.
5.  **Poll**: Frontend polls `/api/status/<job_id>` every 500ms.
6.  **Complete**: Backend marks job complete. Frontend requests `/api/export/<job_id>`.

## Scalability & Production

- **Concurrency**: Gunicorn is configured with multiple workers/threads to handle simultaneous users.
- **Storage**: Clean-up daemon runs hourly to remove old files (configurable TTL).
- **Deployment**: Dockerized for easy deployment to AWS/GCP/Railway.
