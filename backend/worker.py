import logging
import sys
import os
import time
import multiprocessing
import queue  # For exception handling
from datetime import datetime

# Helper for logging configuration in worker
# Helper for logging configuration in worker
def setup_worker_logging(job_id):
    # THREADING MODE: Do not mess with root logger handlers!
    # root = logging.getLogger()
    # if root.handlers:
    #     for handler in root.handlers:
    #         root.removeHandler(handler)
            
    # log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server.log')
    # logging.basicConfig(
    #     level=logging.INFO, 
    #     format='%(asctime)s | %(levelname)-8s | WORKER | %(message)s',
    #     datefmt='%Y-%m-%d %H:%M:%S',
    #     handlers=[
    #         logging.FileHandler(log_path),
    #         logging.StreamHandler(sys.stdout)
    #     ]
    # )
    return logging.getLogger(f"worker-{job_id[:8]}")

def worker_process_entrypoint(job_id: str, input_path: str, output_path: str, job_config: dict, queue_obj: multiprocessing.Queue):
    """
    Isolated worker process function.
    Runs in a separate process to prevent SIGSEGV from killing the main server.

    PERFORMANCE: All heavy imports (torch, pipeline, etc.) happen HERE,
    not in the main server process. This keeps the server responsive.
    """
    # RAW DEBUG to stderr to ensure we see it in terminal
    sys.stderr.write(f"DEBUG: Worker process started. PID: {os.getpid()}\n")
    sys.stderr.flush()

    logger = setup_worker_logging(job_id)
    logger.info(f"Worker logging initialized. PID: {os.getpid()}")

    try:
        t0 = time.time()
        logger.info(f"Worker started for job {job_id}")
        sys.stderr.write("DEBUG: Logger initialized, starting imports...\n")
        sys.stderr.flush()
        
        # We use queue_obj passed from server
        queue_obj.put(('status', job_id, 'processing'))
        queue_obj.put(('started', job_id, datetime.utcnow().isoformat()))

        # DEBUG: Check environment
        logger.info(f"Worker sys.path: {sys.path}")
        import numpy
        logger.info(f"Worker loaded numpy from: {numpy.__file__} | Version: {numpy.__version__}")
        import torch
        logger.info(f"Worker loaded torch from: {torch.__file__} | Version: {torch.__version__}")
        import torchvision
        logger.info(f"Worker loaded torchvision from: {torchvision.__file__} | Version: {torchvision.__version__}")


        # Import pipeline here (loads torch, torchaudio, etc.)
        # Ensure currrent dir is in path for local imports
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)

        import backend.patch_torchaudio as patch_torchaudio  # Must be before torchaudio
        try:
            from backend.pipeline import create_pipeline, PIPELINE_AVAILABLE
        except ImportError as e:
            logger.error(f"Pipeline import error: {e}")
            PIPELINE_AVAILABLE = False

        if not PIPELINE_AVAILABLE:
            raise RuntimeError("Audio processing pipeline not available in worker")

        t1 = time.time()
        logger.info(f"Pipeline imported in {t1-t0:.1f}s")

        # Create pipeline
        pipeline = create_pipeline(job_config)
        t2 = time.time()
        logger.info(f"Pipeline initialized in {t2-t1:.1f}s")

        # Progress callback
        def on_progress(stage: str, progress: int):
            queue_obj.put(('progress', job_id, stage, progress))

        # Run processing
        logger.info("Starting pipeline processing...")
        results = pipeline.process(input_path, output_path, progress_callback=on_progress)

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
            pass # Queue might be closed
    finally:
        # PERFORMANCE: Explicit memory cleanup
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            import gc
            gc.collect()
        except Exception:
            pass
        logger.info("Worker process exiting")
