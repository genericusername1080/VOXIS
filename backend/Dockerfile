# ================================================================
# VOXIS Backend Dockerfile
# Powered by Trinity | Built by Glass Stone
# ================================================================
# Build: docker build -t voxis-backend ./backend
# Run:   docker run -p 5001:5001 voxis-backend
# ================================================================

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories
RUN mkdir -p uploads outputs

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV VOXIS_HOST=0.0.0.0
ENV VOXIS_PORT=5001
ENV VOXIS_DEBUG=false

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Run the server
CMD ["python3", "server.py"]
