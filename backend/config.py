"""
VOXIS Audio Processing Configuration
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Server configuration
HOST = os.getenv('VOXIS_HOST', '0.0.0.0')
PORT = int(os.getenv('VOXIS_PORT', 5000))
DEBUG = os.getenv('VOXIS_DEBUG', 'True').lower() == 'true'

# File storage
UPLOAD_FOLDER = os.getenv('VOXIS_UPLOAD_FOLDER', os.path.join(os.path.dirname(__file__), 'uploads'))
OUTPUT_FOLDER = os.getenv('VOXIS_OUTPUT_FOLDER', os.path.join(os.path.dirname(__file__), 'outputs'))
MAX_FILE_SIZE = int(os.getenv('VOXIS_MAX_FILE_SIZE', 500 * 1024 * 1024))  # 500MB

# Processing defaults
DEFAULT_DENOISE_STRENGTH = float(os.getenv('VOXIS_DENOISE_STRENGTH', 0.75))
DEFAULT_HIGH_PRECISION = os.getenv('VOXIS_HIGH_PRECISION', 'True').lower() == 'true'
DEFAULT_UPSCALE_FACTOR = int(os.getenv('VOXIS_UPSCALE_FACTOR', 2))
DEFAULT_TARGET_SAMPLE_RATE = int(os.getenv('VOXIS_TARGET_SAMPLE_RATE', 48000))
DEFAULT_TARGET_CHANNELS = int(os.getenv('VOXIS_TARGET_CHANNELS', 2))

# CORS origins
ALLOWED_ORIGINS = os.getenv('VOXIS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')

# Device configuration (for PyTorch)
DEVICE = os.getenv('VOXIS_DEVICE', 'cpu')  # 'cpu' or 'cuda'
