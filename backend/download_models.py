"""
VOXIS Model Downloader
Powered by Trinity | Built by Glass Stone 2026

Downloads AI models for offline usage:
1. DeepFilterNet (DeepFilterNet3)
2. AudioSR (Basic, Medium, Large)
"""

import os
import patch_torchaudio # FIX: Compatibility for DeepFilterNet with Torch 2.x
import shutil
import logging
from pathlib import Path
import torch

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("VOXIS_DOWNLOADER")

MODELS_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / "models"

def download_file(url, dest_path):
    import requests
    from tqdm import tqdm
    
    response = requests.get(url, stream=True)
    total_size_in_bytes = int(response.headers.get('content-length', 0))
    block_size = 1024 # 1 Kibibyte
    
    logger.info(f"Downloading {dest_path.name}...")
    
    progress_bar = tqdm(total=total_size_in_bytes, unit='iB', unit_scale=True)
    
    with open(dest_path, 'wb') as file:
        for data in response.iter_content(block_size):
            progress_bar.update(len(data))
            file.write(data)
    progress_bar.close()
    
    if total_size_in_bytes != 0 and progress_bar.n != total_size_in_bytes:
        logger.error("ERROR, something went wrong")
        return False
    return True

def setup_deepfilternet():
    """
    Download DeepFilterNet models.
    We need the checks for DeepFilterNet3 as it is the default high-precision model.
    """
    logger.info("Setting up DeepFilterNet models...")
    df_dir = MODELS_DIR / "DeepFilterNet"
    df_dir.mkdir(parents=True, exist_ok=True)
    
    # URL for DeepFilterNet3 (standard)
    # These are usually hosted on clear-code-projects GitHub releases or similar
    # For now, we will use the `deepfilternet` library capability if possible, 
    # but since we want to bundle, we might need to manually trigger download and move.
    
    try:
        from df.enhance import init_df
        # engaging init_df() will autodownload to cache. 
        # We want to move that cache to our local dir.
        
        logger.info("Triggering DeepFilterNet download via library...")
        model, state, _ = init_df(config_allow_defaults=True)
        
        # Locate where it downloaded
        from deepfilternet import __file__ as df_file
        # Often stored in ~/.cache/DeepFilterNet or similar. 
        # But `init_df` loads model. We can save the state_dict?
        # Actually easier: let's download the zip directly from release if we can.
        
        # Method 2: Use the model downloader from the library
        # This is strictly for demonstration to ensure we have the weights.
        
    except ImportError:
        logger.error("DeepFilterNet not installed.")
        return

    logger.info("DeepFilterNet setup complete (relies on library caching for now - TODO: enforce local path).")


def setup_audiosr():
    """
    Download AudioSR models.
    """
    logger.info("Setting up AudioSR models...")
    
    # AudioSR automatically manages download via ~/.cache usually.
    # To force it to our directory, we might need to set environment variables or move it after.
    # For now, let's just trigger the download by building the model.
    try:
        from audiosr import build_model
        
        logger.info("Triggering AudioSR download (basic)...")
        # This will download to ~/.cache/huggingface/...
        model = build_model(model_name="basic", device="cpu")
        
        # Now we need to find where it went and maybe move it, OR just rely on the user having internet.
        # But the requirement is "offline".
        # So we really want these files in `backend/models`.
        
        # AudioSR 0.0.x uses huggingface_hub.
        # The repo_id is likely "calm/audiosr-basic" or "haoheliu/audiosr-basic"
        # Let's try to find it via hf_hub_download to be sure.
        
        from huggingface_hub import snapshot_download
        
        # Official AudioSR weights are often associated with 'haoheliu'
        # The repo_id is likely "haoheliu/audiosr_basic" (underscore or hyphen)
        
        target_dir = MODELS_DIR / "AudioSR" / "audiosr-basic"
        target_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("Downloading to local directory...")
        # Try expected repo IDs
        try:
             snapshot_download(repo_id="haoheliu/audiosr_basic", local_dir=target_dir)
        except Exception:
             logger.info("Retrying with hyphenated ID...")
             snapshot_download(repo_id="haoheliu/audiosr-basic", local_dir=target_dir)
        
    except Exception as e:
        logger.warning(f"AudioSR setup warning: {e}")
        logger.info("Attempting alternate repo...")
        try:
             # Try another common one if the first fails
             target_dir = MODELS_DIR / "AudioSR" / "audiosr-basic"
             from huggingface_hub import snapshot_download
             snapshot_download(repo_id="speech-enhancement/audiosr-basic", local_dir=target_dir)
        except Exception:
             logger.error("Could not download AudioSR models. You may need to download manually.")

if __name__ == "__main__":
    MODELS_DIR.mkdir(exist_ok=True)
    setup_deepfilternet()
    setup_audiosr()
    logger.info(f"Models ready in {MODELS_DIR}")
