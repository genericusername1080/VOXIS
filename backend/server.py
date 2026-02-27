"""
VOXIS Backend Server v4.0.0 Always-On
Powered by Trinity v8.1 | Built by Glass Stone
Copyright (c) 2026 Glass Stone. All rights reserved.

Production-ready Flask REST API for audio processing pipeline.

v4.0 Dense Features:
- MP4/MOV video audio extraction via ffmpeg
- Live recording upload endpoint
- Multi-format export (WAV/FLAC/MP3/AAC)
- DeepFilterNet HIGH denoise default
- VOXIS 4 Dense vocal/instrument separation (UVR5)
- Adjustable AudioSR 2-channel upscale
- Advanced spectral analysis (Audio-Noise-Reduction + VoiceRestore)

Endpoints:
  GET  /api/health             - Health check with system stats
  GET  /api/stats              - Server statistics
  GET  /api/system/models      - Model availability
  POST /api/upload             - Upload audio/video file
  POST /api/upload/recording   - Upload live recording (WAV blob)
  POST /api/process            - Start processing job
  GET  /api/status/<id>        - Get job status
  GET  /api/download/<id>      - Download processed file
  GET  /api/export/<id>        - Export in WAV/FLAC/MP3
  GET  /api/jobs               - List all jobs
  DELETE /api/jobs/<id>        - Cancel/delete job
"""

import os
import sys

# =============================================================================
# PYINSTALLER FROZEN-MODE SETUP (libs, binaries, PATH)
# =============================================================================
exe_dir = os.path.dirname(os.path.abspath(__file__))

if getattr(sys, 'frozen', False):
    # Add local libs to sys.path
    libs_path = os.path.join(exe_dir, 'libs')
    if os.path.exists(libs_path):
        sys.path.insert(0, libs_path)

    # Resolve base path: _MEIPASS (onefile) or _internal (onedir) or exe_dir
    base_path = getattr(sys, '_MEIPASS', None)
    if not base_path:
        internal = os.path.join(os.path.dirname(sys.executable), '_internal')
        base_path = internal if os.path.exists(internal) else exe_dir

    # Add platform-specific bin directory to PATH (ffmpeg, phase_limiter)
    platform_map = {'win32': 'win', 'darwin': 'mac'}
    platform_key = platform_map.get(sys.platform, 'linux')
    bin_path = os.path.join(base_path, 'bin', platform_key)
    if not os.path.exists(bin_path):
        bin_path = os.path.join(exe_dir, 'bin', platform_key)
    if os.path.exists(bin_path):
        os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]

import uuid
import json
import signal
import threading
import multiprocessing # For process isolation
# Fix macOS fork+PyTorch hang: use 'spawn' instead of 'fork'
try:
    multiprocessing.set_start_method('spawn', force=True)
except RuntimeError:
    pass  # Already set
import time
import shutil
import logging
import atexit
import queue # For threading
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from functools import wraps
from collections import defaultdict

# PERFORMANCE: Defer patch_torchaudio import — only needed when pipeline runs
# It's imported inside the worker process instead of at server startup
# This saves 3-5s of torch import time on server boot

from flask import Flask, request, jsonify, send_file, send_from_directory, g
from werkzeug.utils import secure_filename
from flask_cors import CORS
from dotenv import load_dotenv

# Initialize structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler("server.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('VOXIS')

# PERFORMANCE: Lazy pipeline import — don't load PyTorch/models at server startup
# The pipeline is only imported inside worker processes when a job starts
# This reduces server boot from ~15s to ~1s
PIPELINE_AVAILABLE = True  # Assume available; worker will verify

# STABILITY: Pre-load torch synchronously to prevent race conditions
# The background thread approach failed, so we must block to ensure safe loading
def preload_models():
    """Import torch synchronously to populate sys.modules safely."""
    try:
        logging.info("PRELOAD: Starting synchronous model import...")
        import torch
        logging.info(f"PRELOAD: Torch {torch.__version__} ready")
    except Exception as e:
        logging.error(f"PRELOAD: Failed to load models: {e}")

# Run synchronously before anything else
preload_models()

# Import worker entrypoint
try:
    from backend.worker import worker_process_entrypoint
except ImportError:
    # Fallback if running from within backend dir
    from worker import worker_process_entrypoint

# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Server configuration with environment variable support."""

    # Paths — handle PyInstaller frozen mode
    if getattr(sys, 'frozen', False):
        # PyInstaller onedir: executable is in dist/voxis_backend/
        # Data files are in dist/voxis_backend/_internal/
        _exe_dir = os.path.dirname(sys.executable)
        _internal = os.path.join(_exe_dir, '_internal')
        BASE_DIR = _internal if os.path.isdir(_internal) else _exe_dir
        # Put uploads/outputs next to the executable, not inside _internal
        _data_dir = os.environ.get('VOXIS_ROOT_PATH', _exe_dir)
        UPLOAD_FOLDER = os.environ.get('VOXIS_UPLOAD_DIR', os.path.join(_data_dir, 'uploads'))
        OUTPUT_FOLDER = os.environ.get('VOXIS_OUTPUT_DIR', os.path.join(_data_dir, 'outputs'))
    else:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        UPLOAD_FOLDER = os.environ.get('VOXIS_UPLOAD_DIR', os.path.join(BASE_DIR, 'uploads'))
        OUTPUT_FOLDER = os.environ.get('VOXIS_OUTPUT_DIR', os.path.join(BASE_DIR, 'outputs'))
    
    # File settings
    MAX_CONTENT_LENGTH = int(os.environ.get('VOXIS_MAX_FILE_SIZE', 500 * 1024 * 1024))  # 500MB
    ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'aiff', 'mp4', 'mov'}
    
    # Rate limiting
    RATE_LIMIT_REQUESTS = int(os.environ.get('VOXIS_RATE_LIMIT', 30))  # requests per window
    RATE_LIMIT_WINDOW = int(os.environ.get('VOXIS_RATE_WINDOW', 60))   # window in seconds
    
    # Job settings
    JOB_TIMEOUT_HOURS = int(os.environ.get('VOXIS_JOB_TIMEOUT', 24))
    JOB_CLEANUP_INTERVAL = int(os.environ.get('VOXIS_CLEANUP_INTERVAL', 3600))  # 1 hour
    
    # Disk settings
    MIN_DISK_SPACE_GB = float(os.environ.get('VOXIS_MIN_DISK_GB', 1.0))
    
    # Server settings
    HOST = os.environ.get('VOXIS_HOST', '0.0.0.0')
    PORT = int(os.environ.get('VOXIS_PORT', 5002))
    DEBUG = os.environ.get('VOXIS_DEBUG', 'true').lower() == 'true'

config = Config()

# Ensure directories exist
os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(config.OUTPUT_FOLDER, exist_ok=True)

# =============================================================================
# FLASK APP INITIALIZATION
# =============================================================================

# Determine static folder for frozen/production mode
static_folder = None
if getattr(sys, 'frozen', False):
    if hasattr(sys, '_MEIPASS'):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(sys.executable)
    
    # Bundle puts 'dist' folder next to executable or inside _internal
    static_folder = os.path.join(base_path, 'dist')
    if not os.path.exists(static_folder):
        # Fallback for onedir mode where dist might be in _internal/dist
        static_folder = os.path.join(os.path.dirname(sys.executable), '_internal', 'dist')

app = Flask(__name__, static_folder=static_folder, static_url_path='')
app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = config.OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

# Serve React Frontend (Production Only)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if getattr(sys, 'frozen', False) and app.static_folder:
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')
    else:
        return "VOXIS Backend Running (Dev Mode - Use Frontend Server)", 200

# Enable CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

# =============================================================================
# RATE LIMITING
# =============================================================================

class RateLimiter:
    """Simple in-memory rate limiter per IP address."""
    
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
        self.lock = threading.Lock()
    
    def is_allowed(self, ip: str) -> bool:
        """Check if request is allowed for given IP."""
        with self.lock:
            now = time.time()
            window_start = now - self.window_seconds
            
            # Clean old requests
            self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
            
            if len(self.requests[ip]) >= self.max_requests:
                return False
            
            self.requests[ip].append(now)
            return True
    
    def get_remaining(self, ip: str) -> int:
        """Get remaining requests for IP."""
        with self.lock:
            now = time.time()
            window_start = now - self.window_seconds
            current = len([t for t in self.requests[ip] if t > window_start])
            return max(0, self.max_requests - current)

rate_limiter = RateLimiter(config.RATE_LIMIT_REQUESTS, config.RATE_LIMIT_WINDOW)

def rate_limit(f):
    """Rate limiting decorator."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        ip = request.remote_addr or 'unknown'
        if not rate_limiter.is_allowed(ip):
            logger.warning(f"Rate limit exceeded for IP: {ip}")
            return jsonify({
                'error': 'Rate limit exceeded',
                'retry_after': config.RATE_LIMIT_WINDOW
            }), 429
        return f(*args, **kwargs)
    return decorated_function

# =============================================================================
# JOB MANAGEMENT
# =============================================================================

jobs = {}
jobs_lock = threading.RLock()
server_stats = {
    'start_time': datetime.utcnow().isoformat(),
    'total_uploads': 0,
    'total_jobs': 0,
    'completed_jobs': 0,
    'failed_jobs': 0,
    'bytes_processed': 0
}

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in config.ALLOWED_EXTENSIONS

def get_disk_space() -> dict:
    """Get disk space information."""
    try:
        total, used, free = shutil.disk_usage(config.BASE_DIR)
        return {
            'total_gb': round(total / (1024**3), 2),
            'used_gb': round(used / (1024**3), 2),
            'free_gb': round(free / (1024**3), 2),
            'percent_used': round((used / total) * 100, 1)
        }
    except Exception:
        return {'error': 'Unable to get disk space'}

def check_disk_space() -> bool:
    """Check if there's enough disk space."""
    disk = get_disk_space()
    if 'error' in disk:
        return True  # Don't block if we can't check
    return disk['free_gb'] >= config.MIN_DISK_SPACE_GB

def update_job_status(job_id: str, stage: str, progress: int, **kwargs):
    """Thread-safe job status update."""
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id]['current_stage'] = stage
            jobs[job_id]['progress'] = progress
            jobs[job_id]['updated_at'] = datetime.utcnow().isoformat()
            jobs[job_id]['stages'][stage] = {
                'progress': progress,
                'updated_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            logger.info(f"Job {job_id[:8]} | Stage: {stage} | Progress: {progress}%")

# Global queue for job updates (Worker -> Main Process)
# Must be at module level for pickling (even with threads)
job_updates_queue = queue.Queue()


# Track active worker processes for crash detection
active_processes = {}

def run_job_monitor():
    """Background thread to consume updates from worker processes AND monitor for crashes."""
    logger.info("Job Monitor thread started")
    
    last_process_check = time.time()
    
    while True:
        try:
            # excessive blocking prevents shutdown? use timeout
            try:
                # Short timeout to allow process checking loop to run frequently
                msg = job_updates_queue.get(timeout=0.5)
                
                msg_type = msg[0]
                job_id = msg[1]
                
                with jobs_lock:
                    if job_id not in jobs:
                        continue # Job might have been deleted
                    
                    if msg_type == 'status':
                        jobs[job_id]['status'] = msg[2]
                    elif msg_type == 'started':
                        jobs[job_id]['started_at'] = msg[2]
                    elif msg_type == 'progress':
                        # ('progress', job_id, stage, progress)
                        update_job_status(job_id, msg[2], msg[3])
                    elif msg_type == 'complete':
                        # ('complete', job_id, results, output_path)
                        results = msg[2]
                        output_path = msg[3]
                        jobs[job_id]['status'] = 'complete'
                        jobs[job_id]['results'] = results
                        jobs[job_id]['output_file'] = output_path
                        jobs[job_id]['completed_at'] = datetime.utcnow().isoformat()
                        server_stats['completed_jobs'] += 1
                        if os.path.exists(output_path):
                            server_stats['bytes_processed'] += os.path.getsize(output_path)
                        logger.info(f"Job {job_id[:8]} | Marked COMPLETE in main process")
                    elif msg_type == 'error':
                        # ('error', job_id, error_msg)
                        jobs[job_id]['status'] = 'error'
                        jobs[job_id]['error'] = msg[2]
                        jobs[job_id]['completed_at'] = datetime.utcnow().isoformat()
                        server_stats['failed_jobs'] += 1
                        logger.error(f"Job {job_id[:8]} | Marked ERROR: {msg[2]}")
                        
            except queue.Empty:
                pass
                
            # Check for dead processes every ~0.5s
            current_time = time.time()
            if current_time - last_process_check > 0.5:
                # Copy keys to avoid modification during iteration
                for job_id, proc in list(active_processes.items()):
                    if not proc.is_alive():
                        # Thread is dead. Check status.
                        with jobs_lock:
                            # Only update if the job was still expected to be processing
                            if job_id in jobs and jobs[job_id]['status'] in ['queued', 'processing']:
                                error_msg = "Worker thread died unexpectedly"
                                jobs[job_id]['status'] = 'error'
                                jobs[job_id]['error'] = error_msg
                                jobs[job_id]['completed_at'] = datetime.utcnow().isoformat()
                                server_stats['failed_jobs'] += 1
                                logger.error(f"Job {job_id[:8]} | DETECTED CRASH: {error_msg}")
                        
                        # Cleanup from active dict regardless of job status update
                        del active_processes[job_id]
                        
                last_process_check = current_time
                    
        except Exception as e:
            logger.error(f"Monitor error: {e}")
            time.sleep(1)

# Flag to ensure background tasks run once per worker
_bg_tasks_started = False
_bg_tasks_lock = threading.Lock()

def start_background_tasks():
    global _bg_tasks_started
    with _bg_tasks_lock:
        if _bg_tasks_started:
            return
            
        logger.info("Starting background tasks (Monitor + Cleanup)...")
        
        # Start Job Monitor
        monitor = threading.Thread(target=run_job_monitor, daemon=True, name="JobMonitor")
        monitor.start()
        
        # Start Cleanup Scheduler (re-using existing logic)
        start_cleanup_scheduler()
        
        _bg_tasks_started = True

def cleanup_old_jobs():
    """Remove old completed/failed jobs and their files."""
    logger.info("Running job cleanup...")
    cutoff = datetime.utcnow() - timedelta(hours=config.JOB_TIMEOUT_HOURS)
    
    jobs_to_remove = []
    files_removed = 0
    
    with jobs_lock:
        for job_id, job in jobs.items():
            completed_at = job.get('completed_at')
            if completed_at:
                try:
                    job_time = datetime.fromisoformat(completed_at)
                    if job_time < cutoff:
                        jobs_to_remove.append(job_id)
                        
                        # Remove files
                        for file_key in ['input_file', 'output_file']:
                            filepath = job.get(file_key)
                            if filepath and os.path.exists(filepath):
                                try:
                                    os.remove(filepath)
                                    files_removed += 1
                                except Exception:
                                    pass
                except Exception:
                    pass
        
        for job_id in jobs_to_remove:
            del jobs[job_id]
    
    logger.info(f"Cleanup complete: {len(jobs_to_remove)} jobs, {files_removed} files removed")

def start_cleanup_scheduler():
    """Start background cleanup thread."""
    def cleanup_loop():
        while True:
            time.sleep(config.JOB_CLEANUP_INTERVAL)
            try:
                cleanup_old_jobs()
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
    
    thread = threading.Thread(target=cleanup_loop, daemon=True)
    thread.start()
    logger.info(f"Cleanup scheduler started (interval: {config.JOB_CLEANUP_INTERVAL}s)")

# =============================================================================
# REQUEST LOGGING MIDDLEWARE
# =============================================================================

@app.before_request
def before_request():
    """Log incoming requests."""
    # Ensure background tasks are running (lazy start for Gunicorn workers)
    if not _bg_tasks_started:
        start_background_tasks()
        
    g.start_time = time.time()

@app.after_request
def after_request(response):
    """Log request completion with timing."""
    duration = time.time() - getattr(g, 'start_time', time.time())
    logger.info(f"{request.method} {request.path} | {response.status_code} | {duration*1000:.1f}ms")
    return response

# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': 'Bad request', 'message': str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found', 'message': str(e)}), 404

@app.errorhandler(413)
def file_too_large(e):
    return jsonify({
        'error': 'File too large',
        'max_size_mb': config.MAX_CONTENT_LENGTH // (1024 * 1024)
    }), 413

@app.errorhandler(500)
def internal_error(e):
    logger.exception("Internal server error")
    return jsonify({'error': 'Internal server error'}), 500

# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Comprehensive health check with system stats."""
    disk = get_disk_space()
    
    return jsonify({
        'status': 'healthy',
        'server_time': datetime.utcnow().isoformat(),
        'service': 'VOXIS',
        'version': '4.0.0',
        'powered_by': 'Trinity v8.1',
        'built_by': 'Glass Stone',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime_seconds': (datetime.utcnow() - datetime.fromisoformat(server_stats['start_time'])).total_seconds(),
        'disk': disk,
        'pipeline_available': PIPELINE_AVAILABLE,
        'active_jobs': len([j for j in jobs.values() if j['status'] == 'processing'])
    })


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get server statistics."""
    with jobs_lock:
        job_summary = {
            'total': len(jobs),
            'queued': len([j for j in jobs.values() if j['status'] == 'queued']),
            'processing': len([j for j in jobs.values() if j['status'] == 'processing']),
            'complete': len([j for j in jobs.values() if j['status'] == 'complete']),
            'error': len([j for j in jobs.values() if j['status'] == 'error'])
        }
    
    return jsonify({
        'server': server_stats,
        'jobs': job_summary,
        'disk': get_disk_space(),
        'rate_limit': {
            'max_requests': config.RATE_LIMIT_REQUESTS,
            'window_seconds': config.RATE_LIMIT_WINDOW
        }
    })


@app.route('/api/system/models', methods=['GET'])
def get_model_status():
    """Get status of AI models."""
    models_dir = os.path.join(config.BASE_DIR, 'models')
    
    # Check Trinity Upscale (AudioSR)
    audiosr_path = os.path.join(models_dir, 'TrinityUpscale', 'audiosr-basic')
    audiosr_status = {
        'available': os.path.exists(audiosr_path),
        'path': audiosr_path if os.path.exists(audiosr_path) else None,
        'model': 'Trinity Upscale'
    }
    
    # Check Trinity Denoise (DeepFilterNet)
    df_dir = os.path.join(models_dir, 'TrinityDenoise')
    df_status = {
        'available': os.path.exists(df_dir) and len(os.listdir(df_dir)) > 0 if os.path.exists(df_dir) else False,
        'path': df_dir,
        'model': 'Trinity Denoise'
    }
    
    # Check Trinity Restore (VoiceRestore)
    vr_checkpoint = os.path.join(models_dir, 'TrinityRestore', 'voicerestore-1.1.pth')
    vr_status = {
        'available': os.path.exists(vr_checkpoint),
        'path': vr_checkpoint if os.path.exists(vr_checkpoint) else None,
        'model': 'Trinity Restore'
    }

    # Check VOXIS Sharding (Neural Separation)
    try:
        from audio_separator.separator import Separator
        sharding_available = True
    except ImportError:
        sharding_available = False
    sharding_status = {
        'available': sharding_available,
        'model': 'VOXIS Sharding',
        'engine': 'VOXIS 4.0.0 by Glass Stone'
    }

    # Check Trinity Diffusion (always active)
    diff_models_dir = os.path.join(models_dir, 'TrinityDiffusion')
    diff_status = {
        'available': os.path.exists(os.path.join(diff_models_dir, 'model_diffhier.pth')),
        'path': diff_models_dir,
        'model': 'Trinity Diffusion'
    }

    return jsonify({
        'audiosr': audiosr_status,
        'deepfilternet': df_status,
        'sharding': sharding_status,
        'voicerestore': vr_status,
        'diffusion': diff_status,
        'pipeline_loaded': PIPELINE_AVAILABLE,
        'mode': 'always_on',
    })


@app.route('/api/upload', methods=['POST'])
@rate_limit
def upload_file():
    """Upload an audio file for processing."""
    # Check disk space
    if not check_disk_space():
        return jsonify({'error': 'Insufficient disk space'}), 507
    
    # Validate request
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided', 'field': 'file'}), 400
    
    file = request.files['file']
    
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'error': 'Invalid file type',
            'allowed': list(config.ALLOWED_EXTENSIONS)
        }), 400
    
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'wav'
        filename = f"{file_id}.{ext}"
        
        # Security: Validate content
        import soundfile as sf
        
        # Save to temp location first for validation
        temp_filename = f"temp_{filename}"
        temp_filepath = os.path.join(config.UPLOAD_FOLDER, temp_filename)
        final_filepath = os.path.join(config.UPLOAD_FOLDER, filename)
        
        file.save(temp_filepath)
        
        # Always use ffmpeg for ingestion to ensure standardized robust 48kHz WAV
        needs_ffmpeg = True
        is_video = ext in {'mp4', 'mov'} # Preserve stats

        try:
            if needs_ffmpeg:
                # Convert immediately using ffmpeg
                # This prevents torchaudio/librosa segfaults in worker threads
                import subprocess
                wav_filename = f"{file_id}.wav"
                wav_filepath = os.path.join(config.UPLOAD_FOLDER, wav_filename)
                
                convert_cmd = ['ffmpeg', '-y', '-i', temp_filepath, '-vn', '-acodec', 'pcm_s16le', '-ar', '48000', '-ac', '2', wav_filepath]
                
                try:
                    subprocess.run(convert_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                    
                    # Update info
                    if os.path.exists(temp_filepath):
                        os.remove(temp_filepath)
                    final_filepath = wav_filepath
                    filename = wav_filename
                    ext = 'wav'
                    
                    # Get info from new WAV
                    info = sf.info(final_filepath)
                    duration = info.duration
                    samplerate = info.samplerate
                    channels = info.channels
                    
                except subprocess.CalledProcessError as e:
                    raise ValueError(f"Video conversion failed: {e.stderr.decode()}")
                except Exception as e:
                    raise ValueError(f"Conversion error: {e}")

            else:
                # Verify it's a valid audio file
                info = sf.info(temp_filepath)
                if info.frames == 0:
                    raise ValueError("Empty audio file")
                duration = info.duration
                samplerate = info.samplerate
                channels = info.channels
                os.rename(temp_filepath, final_filepath)

            if duration > 7200:
                raise ValueError("File duration exceeds 2 hours limit")

        except Exception as e:
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            logger.warning(f"Invalid upload rejected: {original_filename} | {e}")
            return jsonify({'error': 'Invalid file content', 'details': str(e)}), 400

        file_size = os.path.getsize(final_filepath)

        server_stats['total_uploads'] += 1
        source_type = 'video' if is_video else 'audio'
        logger.info(f"Upload complete: {file_id[:8]} | {original_filename} | {source_type} | {file_size/1024:.1f}KB | {samplerate}Hz | {channels}ch")

        return jsonify({
            'success': True,
            'file_id': file_id,
            'filename': original_filename,
            'size': file_size,
            'duration': duration,
            'channels': channels,
            'samplerate': samplerate,
            'source': source_type,
            'uploaded_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.exception(f"Upload error: {e}")
        return jsonify({'error': 'Upload failed', 'message': str(e)}), 500


@app.route('/api/upload/recording', methods=['POST'])
@rate_limit
def upload_recording():
    """Upload a live recording (WAV blob from browser MediaRecorder)."""
    if not check_disk_space():
        return jsonify({'error': 'Insufficient disk space'}), 507

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio blob provided', 'field': 'audio'}), 400

    audio_blob = request.files['audio']
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.wav"
    filepath = os.path.join(config.UPLOAD_FOLDER, filename)

    try:
        temp_filepath = os.path.join(config.UPLOAD_FOLDER, f"temp_{filename}")
        audio_blob.save(temp_filepath)
        
        # Convert blob immediately using ffmpeg to ensure 2-channel 48kHz WAV
        import subprocess
        convert_cmd = ['ffmpeg', '-y', '-i', temp_filepath, '-vn', '-acodec', 'pcm_s16le', '-ar', '48000', '-ac', '2', filepath]
        subprocess.run(convert_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)

        import soundfile as sf
        info = sf.info(filepath)
        if info.frames == 0:
            os.remove(filepath)
            return jsonify({'error': 'Empty recording'}), 400

        file_size = os.path.getsize(filepath)
        server_stats['total_uploads'] += 1
        logger.info(f"Recording upload: {file_id[:8]} | {info.duration:.1f}s | {info.samplerate}Hz")

        return jsonify({
            'success': True,
            'file_id': file_id,
            'filename': f'recording_{file_id[:8]}.wav',
            'size': file_size,
            'duration': info.duration,
            'channels': info.channels,
            'samplerate': info.samplerate,
            'source': 'recording',
            'uploaded_at': datetime.utcnow().isoformat()
        })
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        logger.exception(f"Recording upload error: {e}")
        return jsonify({'error': 'Recording upload failed', 'message': str(e)}), 500


@app.route('/api/process', methods=['POST'])
@rate_limit
def start_processing():
    """Start audio processing job."""
    # Validate JSON
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 400
    
    data = request.get_json()
    
    if not data or 'file_id' not in data:
        return jsonify({'error': 'file_id is required'}), 400
    
    file_id = data['file_id']
    
    # Validate file_id format (UUID)
    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({'error': 'Invalid file_id format'}), 400
    
    # Find the uploaded file
    input_path = None
    for ext in config.ALLOWED_EXTENSIONS:
        potential_path = os.path.join(config.UPLOAD_FOLDER, f"{file_id}.{ext}")
        if os.path.exists(potential_path):
            input_path = potential_path
            break
    
    if not input_path:
        return jsonify({'error': 'File not found', 'file_id': file_id}), 404
    
    # Validate and sanitize config
    try:
        # v4.0: Always-on maximum quality — voice-optimized defaults
        job_config = {
            'denoise_strength': min(1.0, max(0.0, float(data.get('denoise_strength', 92)) / 100.0)),
            'high_precision': True,
            'upscale_factor': min(4, max(1, int(data.get('upscale_factor', 2)))),
            'target_sample_rate': int(data.get('target_sample_rate', 48000)),
            'target_channels': min(2, max(1, int(data.get('target_channels', 2)))),
            'voicerestore_steps': min(64, max(4, int(data.get('voicerestore_steps', 32)))),
            'voicerestore_cfg': min(2.0, max(0.0, float(data.get('voicerestore_cfg', 0.5)))),
            'hp_freq': float(data.get('hp_freq', 80.0)),
            'lp_freq': float(data.get('lp_freq', 16000.0)),
            'amp_target_db': float(data.get('amp_target_db', -16.0)),
            'amp_threshold_db': float(data.get('amp_threshold_db', -26.0)),
        }
        
        # Validate sample rate
        if job_config['target_sample_rate'] not in [44100, 48000, 96000]:
            job_config['target_sample_rate'] = 48000
            
    except (ValueError, TypeError) as e:
        return jsonify({'error': 'Invalid configuration', 'message': str(e)}), 400
    
    # Create job
    job_id = str(uuid.uuid4())
    output_filename = f"voxis_restored_{job_id}.wav"
    output_path = os.path.join(config.OUTPUT_FOLDER, output_filename)
    
    # Store original filename for output naming (original_name-voxis.format)
    original_filename_raw = data.get('original_filename', '')
    if not original_filename_raw:
        # Try to infer from uploaded file
        original_filename_raw = os.path.basename(input_path)
    original_name_stem = os.path.splitext(original_filename_raw)[0]
    # Strip UUID prefix if present (36 chars UUID)
    if len(original_name_stem) == 36 and '-' in original_name_stem:
        original_name_stem = f"audio_{file_id[:8]}"

    with jobs_lock:
        jobs[job_id] = {
            'job_id': job_id,
            'file_id': file_id,
            'status': 'queued',
            'filename': output_filename,
            'input_file': input_path,
            'output_file': output_path,
            'original_name': original_name_stem,
            'config': job_config,
            'created_at': datetime.utcnow().isoformat(),
            'started_at': None,
            'completed_at': None,
            'updated_at': datetime.utcnow().isoformat(),
            'progress': 0,
            'current_stage': 'queued',
            'stages': {},
            'results': None,
            'error': None
        }
        server_stats['total_jobs'] += 1
    
    # Start processing in DETACHED MULTIPROCESSING PROCESS
    # This prevents SIGSEGV crashes from killing the server
    try:
        # Start processing in THREAD (for debugging stability)
        # multiprocessing.Process causes spawn issues on this env
        process = threading.Thread(
            target=worker_process_entrypoint,
            args=(job_id, input_path, output_path, job_config, job_updates_queue),
            daemon=True
        )
        # print(f"DEBUG TYPE: {type(process)}")
        # sys.stdout.flush()
        process.start()
    except Exception as e:
        logger.exception(f"Job {job_id[:8]} | process.start() failed: {e}")
        return jsonify({'error': 'Failed to spawn worker process', 'details': str(e)}), 500
    
    # Track process for crash monitoring
    active_processes[job_id] = process
    
    logger.info(f"Job {job_id[:8]} | Spawning worker thread ident {process.ident}")
    
    return jsonify({
        'success': True,
        'message': 'Job started',
        'job_id': job_id,
        'status': 'queued'
    })


@app.route('/api/status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get processing job status."""
    # Validate job_id format
    try:
        uuid.UUID(job_id)
    except ValueError:
        return jsonify({'error': 'Invalid job_id format'}), 400
    
    with jobs_lock:
        job = jobs.get(job_id)
    
    if not job:
        return jsonify({'error': 'Job not found', 'job_id': job_id}), 404
    
    # Inline completion detection: if job still shows processing but output exists, mark complete
    # This is a fallback for when the monitor thread can't keep up
    if job['status'] in ['queued', 'processing']:
        output_file = job.get('output_file', '')
        if output_file and os.path.exists(output_file):
            with jobs_lock:
                if job_id in jobs and jobs[job_id]['status'] in ['queued', 'processing']:
                    logger.info(f"Job {job_id[:8]} | Inline completion detection - output file exists")
                    jobs[job_id]['status'] = 'complete'
                    jobs[job_id]['completed_at'] = datetime.utcnow().isoformat()
                    server_stats['completed_jobs'] += 1
                    server_stats['bytes_processed'] += os.path.getsize(output_file)
                    job = jobs[job_id]  # Refresh for response
    
    return jsonify({
        'job_id': job['job_id'],
        'status': job['status'],
        'current_stage': job['current_stage'],
        'progress': job['progress'],
        'stages': job['stages'],
        'config': job['config'],
        'error': job['error'],
        'created_at': job['created_at'],
        'started_at': job['started_at'],
        'completed_at': job['completed_at'],
        'results': job.get('results')
    })


@app.route('/api/download/<job_id>', methods=['GET'])
def download_file(job_id):
    """Download processed audio file."""
    # Validate job_id format
    try:
        uuid.UUID(job_id)
    except ValueError:
        return jsonify({'error': 'Invalid job_id format'}), 400
    
    with jobs_lock:
        job = jobs.get(job_id)
    
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    if job['status'] != 'complete':
        return jsonify({
            'error': 'Processing not complete',
            'status': job['status'],
            'progress': job['progress']
        }), 400
    
    if not job['output_file'] or not os.path.exists(job['output_file']):
        return jsonify({'error': 'Output file not found'}), 404
    
    # Use original_name-voxis.wav naming
    orig_name = job.get('original_name', '')
    if not orig_name:
        results_data = job.get('results') or {}
        orig_name = results_data.get('original_name', f"audio_{job_id[:8]}")
    download_name = f"{orig_name}-voxis.wav"
    logger.info(f"Download: {job_id[:8]} | {download_name}")

    return send_file(
        job['output_file'],
        mimetype='audio/wav',
        as_attachment=True,
        download_name=download_name
    )


@app.route('/api/export/<job_id>', methods=['GET'])
def export_file(job_id):
    """
    Export processed audio in multiple formats (WAV, FLAC, MP3).
    
    Query params:
      - format: 'wav' (default), 'flac', 'mp3'
      - quality: 'low', 'medium', 'high' (for MP3 bitrate)
    """
    # Validate job_id format
    try:
        uuid.UUID(job_id)
    except ValueError:
        return jsonify({'error': 'Invalid job_id format'}), 400
    
    with jobs_lock:
        job = jobs.get(job_id)
    
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    if job['status'] != 'complete':
        return jsonify({
            'error': 'Processing not complete',
            'status': job['status'],
            'progress': job['progress']
        }), 400
    
    if not job['output_file'] or not os.path.exists(job['output_file']):
        return jsonify({'error': 'Output file not found'}), 404
    
    # Get export format
    export_format = request.args.get('format', 'wav').lower()
    quality = request.args.get('quality', 'high').lower()
    
    if export_format not in ['wav', 'flac', 'mp3']:
        return jsonify({
            'error': 'Invalid format',
            'supported_formats': ['wav', 'flac', 'mp3']
        }), 400
    
    # Derive original_name-voxis.format naming
    original_name = job.get('original_name') or ''
    if not original_name:
        results_data = job.get('results') or {}
        original_name = results_data.get('original_name', f"audio_{job_id[:8]}")

    # If WAV, just send the original file
    if export_format == 'wav':
        download_name = f"{original_name}-voxis.wav"
        return send_file(
            job['output_file'],
            mimetype='audio/wav',
            as_attachment=True,
            download_name=download_name
        )
    
    # For FLAC/MP3, convert using ffmpeg directly instead of pydub
    try:
        import subprocess
        
        # Create temp output file
        output_ext = export_format
        output_filename = f"{original_name}-voxis.{output_ext}"
        output_path = os.path.join(config.OUTPUT_FOLDER, output_filename)
        
        if export_format == 'flac':
            # Export as FLAC (lossless)
            cmd = ['ffmpeg', '-y', '-i', job['output_file'], output_path]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            mimetype = 'audio/flac'
            
        elif export_format == 'mp3':
            # MP3 bitrates based on quality
            bitrates = {
                'low': '128k',
                'medium': '192k',
                'high': '320k'
            }
            bitrate = bitrates.get(quality, '320k')
            cmd = ['ffmpeg', '-y', '-i', job['output_file'], '-codec:a', 'libmp3lame', '-b:a', bitrate, output_path]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            mimetype = 'audio/mpeg'
        
        logger.info(f"Export: {job_id[:8]} | {export_format.upper()} | {quality} | ffmpeg")
        
        return send_file(
            output_path,
            mimetype=mimetype,
            as_attachment=True,
            download_name=output_filename
        )
        
    except subprocess.CalledProcessError as e:
        logger.exception(f"Export ffmpeg error: {e.stderr.decode()}")
        return jsonify({
            'error': 'Export failed (ffmpeg)',
            'message': str(e)
        }), 500
    except Exception as e:
        logger.exception(f"Export error: {e}")
        return jsonify({
            'error': 'Export failed',
            'message': str(e)
        }), 500


@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    """List all jobs with optional filtering."""
    status_filter = request.args.get('status')
    limit = min(100, int(request.args.get('limit', 50)))
    
    with jobs_lock:
        job_list = []
        for j in sorted(jobs.values(), key=lambda x: x['created_at'], reverse=True)[:limit]:
            if status_filter and j['status'] != status_filter:
                continue
            job_list.append({
                'job_id': j['job_id'],
                'status': j['status'],
                'current_stage': j['current_stage'],
                'progress': j['progress'],
                'created_at': j['created_at'],
                'completed_at': j['completed_at']
            })
    
    return jsonify({
        'jobs': job_list,
        'total': len(job_list),
        'filter': status_filter
    })


@app.route('/api/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    """Cancel or delete a job."""
    try:
        uuid.UUID(job_id)
    except ValueError:
        return jsonify({'error': 'Invalid job_id format'}), 400
    
    with jobs_lock:
        job = jobs.get(job_id)
        
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Remove files
        files_removed = []
        for file_key in ['input_file', 'output_file']:
            filepath = job.get(file_key)
            if filepath and os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    files_removed.append(file_key)
                except Exception:
                    pass
        
        del jobs[job_id]
    
    logger.info(f"Job deleted: {job_id[:8]} | Files removed: {files_removed}")
    
    return jsonify({
        'success': True,
        'job_id': job_id,
        'files_removed': files_removed
    })

# =============================================================================
# GRACEFUL SHUTDOWN
# =============================================================================

shutdown_event = threading.Event()

def graceful_shutdown(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info("Received shutdown signal, cleaning up...")
    shutdown_event.set()
    
    # Terminate any active worker processes
    for job_id, proc in list(active_processes.items()):
        try:
            if proc.is_alive():
                logger.info(f"Terminating worker process for job {job_id[:8]}")
                proc.terminate()
                proc.join(timeout=2)
                if proc.is_alive():
                    proc.kill()
        except Exception as e:
            logger.warning(f"Error terminating process: {e}")
    
    # Close the multiprocessing queue to prevent semaphore leaks
    # NOTE: queue.Queue (threading) does NOT have close/join_thread methods
    # We only use those if using multiprocessing.Queue
    # try:
    #     job_updates_queue.close()
    #     job_updates_queue.join_thread()
    # except Exception as e:
    #     logger.warning(f"Error closing queue: {e}")
    
    # Give active jobs a moment to complete
    time.sleep(1)
    
    # Cleanup
    cleanup_old_jobs()
    
    logger.info("Shutdown complete")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, graceful_shutdown)
signal.signal(signal.SIGTERM, graceful_shutdown)

# Register atexit handler for cleanup on normal exit
def cleanup_on_exit():
    """Cleanup resources on normal program exit."""
    # try:
    #     job_updates_queue.close()
    # except Exception:
    #     pass
    for proc in active_processes.values():
        try:
            if proc.is_alive():
                proc.terminate()
        except Exception:
            pass

atexit.register(cleanup_on_exit)

# =============================================================================
# MAIN
# =============================================================================

def main():
    multiprocessing.freeze_support()  # CRITICAL: Required for PyInstaller + multiprocessing on macOS
    print()
    print("  VOXIS 4.0.0 Audio Processing Server")
    print("  Powered by Trinity v8.1 | Built by Glass Stone")
    print("  Copyright (c) 2026 Glass Stone. All rights reserved.")
    print("=" * 64)
    print(f"  Host:          {config.HOST}:{config.PORT}")
    print(f"  Upload folder: {config.UPLOAD_FOLDER}")
    print(f"  Output folder: {config.OUTPUT_FOLDER}")
    print(f"  Max file size: {config.MAX_CONTENT_LENGTH // (1024*1024)} MB")
    print(f"  Rate limit:    {config.RATE_LIMIT_REQUESTS} req/{config.RATE_LIMIT_WINDOW}s")
    print(f"  Job timeout:   {config.JOB_TIMEOUT_HOURS} hours")
    print(f"  Pipeline:      {'Available' if PIPELINE_AVAILABLE else 'Not Available'}")
    print(f"  Engine:        Trinity v8.1 (Always-On)")
    print(f"  Date:          {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 64)
    print()
    
    # Start cleanup scheduler
    start_cleanup_scheduler()
    
    # Run server (never use reloader when frozen — it crashes PyInstaller)
    is_frozen = getattr(sys, 'frozen', False)
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG if not is_frozen else False,
        threaded=True,
        use_reloader=False if is_frozen else config.DEBUG
    )

if __name__ == '__main__':
    main()
