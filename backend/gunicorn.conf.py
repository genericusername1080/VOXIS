import multiprocessing
import os

# Gunicorn Configuration for VOXIS Production Backbone

# Binding
bind = "0.0.0.0:5001"

# Worker Options
# 'gthread' is best for I/O bound tasks like file uploads/downloads
# allowing the worker to handle multiple requests concurrently
worker_class = "gthread"
workers = 2  # Sufficient for most CPU-bound pipeline tasks alongside threads
threads = 4  # Allow 4 concurrent requests per worker

# Timeouts
# Processing large audio files takes time. We set a generous timeout.
timeout = 300       # 5 minutes
graceful_timeout = 30
keepalive = 5

# Logging
loglevel = "info"
accesslog = "-"  # Stdout
errorlog = "-"   # Stderr
capture_output = True

# Robustness
max_requests = 1000        # Restart workers after 1000 requests to prevent leaks
max_requests_jitter = 50   # Add randomness to restarts to avoid all restarting at once
preload_app = True         # Load app before forking (faster startup, memory sharing)

# Environment
raw_env = [
    "VOXIS_ENV=production",
    "PYTHONUNBUFFERED=1"
]

def on_starting(server):
    print("VOXIS Production Server Starting...")
    print(f"Workers: {workers} | Threads: {threads}")

def on_exit(server):
    print("VOXIS Server Shutting Down...")
