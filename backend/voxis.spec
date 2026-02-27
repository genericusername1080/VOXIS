# ═══════════════════════════════════════════════════════════════════════════════
#  VOXIS 4.0.0 Backend - PyInstaller Spec
#  Powered by Trinity v8.1 | Built by Glass Stone
#  Copyright (c) 2026 Glass Stone. All rights reserved.
#  Version: 4.0.0
# ═══════════════════════════════════════════════════════════════════════════════

import sys
import os
import platform
from PyInstaller.utils.hooks import collect_submodules, collect_data_files, copy_metadata

block_cipher = None

# ═══════════════════════════════════════════════════════════════════════════════
#  HIDDEN IMPORTS - All dependencies that need to be explicitly included
# ═══════════════════════════════════════════════════════════════════════════════

hidden_imports = [
    # Sklearn dependencies
    'sklearn.utils._cython_blas',
    'sklearn.neighbors.typedefs',
    'sklearn.neighbors.quad_tree',
    'sklearn.tree._utils',
    'sklearn.utils._weight_vector',
    
    # Audio processing
    'librosa', 
    'resampy',
    'resampy.filters',
    'noisereduce',
    'soundfile',
    'pydub',
    'pydub.utils',
    'pydub.effects',
    
    # PyTorch and torchaudio
    'torch',
    'torchaudio',
    'torchaudio.functional',
    'torchaudio.transforms',
    
    # DeepFilterNet
    'deepfilternet',
    'df',
    'df.enhance',
    'df.config',
    'df.model',
    'df.deepfilternet3', # Dynamic import used by DeepFilterNet3 config
    
    # AudioSR
    'audiosr',
    'transformers',
    'sentencepiece',
    
    # VoiceRestore
    'einops',
    'x_transformers',
    'vocos',

    # VOXIS Sharding (audio-separator / MDX-NET)
    'audio_separator',
    'audio_separator.separator',
    'onnxruntime',
    'onnx',
    'onnx2torch',

    # TorchCodec (optional — enhanced audio loading)
    'torchcodec',

    # Scipy special modules
    'scipy.special.cython_special',
    'scipy.spatial.transform._rotation_groups',
    
    # Flask and web
    'flask',
    'flask_cors',
    'werkzeug',
    'werkzeug.utils',
    
    # Other utilities
    'dotenv',
    'gunicorn',
    
    # VOXIS Engine internals
    'backend',
    'backend.utils',
    'backend.utils.patch_torchaudio',
    'backend.pipeline',
    'backend.worker',
    'backend.voxis_engine',
    'backend.voxis_engine.core',
    'backend.voxis_engine.core.failsafe',
    'backend.voxis_engine.core.optimization',
    'backend.voxis_engine.core.errors',
    'backend.voxis_engine.wrappers',
    'backend.voxis_engine.wrappers.uvr_wrapper',
    'backend.voxis_engine.wrappers.diff_hiervc_wrapper',
    'backend.voxis_engine.wrappers.phaselimiter_wrapper',
    'backend.voxis_engine.wrappers.spectrum_wrapper',
    'utils',
    'utils.patch_torchaudio',
    'pipeline',
    'worker',

    # System
    'cffi',
    '_cffi_backend',
    'multiprocessing',
]

# Collect all submodules for complex packages
hidden_imports.extend(collect_submodules('librosa'))
hidden_imports.extend(collect_submodules('resampy'))
hidden_imports.extend(collect_submodules('sklearn'))
hidden_imports.extend(collect_submodules('scipy'))
hidden_imports.extend(collect_submodules('df'))
hidden_imports.extend(collect_submodules('deepfilternet'))
hidden_imports.extend(collect_submodules('pydub'))
hidden_imports.extend(collect_submodules('noisereduce'))
hidden_imports.extend(collect_submodules('torch'))
hidden_imports.extend(collect_submodules('torchaudio'))
hidden_imports.extend(collect_submodules('phonemizer'))
hidden_imports.extend(collect_submodules('language_tags'))
hidden_imports.extend(collect_submodules('audiosr'))
hidden_imports.extend(collect_submodules('transformers'))
hidden_imports.extend(collect_submodules('einops'))
hidden_imports.extend(collect_submodules('x_transformers'))
hidden_imports.extend(collect_submodules('vocos'))
hidden_imports.extend(collect_submodules('audio_separator'))
hidden_imports.extend(collect_submodules('onnxruntime'))
try:
    hidden_imports.extend(collect_submodules('torchcodec'))
except Exception:
    print("[VOXIS] TorchCodec not available — skipping (optional)")
    pass


# ═══════════════════════════════════════════════════════════════════════════════
#  DATA FILES - Non-Python files needed at runtime
# ═══════════════════════════════════════════════════════════════════════════════

datas = []

# Include bin directory with platform-specific binaries
datas.append(('bin', 'bin'))

# Include VOXIS Engine and utils as data (for imports in frozen mode)
datas.append(('utils', 'utils'))
datas.append(('voxis_engine', 'voxis_engine'))
datas.append(('pipeline.py', '.'))
datas.append(('worker.py', '.'))

# Also include as backend.* paths for absolute imports
datas.append(('utils', 'backend/utils'))
datas.append(('voxis_engine', 'backend/voxis_engine'))
datas.append(('pipeline.py', 'backend'))
datas.append(('worker.py', 'backend'))

# Include models directory (exclude AudioSR - too large, downloaded on first use)
datas.append(('models/TrinityDenoise', 'models/TrinityDenoise'))
datas.append(('models/TrinityRestore', 'models/TrinityRestore'))
# AudioSR (~5.8GB) is excluded from bundle - will be downloaded on first use

# Include PhaseLimiter mastering reference
datas.append(('voxis_engine/models/phaselimiter_core/resource/mastering_reference.json', 'backend/voxis_engine/models/phaselimiter_core/resource'))

# Collect data files from packages
datas.extend(collect_data_files('librosa'))
datas.extend(collect_data_files('resampy'))
datas.extend(collect_data_files('deepfilternet'))
datas.extend(collect_data_files('df'))
datas.extend(collect_data_files('language_tags'))
datas.extend(collect_data_files('phonemizer'))
datas.extend(collect_data_files('csvw'))
datas.extend(collect_data_files('audiosr'))
datas.extend(collect_data_files('einops'))
datas.extend(collect_data_files('x_transformers'))
datas.extend(collect_data_files('vocos'))
datas.extend(collect_data_files('audio_separator'))
try:
    datas.extend(collect_data_files('onnxruntime'))
except Exception:
    pass
try:
    datas.extend(collect_data_files('torchcodec'))
except Exception:
    pass


# Package metadata (for packages that check their own version)
datas.extend(copy_metadata('tqdm'))
datas.extend(copy_metadata('requests'))
datas.extend(copy_metadata('packaging'))
datas.extend(copy_metadata('filelock'))
datas.extend(copy_metadata('numpy'))
datas.extend(copy_metadata('scipy'))
datas.extend(copy_metadata('librosa'))
datas.extend(copy_metadata('torch'))
datas.extend(copy_metadata('torchaudio'))
datas.extend(copy_metadata('soundfile'))
datas.extend(copy_metadata('deepfilternet'))
try:
    datas.extend(copy_metadata('audio-separator'))
except Exception:
    pass
try:
    datas.extend(copy_metadata('onnxruntime'))
except Exception:
    pass

# ═══════════════════════════════════════════════════════════════════════════════
#  BINARIES - Platform-specific executables (FFmpeg, etc.)
# ═══════════════════════════════════════════════════════════════════════════════

binaries = []

# Detect platform and include appropriate FFmpeg binary
system = platform.system().lower()
arch = platform.machine().lower()

if system == 'darwin':
    ffmpeg_path = os.path.join('bin', 'mac', 'ffmpeg')
    if os.path.exists(ffmpeg_path):
        binaries.append((ffmpeg_path, 'bin'))
        print(f"[VOXIS] Bundling macOS FFmpeg: {ffmpeg_path}")
elif system == 'windows':
    ffmpeg_path = os.path.join('bin', 'win', 'ffmpeg.exe')
    if os.path.exists(ffmpeg_path):
        binaries.append((ffmpeg_path, 'bin'))
        print(f"[VOXIS] Bundling Windows FFmpeg: {ffmpeg_path}")
else:  # Linux
    ffmpeg_path = os.path.join('bin', 'linux', 'ffmpeg')
    if os.path.exists(ffmpeg_path):
        binaries.append((ffmpeg_path, 'bin'))
        print(f"[VOXIS] Bundling Linux FFmpeg: {ffmpeg_path}")

# ═══════════════════════════════════════════════════════════════════════════════
#  PYINSTALLER ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unused heavy packages to reduce size
        'matplotlib',
        'tkinter',
        'cv2',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# ═══════════════════════════════════════════════════════════════════════════════
#  BUILD ARTIFACTS
# ═══════════════════════════════════════════════════════════════════════════════

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='voxis_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='voxis_backend',
)
