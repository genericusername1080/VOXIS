#!/bin/bash
# ================================================================
# VOXIS - Run Local
# Powered by Trinity | Built by Glass Stone 2026 -R/D 
# Gabriel Rodriguez CEO Glass Stone
# ================================================================
# This script starts both the backend and frontend servers locally.
# Usage: ./run-local.sh
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
echo -e "${BLUE}  Powered by Trinity | Built by Glass Stone 2026 -R/D V1A${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

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
    pip install flask flask-cors python-dotenv numpy scipy soundfile librosa noisereduce
    cd ..
else
    source backend/venv/bin/activate 2>/dev/null || true
fi

# Create uploads/outputs directories
mkdir -p backend/uploads backend/outputs

echo ""
echo -e "${GREEN}Starting servers...${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend server
echo -e "${BLUE}[1/2] Starting Backend (Flask) on port 5001...${NC}"
cd backend
python3 server.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend server
echo -e "${BLUE}[2/2] Starting Frontend (Vite) on port 5173...${NC}"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  VOXIS is running!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:5001${NC}"
echo -e "  Health:    ${BLUE}http://localhost:5001/api/health${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all servers"
echo ""

# Wait for any process to exit
wait
