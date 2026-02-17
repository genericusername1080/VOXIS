import sys
import types
import warnings
from collections import namedtuple

# Monkeypatch torchaudio.backend.common.AudioMetaData for DeepFilterNet
# DeepFilterNet 0.5.6 imports this, but it was removed in torchaudio 2.0
try:
    import torchaudio
    
    # Check if backend.common exists
    try:
        from torchaudio.backend import common
    except ImportError:
        # Create the missing module structure
        if 'torchaudio.backend' not in sys.modules:
            backend = types.ModuleType('torchaudio.backend')
            sys.modules['torchaudio.backend'] = backend
            torchaudio.backend = backend
        
        if 'torchaudio.backend.common' not in sys.modules:
            common = types.ModuleType('torchaudio.backend.common')
            AudioMetaData = namedtuple("AudioMetaData", ["sample_rate", "num_frames", "num_channels", "bits_per_sample", "encoding"])
            common.AudioMetaData = AudioMetaData
            sys.modules['torchaudio.backend.common'] = common
            torchaudio.backend.common = common
            
        print("Patched torchaudio.backend.common.AudioMetaData for DeepFilterNet")

except Exception as e:
    print(f"Failed to patch torchaudio: {e}")
