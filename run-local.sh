#!/bin/bash
# ================================================================
# VOXIS - Run Local (Reliability Enhanced v2.0)
# Powered by Trinity | Built by Glass Stone 2026 -R/D 
# Gabriel Rodriguez CEO Glass Stone
# ================================================================
# Features:
# - Process watchdog with auto-restart
# - Health monitoring
# - Graceful shutdown handling
# ================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  VOXIS Audio Restoration System${NC}"
echo -e "${BLUE}  Powered by Trinity | Built by Glass Stone 2026 -R/D V2.0${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Configuration
MAX_RESTART_ATTEMPTS=5
HEALTH_CHECK_INTERVAL=30
BACKEND_PORT=5001
FRONTEND_PORT=5173

# Process tracking
BACKEND_PID=0
FRONTEND_PID=0
BACKEND_RESTARTS=0
RUNNING=true

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Install with: brew install node"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

# Add bundled binaries to PATH
export PATH="$SCRIPT_DIR/backend/bin:$PATH"

# Check for FFmpeg (required for audio format conversion)
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}Installing FFmpeg (required for audio export)...${NC}"
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y ffmpeg
    else
        echo -e "${RED}Error: FFmpeg is not installed and no package manager found${NC}"
        echo "Please install FFmpeg manually: https://ffmpeg.org/download.html"
        exit 1
    fi
    echo -e "${GREEN}FFmpeg installed successfully${NC}"
fi

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Install backend dependencies if needed
if [ ! -f "backend/venv/bin/activate" ]; then
    echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install flask flask-cors python-dotenv numpy scipy soundfile librosa noisereduce pydub gunicorn
    cd ..
else
    source backend/venv/bin/activate 2>/dev/null || true
fi

# Create uploads/outputs directories
mkdir -p backend/uploads backend/outputs

# ================================================================
# BUILD FRONTEND
# ================================================================
echo -e "${YELLOW}Building React frontend for native serving...${NC}"
npm run build

# ================================================================
# PROCESS MANAGEMENT
# ================================================================

start_backend() {
    echo -e "${BLUE}[VOXIS] Starting Gunicorn Server on port ${BACKEND_PORT}...${NC}"
    cd backend
    gunicorn --config gunicorn.conf.py server:app &
    BACKEND_PID=$!
    cd ..
    echo -e "${GREEN}[VOXIS] Started with PID: ${BACKEND_PID}${NC}"
}

check_backend_health() {
    curl -sf "http://localhost:${BACKEND_PORT}/api/health" > /dev/null 2>&1
    return $?
}

restart_backend() {
    if [ $BACKEND_RESTARTS -ge $MAX_RESTART_ATTEMPTS ]; then
        echo -e "${RED}[WATCHDOG] Max restart attempts reached. Manual intervention required.${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}[WATCHDOG] Backend not responding. Restarting... (Attempt $((BACKEND_RESTARTS + 1))/${MAX_RESTART_ATTEMPTS})${NC}"
    
    # Kill existing process if any
    kill $BACKEND_PID 2>/dev/null || true
    sleep 2
    
    # Start fresh
    start_backend
    BACKEND_RESTARTS=$((BACKEND_RESTARTS + 1))
    
    # Wait for startup
    sleep 3
    
    if check_backend_health; then
        echo -e "${GREEN}[WATCHDOG] VOXIS recovered successfully${NC}"
        BACKEND_RESTARTS=0  # Reset on successful recovery
        return 0
    fi
    
    return 1
}

watchdog() {
    while $RUNNING; do
        sleep $HEALTH_CHECK_INTERVAL
        
        # Check if we should still be running
        if ! $RUNNING; then
            break
        fi
        
        # Health check
        if ! check_backend_health; then
            restart_backend || true
        fi
    done
}

cleanup() {
    echo ""
    echo -e "${YELLOW}[SHUTDOWN] Gracefully shutting down...${NC}"
    RUNNING=false
    
    # Give processes time to finish current work
    sleep 1
    
    # Kill processes
    if [ $BACKEND_PID -ne 0 ]; then
        echo -e "${YELLOW}[SHUTDOWN] Stopping VOXIS (PID: ${BACKEND_PID})...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}[SHUTDOWN] Complete${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ================================================================
# MAIN STARTUP
# ================================================================

echo ""
echo -e "${GREEN}Starting Unified VOXIS Server...${NC}"
echo ""

# Start backend
start_backend
sleep 3

# Verify backend started
if ! check_backend_health; then
    echo -e "${RED}[ERROR] VOXIS failed to start${NC}"
    exit 1
fi

# Start watchdog in background
watchdog &
WATCHDOG_PID=$!

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  VOXIS Unified Architecture is Running!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "  Application:  ${BLUE}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  API Health:   ${BLUE}http://localhost:${BACKEND_PORT}/api/health${NC}"
echo ""
echo -e "  ${GREEN}✓ Watchdog: Auto-restart on failure${NC}"
echo -e "  ${GREEN}✓ Health monitoring every ${HEALTH_CHECK_INTERVAL}s${NC}"
echo -e "  ${GREEN}✓ Unified Application (React served via Flask)${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop server"
echo ""

# Wait for any process to exit
wait
