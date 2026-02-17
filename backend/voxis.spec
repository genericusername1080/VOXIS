# -*- mode: python ; coding: utf-8 -*-

import sys
import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files, copy_metadata

block_cipher = None

# Collect hidden imports for complex scientific packages
hidden_imports = [
    'sklearn.utils._cython_blas',
    'sklearn.neighbors.typedefs',
    'sklearn.neighbors.quad_tree',
    'sklearn.tree._utils',
    'librosa', 
    'resampy',
    'scipy.special.cython_special',
    'scipy.spatial.transform._rotation_groups',
    'noisereduce',
    'soundfile',
    'torch',
    'torchaudio'
]

# Add submodules
hidden_imports.extend(collect_submodules('librosa'))
hidden_imports.extend(collect_submodules('resampy'))
hidden_imports.extend(collect_submodules('sklearn'))
hidden_imports.extend(collect_submodules('scipy'))

# Collect data files
datas = []
datas.append(('bin', 'bin'))  # Include bin directory recursively
datas.extend(collect_data_files('librosa'))
datas.extend(collect_data_files('resampy'))
datas.extend(collect_data_files('deepfilternet'))
datas.append(('models', 'models'))

# Handling metadata for packages that check their own version
datas.extend(copy_metadata('tqdm'))
datas.extend(copy_metadata('requests'))
datas.extend(copy_metadata('packaging'))
datas.extend(copy_metadata('filelock'))
datas.extend(copy_metadata('numpy'))
datas.extend(copy_metadata('scipy'))
datas.extend(copy_metadata('librosa'))

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
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
