# VOXIS Cloud Backend Performance
# Optimized for GPU workloads

# Binding
bind = "0.0.0.0:5001"

# Workers - fewer for GPU (memory intensive)
workers = 1
threads = 4
worker_class = "gthread"

# Timeouts - longer for GPU processing
timeout = 600  # 10 minutes
graceful_timeout = 120
keepalive = 5

# Memory management
max_requests = 100
max_requests_jitter = 20
worker_tmp_dir = "/dev/shm"

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "voxis-cloud"

# Preload app for faster worker spawning
preload_app = True
