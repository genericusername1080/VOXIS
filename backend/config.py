"""
VOXIS 4 Dense — Configuration
Powered by Trinity 8.1 | Built by Glass Stone
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Server
HOST = os.getenv('VOXIS_HOST', '0.0.0.0')
PORT = int(os.getenv('VOXIS_PORT', 5001))
DEBUG = os.getenv('VOXIS_DEBUG', 'False').lower() == 'true'

# Storage
UPLOAD_FOLDER = os.getenv('VOXIS_UPLOAD_FOLDER', os.path.join(os.path.dirname(__file__), 'uploads'))
OUTPUT_FOLDER = os.getenv('VOXIS_OUTPUT_FOLDER', os.path.join(os.path.dirname(__file__), 'outputs'))
MAX_FILE_SIZE = int(os.getenv('VOXIS_MAX_FILE_SIZE', 500 * 1024 * 1024))

# Pipeline defaults
DEFAULT_MODE = os.getenv('VOXIS_MODE', 'standard')
DEFAULT_DENOISE_STRENGTH = float(os.getenv('VOXIS_DENOISE_STRENGTH', 0.85))
DEFAULT_HIGH_PRECISION = os.getenv('VOXIS_HIGH_PRECISION', 'True').lower() == 'true'
DEFAULT_UPSCALE_FACTOR = int(os.getenv('VOXIS_UPSCALE_FACTOR', 2))
DEFAULT_TARGET_SAMPLE_RATE = int(os.getenv('VOXIS_TARGET_SAMPLE_RATE', 48000))
DEFAULT_TARGET_CHANNELS = int(os.getenv('VOXIS_TARGET_CHANNELS', 2))

# CORS
ALLOWED_ORIGINS = os.getenv('VOXIS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')

# Device
DEVICE = os.getenv('VOXIS_DEVICE', 'cpu')

# Model storage directory (downloads go here on first launch)
MODEL_DIR = os.getenv('VOXIS_MODEL_DIR', '')  # Empty = auto-detect per platform

# Model Names (VOXIS Dense Engine)
MODEL_NAMES = {
    'analysis': 'Dense Spectrum Analyzer',
    'dense': 'Dense Source Separator',
    'denoise': 'Dense Neural Filter',
    'upscale': 'Dense Diffusion Upscaler',
    'export': 'Dense Audio Encoder',
}
