import logging
import sys
import os
import time
import multiprocessing
import queue  # For exception handling
import threading
from datetime import datetime

# ─── PERSISTENT PIPELINE CACHE ────────────────────────────────────────────────
# The pipeline takes 15-30s to load all models (DeepFilterNet, VoiceRestore,
# Diff-HierVC, AudioSR, PhaseLimiter). Re-loading on every job is wasteful.
# This module-level cache keeps the pipeline alive between jobs so only the
# first job pays the startup cost. Subsequent jobs start processing immediately.
# ──────────────────────────────────────────────────────────────────────────────

_pipeline_cache = None
_pipeline_cache_lock = threading.Lock()
_pipeline_config_hash = None


def _config_hash(config: dict) -> str:
    """Create a hashable key from pipeline config. Only re-create pipeline if config changes."""
    # These are the only params that affect pipeline construction
    keys = sorted(config.keys())
    return "|".join(f"{k}={config[k]}" for k in keys)


def _get_or_create_pipeline(job_config: dict, logger):
    """Return cached pipeline or create a new one. Thread-safe."""
    global _pipeline_cache, _pipeline_config_hash

    with _pipeline_cache_lock:
        new_hash = _config_hash(job_config)

        if _pipeline_cache is not None and _pipeline_config_hash == new_hash:
            logger.info("PIPELINE CACHE HIT — reusing loaded models (0s load time)")
            return _pipeline_cache

        # Cache miss — need to create/recreate
        if _pipeline_cache is not None:
            logger.info("PIPELINE CACHE MISS — config changed, rebuilding")
            # Help GC collect the old pipeline's models
            del _pipeline_cache
            _pipeline_cache = None
            import gc
            gc.collect()
        else:
            logger.info("PIPELINE CACHE MISS — first load, initializing models")

        try:
            from backend.pipeline import create_pipeline
        except ImportError:
            from pipeline import create_pipeline
        pipeline = create_pipeline(job_config)
        _pipeline_cache = pipeline
        _pipeline_config_hash = new_hash
        return pipeline


# Helper for logging configuration in worker
def setup_worker_logging(job_id):
    # Use a separate logger for the worker to avoid conflict with main process
    return logging.getLogger(f"worker-{job_id[:8]}")


def worker_process_entrypoint(job_id: str, input_path: str, output_path: str, job_config: dict, queue_obj):
    """
    Isolated worker function.
    Runs in a separate thread to prevent SIGSEGV from killing the main server.

    PERFORMANCE: Uses persistent pipeline cache — only the first job loads models.
    Subsequent jobs reuse the cached pipeline and start processing immediately.
    """
    logger = setup_worker_logging(job_id)
    logger.info(f"Worker started for job {job_id}. PID: {os.getpid()}")

    try:
        t0 = time.time()

        # We use queue_obj passed from server
        queue_obj.put(('status', job_id, 'processing'))
        queue_obj.put(('started', job_id, datetime.utcnow().isoformat()))

        # Ensure root dir is in path for absolute backend.* imports
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(current_dir)
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)

        # Apply torchaudio patch — must be before torchaudio import
        # Handle both dev mode (backend.utils.*) and PyInstaller frozen mode
        try:
            import backend.utils.patch_torchaudio as patch_torchaudio
        except ImportError:
            try:
                import utils.patch_torchaudio as patch_torchaudio
            except ImportError:
                logger.warning("patch_torchaudio not found — DeepFilterNet may fail")

        try:
            from backend.pipeline import PIPELINE_AVAILABLE
        except ImportError:
            try:
                from pipeline import PIPELINE_AVAILABLE
            except ImportError as e:
                logger.error(f"Pipeline import error: {e}")
                PIPELINE_AVAILABLE = False

        if not PIPELINE_AVAILABLE:
            raise RuntimeError("Audio processing pipeline not available in worker")

        t1 = time.time()
        logger.info(f"Pipeline module imported in {t1-t0:.1f}s")

        # ── GET OR REUSE CACHED PIPELINE ──────────────────────────────────
        pipeline = _get_or_create_pipeline(job_config, logger)
        t2 = time.time()
        logger.info(f"Pipeline ready in {t2-t1:.1f}s (cached={t2-t1 < 1.0})")

        # Progress callback
        def on_progress(stage: str, progress: int, details: dict = None):
            queue_obj.put(('progress', job_id, stage, progress))

        # Run processing
        logger.info("Starting pipeline processing...")
        results = pipeline.process(input_path, output_path, status_callback=on_progress)

        t3 = time.time()
        if results.get('success'):
            queue_obj.put(('complete', job_id, results, output_path))
            logger.info(f"Processing complete in {t3-t2:.1f}s (total {t3-t0:.1f}s)")
        else:
            queue_obj.put(('error', job_id, results.get('error', 'Unknown error')))
            logger.error(f"Processing failed: {results.get('error')}")

    except Exception as e:
        logger.exception(f"Worker exception: {e}")
        try:
            queue_obj.put(('error', job_id, str(e)))
        except Exception:
            pass  # Queue might be closed
    finally:
        # PERFORMANCE: Only flush GPU cache, don't destroy the pipeline
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
        logger.info("Worker thread exiting (pipeline cached for next job)")
