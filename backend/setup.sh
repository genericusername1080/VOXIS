#!/bin/bash
# VOXIS Backend Setup Script
# Powered by Trinity | Built by Glass Stone

echo "=============================================="
echo "  VOXIS Audio Processing - Backend Setup"
echo "  Powered by Trinity | Built by Glass Stone"
echo "=============================================="

# Check Python version
python3 --version || { echo "Python 3 is required"; exit 1; }

# Create virtual environment
echo ""
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch first (CPU version)
echo ""
echo "Installing PyTorch (CPU version)..."
echo "For GPU support, install manually: pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121"
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install other dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

# Create directories
echo ""
echo "Creating upload and output directories..."
mkdir -p uploads outputs

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "To start the server:"
echo "  1. cd backend"
echo "  2. source venv/bin/activate"
echo "  3. python server.py"
echo ""
echo "Server will run at: http://localhost:5000"
echo "=============================================="
