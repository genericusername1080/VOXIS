"""
VOXIS Backend Server v2.0
Powered by Trinity | Built by Glass Stone

Production-ready Flask REST API for audio processing pipeline.

Features:
- Structured logging with timestamps
- Request validation and sanitization
- Rate limiting per IP
- Graceful shutdown handling
- Automatic job cleanup
- Disk space monitoring
- Comprehensive error handling

Endpoints:
  GET  /api/health         - Health check with system stats
  GET  /api/stats          - Server statistics
  POST /api/upload         - Upload audio file
  POST /api/process        - Start processing job
  GET  /api/status/<id>    - Get job status
  GET  /api/download/<id>  - Download processed file
  GET  /api/jobs           - List all jobs
  DELETE /api/jobs/<id>    - Cancel/delete job
"""

import os
import patch_torchaudio # FIX: Compatibility for DeepFilterNet with Torch 2.x
import sys
import uuid
import json
import signal
import threading
import time
import shutil
import logging
import atexit
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from functools import wraps
from collections import defaultdict

# Add local libs directory to path for bundled deployments
libs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'libs')
if os.path.exists(libs_path):
    sys.path.insert(0, libs_path)

# Handle bundled binaries (ffmpeg)
# When frozen, sys._MEIPASS contains the temp folder path (onefile)
# For onedir, we rely on sys.executable location + _internal
if getattr(sys, 'frozen', False):
    if hasattr(sys, '_MEIPASS'):
        base_path = sys._MEIPASS
    else:
        # onedir mode: binaries are in _internal relative to executable
        # But wait, PyInstaller onedir puts data in _internal unless configured otherwise
        # Check if _internal exists next to executable
        exe_dir = os.path.dirname(sys.executable)
        if os.path.exists(os.path.join(exe_dir, '_internal')):
            base_path = os.path.join(exe_dir, '_internal')
        else:
            base_path = exe_dir

    # Determine OS-specific bin folder
    if sys.platform == 'win32':
        bin_path = os.path.join(base_path, 'bin', 'win')
    elif sys.platform == 'darwin':
        bin_path = os.path.join(base_path, 'bin', 'mac')
    else:
        bin_path = os.path.join(base_path, 'bin', 'linux')

    if os.path.exists(bin_path):
        os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
        logging.info(f"Added bundled binaries to PATH: {bin_path}")

from flask import Flask, request, jsonify, send_file, g
from werkzeug.utils import secure_filename
from flask_cors import CORS
from dotenv import load_dotenv

# Initialize structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('VOXIS')

# Try to import pipeline
try:
    from pipeline import VoxisPipeline, create_pipeline
    PIPELINE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Pipeline import failed: {e}")
    PIPELINE_AVAILABLE = False

# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Server configuration with environment variable support."""
    
    # Paths
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.environ.get('VOXIS_UPLOAD_DIR', os.path.join(BASE_DIR, 'uploads'))
    OUTPUT_FOLDER = os.environ.get('VOXIS_OUTPUT_DIR', os.path.join(BASE_DIR, 'outputs'))
    
    # File settings
    MAX_CONTENT_LENGTH = int(os.environ.get('VOXIS_MAX_FILE_SIZE', 500 * 1024 * 1024))  # 500MB
    ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac', 'wma'}
    
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
    PORT = int(os.environ.get('VOXIS_PORT', 5001))
    DEBUG = os.environ.get('VOXIS_DEBUG', 'true').lower() == 'true'

config = Config()

# Ensure directories exist
os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(config.OUTPUT_FOLDER, exist_ok=True)

# =============================================================================
# FLASK APP INITIALIZATION
# =============================================================================

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = config.OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

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
jobs_lock = threading.Lock()
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

def process_audio_job(job_id: str, input_path: str, output_path: str, job_config: dict):
    """Background job to process audio with error handling."""
    try:
        logger.info(f"Job {job_id[:8]} | Starting processing")
        
        with jobs_lock:
            jobs[job_id]['status'] = 'processing'
            jobs[job_id]['started_at'] = datetime.utcnow().isoformat()
        
        if not PIPELINE_AVAILABLE:
            raise RuntimeError("Audio processing pipeline not available")
        
        # Create pipeline with config
        pipeline = create_pipeline(job_config)
        
        # Progress callback
        def on_progress(stage: str, progress: int):
            update_job_status(job_id, stage, progress)
        
        # Run processing
        results = pipeline.process(input_path, output_path, progress_callback=on_progress)
        
        with jobs_lock:
            if results.get('success'):
                jobs[job_id]['status'] = 'complete'
                jobs[job_id]['results'] = results
                jobs[job_id]['output_file'] = output_path
                server_stats['completed_jobs'] += 1
                
                # Track bytes processed
                if os.path.exists(output_path):
                    server_stats['bytes_processed'] += os.path.getsize(output_path)
                
                logger.info(f"Job {job_id[:8]} | Completed successfully")
            else:
                jobs[job_id]['status'] = 'error'
                jobs[job_id]['error'] = results.get('error', 'Unknown processing error')
                server_stats['failed_jobs'] += 1
                logger.error(f"Job {job_id[:8]} | Failed: {results.get('error')}")
            
            jobs[job_id]['completed_at'] = datetime.utcnow().isoformat()
            
    except Exception as e:
        logger.exception(f"Job {job_id[:8]} | Exception: {e}")
        with jobs_lock:
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = str(e)
            jobs[job_id]['completed_at'] = datetime.utcnow().isoformat()
            server_stats['failed_jobs'] += 1

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
        'service': 'VOXIS Backend',
        'version': '1.0.5',
        'powered_by': 'Trinity',
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
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
    
    # Check AudioSR
    audiosr_path = os.path.join(models_dir, 'AudioSR', 'audiosr-basic')
    audiosr_status = {
        'available': os.path.exists(audiosr_path),
        'path': audiosr_path if os.path.exists(audiosr_path) else None,
        'model': 'audiosr-basic'
    }
    
    # Check DeepFilterNet (checking for generic presence since it's harder to check specific weights without loading)
    df_dir = os.path.join(models_dir, 'DeepFilterNet')
    df_status = {
        'available': os.path.exists(df_dir) and len(os.listdir(df_dir)) > 0 if os.path.exists(df_dir) else False,
        'path': df_dir,
        'model': 'DeepFilterNet3'
    }
    
    return jsonify({
        'audiosr': audiosr_status,
        'deepfilternet': df_status,
        'pipeline_loaded': PIPELINE_AVAILABLE
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
        filepath = os.path.join(config.UPLOAD_FOLDER, filename)
        
        # Save file
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        
        server_stats['total_uploads'] += 1
        logger.info(f"Upload complete: {file_id[:8]} | {original_filename} | {file_size/1024:.1f}KB")
        
        return jsonify({
            'success': True,
            'file_id': file_id,
            'filename': original_filename,
            'size': file_size,
            'uploaded_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.exception(f"Upload error: {e}")
        return jsonify({'error': 'Upload failed', 'message': str(e)}), 500


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
        job_config = {
            'denoise_strength': min(1.0, max(0.0, float(data.get('denoise_strength', 75)) / 100.0)),
            'high_precision': bool(data.get('high_precision', True)),
            'upscale_factor': min(4, max(1, int(data.get('upscale_factor', 2)))),
            'target_sample_rate': int(data.get('target_sample_rate', 48000)),
            'target_channels': min(2, max(1, int(data.get('target_channels', 2))))
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
    
    with jobs_lock:
        jobs[job_id] = {
            'job_id': job_id,
            'file_id': file_id,
            'status': 'queued',
            'current_stage': 'upload',
            'progress': 0,
            'config': job_config,
            'input_file': input_path,
            'output_file': None,
            'stages': {},
            'results': None,
            'error': None,
            'created_at': datetime.utcnow().isoformat(),
            'started_at': None,
            'completed_at': None,
            'updated_at': datetime.utcnow().isoformat()
        }
        server_stats['total_jobs'] += 1
    
    # Start processing in background thread
    thread = threading.Thread(
        target=process_audio_job,
        args=(job_id, input_path, output_path, job_config),
        daemon=True
    )
    thread.start()
    
    logger.info(f"Job created: {job_id[:8]} | Config: {job_config}")
    
    return jsonify({
        'success': True,
        'job_id': job_id,
        'status': 'queued',
        'message': 'Processing started'
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
    
    download_name = f"voxis_restored_{job_id[:8]}.wav"
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
    
    # If WAV, just send the original file
    if export_format == 'wav':
        download_name = f"voxis_restored_{job_id[:8]}.wav"
        return send_file(
            job['output_file'],
            mimetype='audio/wav',
            as_attachment=True,
            download_name=download_name
        )
    
    # For FLAC/MP3, convert using pydub
    try:
        from pydub import AudioSegment
    except ImportError:
        return jsonify({
            'error': 'Format conversion not available',
            'message': 'Install pydub: pip install pydub'
        }), 500
    
    try:
        # Load the WAV file
        audio = AudioSegment.from_wav(job['output_file'])
        
        # Create temp output file
        output_ext = export_format
        output_filename = f"voxis_export_{job_id[:8]}.{output_ext}"
        output_path = os.path.join(config.OUTPUT_FOLDER, output_filename)
        
        if export_format == 'flac':
            # Export as FLAC (lossless)
            audio.export(output_path, format='flac')
            mimetype = 'audio/flac'
            
        elif export_format == 'mp3':
            # MP3 bitrates based on quality
            bitrates = {
                'low': '128k',
                'medium': '192k',
                'high': '320k'
            }
            bitrate = bitrates.get(quality, '320k')
            
            audio.export(
                output_path, 
                format='mp3',
                bitrate=bitrate,
                parameters=["-q:a", "0"]  # Highest quality VBR
            )
            mimetype = 'audio/mpeg'
        
        logger.info(f"Export: {job_id[:8]} | {export_format.upper()} | {quality}")
        
        return send_file(
            output_path,
            mimetype=mimetype,
            as_attachment=True,
            download_name=output_filename
        )
        
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
    
    # Give active jobs a moment to complete
    time.sleep(1)
    
    # Cleanup
    cleanup_old_jobs()
    
    logger.info("Shutdown complete")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, graceful_shutdown)
signal.signal(signal.SIGTERM, graceful_shutdown)

# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print()
    print("=" * 64)
    print("  VOXIS Audio Processing Server v2.0")
    print("  Powered by Trinity | Built by Glass Stone")
    print("=" * 64)
    print(f"  Host:          {config.HOST}:{config.PORT}")
    print(f"  Upload folder: {config.UPLOAD_FOLDER}")
    print(f"  Output folder: {config.OUTPUT_FOLDER}")
    print(f"  Max file size: {config.MAX_CONTENT_LENGTH // (1024*1024)} MB")
    print(f"  Rate limit:    {config.RATE_LIMIT_REQUESTS} req/{config.RATE_LIMIT_WINDOW}s")
    print(f"  Job timeout:   {config.JOB_TIMEOUT_HOURS} hours")
    print(f"  Pipeline:      {'Available' if PIPELINE_AVAILABLE else 'Not Available'}")
    print("=" * 64)
    print()
    
    # Start cleanup scheduler
    start_cleanup_scheduler()
    
    # Run server
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG,
        threaded=True,
        use_reloader=config.DEBUG
    )
