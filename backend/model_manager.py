"""
VOXIS 3.2 Dense — Model Manager
Handles downloading, verifying, and managing AI model weights.
Models are pulled on first launch when the target machine is online.

Powered by Trinity v7 | Built by Glass Stone
Copyright (c) 2026 Glass Stone. All rights reserved.
"""

import os
import sys
import json
import hashlib
import logging
import threading
import time
import urllib.request
import urllib.error
import shutil
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger('VOXIS.ModelManager')


# =============================================================================
# MODEL REGISTRY
# =============================================================================

# Default model storage: ~/Library/Application Support/VOXIS Dense/models/ (macOS)
# or ~/.voxis-dense/models/ (Linux) or %APPDATA%/VOXIS Dense/models/ (Windows)
def get_default_model_dir():
    """Get platform-appropriate model storage directory."""
    if getattr(sys, 'frozen', False):
        # Running as packaged app
        if sys.platform == 'darwin':
            base = os.path.expanduser('~/Library/Application Support/VOXIS Dense')
        elif sys.platform == 'win32':
            base = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'VOXIS Dense')
        else:
            base = os.path.expanduser('~/.voxis-dense')
    else:
        # Dev mode — store in project backend dir
        base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.models')

    models_dir = os.path.join(base, 'models')
    os.makedirs(models_dir, exist_ok=True)
    return models_dir


MODEL_DIR = os.environ.get('VOXIS_MODEL_DIR', get_default_model_dir())

# Model definitions: what to download and where
MODELS = {
    'deepfilternet': {
        'name': 'Dense Neural Filter',
        'engine': 'DeepFilterNet3',
        'description': 'AI noise reduction model',
        'files': [
            {
                'url': 'https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/DeepFilterNet3.tar.gz',
                'filename': 'DeepFilterNet3.tar.gz',
                'extract': True,
                'size_mb': 12,
            }
        ],
        'check_import': 'df.enhance',
        'pip_package': 'deepfilternet',
    },
    'audiosr': {
        'name': 'Dense Diffusion Upscaler',
        'engine': 'AudioSR',
        'description': 'Neural audio super-resolution (48kHz)',
        'files': [
            {
                'url': 'https://huggingface.co/haoheliu/AudioSR/resolve/main/basic/pytorch_model.bin',
                'filename': 'audiosr_basic/pytorch_model.bin',
                'extract': False,
                'size_mb': 400,
            },
            {
                'url': 'https://huggingface.co/haoheliu/AudioSR/resolve/main/basic/config.json',
                'filename': 'audiosr_basic/config.json',
                'extract': False,
                'size_mb': 1,
            }
        ],
        'check_import': 'audiosr',
        'pip_package': 'audiosr',
    },
    'uvr5': {
        'name': 'Dense Source Separator',
        'engine': 'UVR5',
        'description': 'Vocal isolation and source separation',
        'files': [
            {
                'url': 'https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx',
                'filename': 'uvr5/UVR-MDX-NET-Inst_HQ_3.onnx',
                'extract': False,
                'size_mb': 67,
            }
        ],
        'check_import': 'audio_separator.separator',
        'pip_package': 'audio-separator[cpu]',
    },
}


# =============================================================================
# STATE TRACKING
# =============================================================================

class ModelState:
    """Thread-safe model download state tracker."""

    def __init__(self):
        self._lock = threading.Lock()
        self._state: Dict[str, Dict[str, Any]] = {}
        self._manifest_path = os.path.join(MODEL_DIR, 'manifest.json')
        self._load_manifest()

    def _load_manifest(self):
        """Load download manifest from disk."""
        try:
            if os.path.exists(self._manifest_path):
                with open(self._manifest_path, 'r') as f:
                    self._state = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load manifest: {e}")
            self._state = {}

    def _save_manifest(self):
        """Save download manifest to disk."""
        try:
            os.makedirs(os.path.dirname(self._manifest_path), exist_ok=True)
            with open(self._manifest_path, 'w') as f:
                json.dump(self._state, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save manifest: {e}")

    def get(self, model_id: str) -> Dict[str, Any]:
        with self._lock:
            return self._state.get(model_id, {
                'status': 'not_downloaded',
                'progress': 0,
                'error': None,
                'files_downloaded': [],
                'total_size_mb': 0,
                'downloaded_mb': 0,
            })

    def update(self, model_id: str, **kwargs):
        with self._lock:
            if model_id not in self._state:
                self._state[model_id] = {
                    'status': 'not_downloaded',
                    'progress': 0,
                    'error': None,
                    'files_downloaded': [],
                    'total_size_mb': 0,
                    'downloaded_mb': 0,
                }
            self._state[model_id].update(kwargs)
            self._save_manifest()

    def get_all(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            result = {}
            for model_id in MODELS:
                state = self._state.get(model_id, {
                    'status': 'not_downloaded',
                    'progress': 0,
                    'error': None,
                })
                result[model_id] = {
                    'name': MODELS[model_id]['name'],
                    'engine': MODELS[model_id]['engine'],
                    'description': MODELS[model_id]['description'],
                    'status': state.get('status', 'not_downloaded'),
                    'progress': state.get('progress', 0),
                    'error': state.get('error'),
                    'size_mb': sum(f.get('size_mb', 0) for f in MODELS[model_id]['files']),
                }
            return result


# Global state
_state = ModelState()


# =============================================================================
# DOWNLOAD ENGINE
# =============================================================================

def _check_connectivity() -> bool:
    """Check if the machine is online."""
    try:
        urllib.request.urlopen('https://huggingface.co', timeout=5)
        return True
    except:
        pass
    try:
        urllib.request.urlopen('https://github.com', timeout=5)
        return True
    except:
        return False


def _download_file(url: str, dest_path: str, progress_cb: Optional[Callable] = None) -> bool:
    """Download a single file with progress tracking."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    tmp_path = dest_path + '.tmp'

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'VOXIS-Dense/3.2 (ModelManager)'
        })
        response = urllib.request.urlopen(req, timeout=120)
        total = int(response.headers.get('Content-Length', 0))
        downloaded = 0
        block_size = 65536  # 64KB chunks

        with open(tmp_path, 'wb') as f:
            while True:
                chunk = response.read(block_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if progress_cb and total > 0:
                    progress_cb(downloaded, total)

        # Move temp file to final destination
        shutil.move(tmp_path, dest_path)
        return True

    except Exception as e:
        logger.error(f"Download failed: {url} -> {e}")
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass
        raise


def _extract_tar_gz(archive_path: str, dest_dir: str):
    """Extract a .tar.gz archive."""
    import tarfile
    with tarfile.open(archive_path, 'r:gz') as tar:
        tar.extractall(path=dest_dir)
    logger.info(f"Extracted: {archive_path}")


def download_model(model_id: str, progress_callback: Optional[Callable] = None) -> bool:
    """
    Download a single model's weights.
    Returns True if successful, False otherwise.
    """
    if model_id not in MODELS:
        logger.error(f"Unknown model: {model_id}")
        return False

    model = MODELS[model_id]
    model_dir = os.path.join(MODEL_DIR, model_id)
    os.makedirs(model_dir, exist_ok=True)

    _state.update(model_id, status='downloading', progress=0, error=None)
    logger.info(f"Downloading {model['name']} ({model['engine']})...")

    total_files = len(model['files'])
    files_done = 0

    try:
        for file_info in model['files']:
            dest_path = os.path.join(model_dir, file_info['filename'])

            # Skip if already downloaded
            if os.path.exists(dest_path):
                files_done += 1
                overall = int((files_done / total_files) * 100)
                _state.update(model_id, progress=overall)
                logger.info(f"Already exists: {file_info['filename']}")
                continue

            # Download with per-file progress
            def file_progress(downloaded, total):
                file_pct = (downloaded / total) * 100 if total > 0 else 0
                overall = int(((files_done + file_pct / 100) / total_files) * 100)
                _state.update(model_id, progress=overall,
                              downloaded_mb=round(downloaded / (1024 * 1024), 1))
                if progress_callback:
                    progress_callback(model_id, overall)

            _download_file(file_info['url'], dest_path, file_progress)

            # Extract if needed
            if file_info.get('extract') and dest_path.endswith('.tar.gz'):
                _extract_tar_gz(dest_path, model_dir)

            files_done += 1
            overall = int((files_done / total_files) * 100)
            _state.update(model_id, progress=overall)

        _state.update(model_id, status='ready', progress=100, error=None)
        logger.info(f"{model['name']} downloaded successfully")
        return True

    except Exception as e:
        error_msg = str(e)
        _state.update(model_id, status='error', error=error_msg)
        logger.error(f"Failed to download {model['name']}: {error_msg}")
        return False


def download_all_models(progress_callback: Optional[Callable] = None) -> Dict[str, bool]:
    """Download all models sequentially. Returns dict of {model_id: success}."""
    results = {}
    for model_id in MODELS:
        state = _state.get(model_id)
        if state.get('status') == 'ready':
            results[model_id] = True
            continue
        results[model_id] = download_model(model_id, progress_callback)
    return results


# =============================================================================
# BACKGROUND DOWNLOAD THREAD
# =============================================================================

_download_thread: Optional[threading.Thread] = None
_download_cancel = threading.Event()


def start_background_download(model_id: Optional[str] = None,
                               progress_callback: Optional[Callable] = None):
    """Start downloading models in a background thread."""
    global _download_thread

    if _download_thread and _download_thread.is_alive():
        logger.warning("Download already in progress")
        return False

    _download_cancel.clear()

    def _worker():
        if not _check_connectivity():
            logger.warning("No internet connection — model download deferred")
            return

        if model_id:
            download_model(model_id, progress_callback)
        else:
            download_all_models(progress_callback)

    _download_thread = threading.Thread(target=_worker, daemon=True, name='ModelDownloader')
    _download_thread.start()
    return True


def cancel_download():
    """Signal the download thread to stop."""
    _download_cancel.set()


def is_downloading() -> bool:
    """Check if a download is in progress."""
    return _download_thread is not None and _download_thread.is_alive()


# =============================================================================
# STATUS API
# =============================================================================

def get_model_status() -> Dict[str, Any]:
    """Get status of all models."""
    models = _state.get_all()
    all_ready = all(m['status'] == 'ready' for m in models.values())
    any_downloading = any(m['status'] == 'downloading' for m in models.values())
    total_size = sum(m['size_mb'] for m in models.values())

    return {
        'models': models,
        'all_ready': all_ready,
        'any_downloading': any_downloading,
        'total_size_mb': total_size,
        'model_dir': MODEL_DIR,
        'online': _check_connectivity(),
    }


def get_single_model_status(model_id: str) -> Optional[Dict[str, Any]]:
    """Get status of a single model."""
    if model_id not in MODELS:
        return None
    state = _state.get(model_id)
    return {
        'name': MODELS[model_id]['name'],
        'engine': MODELS[model_id]['engine'],
        'status': state.get('status', 'not_downloaded'),
        'progress': state.get('progress', 0),
        'error': state.get('error'),
        'size_mb': sum(f.get('size_mb', 0) for f in MODELS[model_id]['files']),
    }


def check_and_init_models():
    """
    Called on server startup.
    Checks which models are available and marks them as ready.
    For missing models, starts background download if online.
    """
    logger.info("Checking model availability...")

    for model_id, model in MODELS.items():
        model_dir = os.path.join(MODEL_DIR, model_id)
        all_present = True

        for file_info in model['files']:
            dest_path = os.path.join(model_dir, file_info['filename'])
            if not os.path.exists(dest_path):
                all_present = False
                break

        if all_present:
            _state.update(model_id, status='ready', progress=100)
            logger.info(f"  {model['name']}: READY")
        else:
            # Also check if the Python package is importable (dev mode)
            try:
                __import__(model['check_import'])
                _state.update(model_id, status='ready', progress=100)
                logger.info(f"  {model['name']}: READY (package installed)")
            except ImportError:
                _state.update(model_id, status='not_downloaded', progress=0)
                logger.info(f"  {model['name']}: NOT DOWNLOADED")

    # Auto-start background download for missing models
    missing = [mid for mid, m in MODELS.items()
               if _state.get(mid).get('status') != 'ready']

    if missing:
        logger.info(f"Missing models: {', '.join(missing)} — will download when online")
        start_background_download()
    else:
        logger.info("All models ready")
