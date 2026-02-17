"""
VOXIS 3.2 Dense Backend Server
Powered by Trinity v7 | Built by Glass Stone
Copyright (c) 2026 Glass Stone. All rights reserved.
"""

import os, sys, uuid, signal, threading, time, shutil, logging
from datetime import datetime, timedelta
from functools import wraps
from collections import defaultdict

libs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'libs')
if os.path.exists(libs_path):
    sys.path.insert(0, libs_path)

if getattr(sys, 'frozen', False):
    base = getattr(sys, '_MEIPASS', None)
    if not base:
        exe_dir = os.path.dirname(sys.executable)
        base = os.path.join(exe_dir, '_internal') if os.path.exists(os.path.join(exe_dir, '_internal')) else exe_dir
    bp = os.path.join(base, 'bin', {'win32': 'win', 'darwin': 'mac'}.get(sys.platform, 'linux'))
    if os.path.exists(bp):
        os.environ["PATH"] = bp + os.pathsep + os.environ["PATH"]

from flask import Flask, request, jsonify, send_file, g
from werkzeug.utils import secure_filename
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger('VOXIS')

try:
    from pipeline import create_pipeline
    PIPELINE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Pipeline import failed: {e}")
    PIPELINE_AVAILABLE = False

try:
    from model_manager import (
        get_model_status, get_single_model_status,
        start_background_download, cancel_download,
        is_downloading, check_and_init_models
    )
    MODEL_MANAGER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Model manager import failed: {e}")
    MODEL_MANAGER_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.environ.get('VOXIS_UPLOAD_DIR', os.path.join(BASE_DIR, 'uploads'))
OUTPUT_DIR = os.environ.get('VOXIS_OUTPUT_DIR', os.path.join(BASE_DIR, 'outputs'))
MAX_SIZE = int(os.environ.get('VOXIS_MAX_FILE_SIZE', 500 * 1024 * 1024))
HOST = os.environ.get('VOXIS_HOST', '0.0.0.0')
PORT = int(os.environ.get('VOXIS_PORT', 5001))
AUDIO_EXT = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'aiff'}
VIDEO_EXT = {'mp4', 'mov', 'mkv', 'avi', 'webm'}
ALL_EXT = AUDIO_EXT | VIDEO_EXT

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_SIZE
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Rate limiter
_rate = defaultdict(list)
_rate_lock = threading.Lock()

def rate_limit(f):
    @wraps(f)
    def wrapped(*a, **kw):
        ip = request.remote_addr or '?'
        with _rate_lock:
            now = time.time()
            _rate[ip] = [t for t in _rate[ip] if t > now - 60]
            if len(_rate[ip]) >= 30:
                return jsonify({'error': 'Rate limit'}), 429
            _rate[ip].append(now)
        return f(*a, **kw)
    return wrapped

# Jobs
jobs = {}
jobs_lock = threading.Lock()
stats = {'start': datetime.utcnow().isoformat(), 'uploads': 0, 'jobs': 0, 'ok': 0, 'fail': 0}

def allowed_file(fn):
    return '.' in fn and fn.rsplit('.', 1)[1].lower() in ALL_EXT

def update_job(jid, stage, progress):
    with jobs_lock:
        if jid in jobs:
            jobs[jid].update(current_stage=stage, progress=progress, updated_at=datetime.utcnow().isoformat())

def run_job(jid, inp, out, cfg):
    try:
        with jobs_lock:
            jobs[jid]['status'] = 'processing'
            jobs[jid]['started_at'] = datetime.utcnow().isoformat()
        if not PIPELINE_AVAILABLE:
            raise RuntimeError("Pipeline not available")
        pipeline = create_pipeline(cfg)
        res = pipeline.process(inp, out, progress_callback=lambda s, p: update_job(jid, s, p))
        with jobs_lock:
            if res.get('success'):
                jobs[jid].update(status='complete', results=res, output_file=out)
                stats['ok'] += 1
            else:
                jobs[jid].update(status='error', error=res.get('error', 'Unknown'))
                stats['fail'] += 1
            jobs[jid]['completed_at'] = datetime.utcnow().isoformat()
    except Exception as e:
        logger.exception(f"Job {jid[:8]}: {e}")
        with jobs_lock:
            jobs[jid].update(status='error', error=str(e), completed_at=datetime.utcnow().isoformat())
            stats['fail'] += 1

def cleanup():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    rm = []
    with jobs_lock:
        for jid, j in jobs.items():
            ca = j.get('completed_at')
            if ca:
                try:
                    if datetime.fromisoformat(ca) < cutoff:
                        rm.append(jid)
                        for k in ['input_file', 'output_file']:
                            fp = j.get(k)
                            if fp and os.path.exists(fp):
                                try: os.remove(fp)
                                except: pass
                except: pass
        for jid in rm: del jobs[jid]

def cleanup_loop():
    while True:
        time.sleep(3600)
        try: cleanup()
        except: pass
threading.Thread(target=cleanup_loop, daemon=True).start()

@app.before_request
def _before(): g.t = time.time()

@app.after_request
def _after(r):
    logger.info(f"{request.method} {request.path} {r.status_code} {(time.time()-getattr(g,'t',time.time()))*1000:.0f}ms")
    return r

@app.errorhandler(413)
def _413(e): return jsonify({'error': 'File too large'}), 413

@app.errorhandler(500)
def _500(e):
    logger.exception(f"Internal server error: {e}")
    return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.errorhandler(Exception)
def _unhandled(e):
    logger.exception(f"Unhandled exception: {e}")
    return jsonify({'error': f'Server error: {str(e)}'}), 500

# === ROUTES ===

@app.route('/api/health')
def health():
    resp = {'status': 'healthy', 'service': 'VOXIS 3.2 Dense',
            'powered_by': 'Trinity v7', 'built_by': 'Glass Stone',
            'pipeline': PIPELINE_AVAILABLE, 'timestamp': datetime.utcnow().isoformat()}
    if MODEL_MANAGER_AVAILABLE:
        try:
            ms = get_model_status()
            resp['models_ready'] = ms.get('all_ready', False)
            resp['models_downloading'] = ms.get('any_downloading', False)
        except:
            pass
    return jsonify(resp)

@app.route('/api/stats')
def get_stats():
    with jobs_lock:
        js = {'total': len(jobs), 'processing': sum(1 for j in jobs.values() if j['status']=='processing')}
    return jsonify({'stats': stats, 'jobs': js})

@app.route('/api/upload', methods=['POST'])
@rate_limit
def upload():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    f = request.files['file']
    if not f.filename or not allowed_file(f.filename): return jsonify({'error': 'Invalid file'}), 400
    fid = str(uuid.uuid4())
    ext = secure_filename(f.filename).rsplit('.', 1)[1].lower() if '.' in f.filename else 'wav'
    path = os.path.join(UPLOAD_DIR, f"{fid}.{ext}")
    f.save(path)
    stats['uploads'] += 1
    return jsonify({'success': True, 'file_id': fid, 'filename': secure_filename(f.filename), 'size': os.path.getsize(path)})

@app.route('/api/process', methods=['POST'])
@rate_limit
def process():
    try:
        if not request.is_json: return jsonify({'error': 'JSON required'}), 400
        d = request.get_json()
        if not d or 'file_id' not in d: return jsonify({'error': 'file_id required'}), 400
        fid = d['file_id']
        try: uuid.UUID(fid)
        except: return jsonify({'error': 'Bad file_id'}), 400

        inp = None
        for ext in ALL_EXT:
            p = os.path.join(UPLOAD_DIR, f"{fid}.{ext}")
            if os.path.exists(p): inp = p; break
        if not inp: return jsonify({'error': 'File not found'}), 404

        cfg = {
            'mode': d.get('mode', 'standard'),
            'denoise_strength': min(1.0, max(0.0, float(d.get('denoise_strength', 85)) / 100.0)),
            'high_precision': bool(d.get('high_precision', True)),
            'upscale_factor': min(4, max(1, int(d.get('upscale_factor', 2)))),
            'target_sample_rate': int(d.get('target_sample_rate', 48000)),
            'target_channels': min(2, max(1, int(d.get('target_channels', 2))))
        }
        if cfg['target_sample_rate'] not in [44100, 48000, 96000]: cfg['target_sample_rate'] = 48000

        jid = str(uuid.uuid4())
        out = os.path.join(OUTPUT_DIR, f"voxis_dense_{jid}.wav")
        with jobs_lock:
            jobs[jid] = {'job_id': jid, 'file_id': fid, 'status': 'queued', 'current_stage': 'upload',
                         'progress': 0, 'config': cfg, 'input_file': inp, 'output_file': None,
                         'results': None, 'error': None, 'created_at': datetime.utcnow().isoformat(),
                         'started_at': None, 'completed_at': None, 'updated_at': datetime.utcnow().isoformat()}
            stats['jobs'] += 1
        threading.Thread(target=run_job, args=(jid, inp, out, cfg), daemon=True).start()
        return jsonify({'success': True, 'job_id': jid, 'status': 'queued'})
    except Exception as e:
        logger.exception(f"Process endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/<jid>')
def status(jid):
    try: uuid.UUID(jid)
    except: return jsonify({'error': 'Bad id'}), 400
    with jobs_lock: j = jobs.get(jid)
    if not j: return jsonify({'error': 'Not found'}), 404
    return jsonify({k: j[k] for k in ['job_id','status','current_stage','progress','error','results','created_at','completed_at']})

@app.route('/api/download/<jid>')
def download(jid):
    try: uuid.UUID(jid)
    except: return jsonify({'error': 'Bad id'}), 400
    with jobs_lock: j = jobs.get(jid)
    if not j: return jsonify({'error': 'Not found'}), 404
    if j['status'] != 'complete': return jsonify({'error': 'Not complete'}), 400
    if not j.get('output_file') or not os.path.exists(j['output_file']): return jsonify({'error': 'No output'}), 404
    return send_file(j['output_file'], mimetype='audio/wav', as_attachment=True,
                     download_name=f"voxis_dense_{jid[:8]}.wav")

@app.route('/api/export/<jid>')
def export(jid):
    try: uuid.UUID(jid)
    except: return jsonify({'error': 'Bad id'}), 400
    with jobs_lock: j = jobs.get(jid)
    if not j or j['status'] != 'complete': return jsonify({'error': 'Not ready'}), 400
    if not j.get('output_file') or not os.path.exists(j['output_file']): return jsonify({'error': 'No output'}), 404
    fmt = request.args.get('format', 'wav').lower()
    if fmt == 'wav':
        return send_file(j['output_file'], mimetype='audio/wav', as_attachment=True,
                         download_name=f"voxis_dense_{jid[:8]}.wav")
    try:
        from pydub import AudioSegment
        a = AudioSegment.from_wav(j['output_file'])
        out = os.path.join(OUTPUT_DIR, f"voxis_{jid[:8]}.{fmt}")
        if fmt == 'flac': a.export(out, format='flac')
        elif fmt == 'mp3': a.export(out, format='mp3', bitrate='320k')
        else: return jsonify({'error': 'Bad format'}), 400
        mime = {'flac': 'audio/flac', 'mp3': 'audio/mpeg'}[fmt]
        return send_file(out, mimetype=mime, as_attachment=True, download_name=os.path.basename(out))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs')
def list_jobs():
    with jobs_lock:
        jl = [{'job_id': j['job_id'], 'status': j['status'], 'progress': j['progress']}
              for j in sorted(jobs.values(), key=lambda x: x['created_at'], reverse=True)[:50]]
    return jsonify({'jobs': jl})

@app.route('/api/jobs/<jid>', methods=['DELETE'])
def delete_job(jid):
    try: uuid.UUID(jid)
    except: return jsonify({'error': 'Bad id'}), 400
    with jobs_lock:
        j = jobs.get(jid)
        if not j: return jsonify({'error': 'Not found'}), 404
        for k in ['input_file', 'output_file']:
            fp = j.get(k)
            if fp and os.path.exists(fp):
                try: os.remove(fp)
                except: pass
        del jobs[jid]
    return jsonify({'success': True})

# === MODEL MANAGEMENT ROUTES ===

@app.route('/api/models')
def models_status():
    """Get status of all AI models (downloaded, downloading, missing)."""
    if not MODEL_MANAGER_AVAILABLE:
        return jsonify({'error': 'Model manager not available'}), 503
    return jsonify(get_model_status())

@app.route('/api/models/<model_id>')
def model_status(model_id):
    """Get status of a specific model."""
    if not MODEL_MANAGER_AVAILABLE:
        return jsonify({'error': 'Model manager not available'}), 503
    status = get_single_model_status(model_id)
    if not status:
        return jsonify({'error': 'Unknown model'}), 404
    return jsonify(status)

@app.route('/api/models/download', methods=['POST'])
@rate_limit
def models_download():
    """Start downloading models. Optional: specify model_id for single model."""
    if not MODEL_MANAGER_AVAILABLE:
        return jsonify({'error': 'Model manager not available'}), 503
    d = request.get_json() or {}
    model_id = d.get('model_id')  # None = download all
    if is_downloading():
        return jsonify({'error': 'Download already in progress', 'downloading': True}), 409
    started = start_background_download(model_id=model_id)
    return jsonify({'success': started, 'downloading': started})

@app.route('/api/models/cancel', methods=['POST'])
def models_cancel():
    """Cancel ongoing model download."""
    if not MODEL_MANAGER_AVAILABLE:
        return jsonify({'error': 'Model manager not available'}), 503
    cancel_download()
    return jsonify({'success': True})

def _shutdown(sig, frame):
    logger.info("Shutdown"); cleanup(); sys.exit(0)
signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)

if __name__ == '__main__':
    print("\n" + "="*48)
    print("  VOXIS 3.2 Dense Server")
    print("  Powered by Trinity v7 | Glass Stone")
    print("  (c) 2026 Glass Stone")
    print("="*48)
    print(f"  Port: {PORT} | Pipeline: {'OK' if PIPELINE_AVAILABLE else 'N/A'}")
    print(f"  Models: {'OK' if MODEL_MANAGER_AVAILABLE else 'N/A'}")
    print("="*48 + "\n")

    # Check and auto-download missing models on startup
    if MODEL_MANAGER_AVAILABLE:
        check_and_init_models()

    app.run(host=HOST, port=PORT, debug=False, threaded=True)
