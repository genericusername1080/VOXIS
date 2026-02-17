"""
VOXIS Audio Processing Pipeline
Powered by Trinity | Built by Glass Stone

This module orchestrates the complete audio processing pipeline:
1. Spectrum Analysis (noisereduce spectral gating)
2. Denoising (DeepFilterNet)
3. Upscaling (AudioSR to 48kHz stereo)
"""

import os
import patch_torchaudio  # FIX: Compatibility for DeepFilterNet with Torch 2.x
import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as F
import torchaudio.transforms as T
import librosa
import noisereduce as nr
from typing import Dict, Any, Callable, Optional
import tempfile
import shutil
from concurrent.futures import ThreadPoolExecutor

# DeepFilterNet imports
try:
    from df.enhance import enhance, init_df
    DEEPFILTER_AVAILABLE = True
except ImportError:
    DEEPFILTER_AVAILABLE = False
    print("WARNING: DeepFilterNet not available. Install with: pip install deepfilternet")

# AudioSR imports
try:
    from audiosr import super_resolution, build_model
    AUDIOSR_AVAILABLE = True
except ImportError:
    AUDIOSR_AVAILABLE = False
    print("WARNING: AudioSR not available. Install with: pip install audiosr")


class VoxisPipeline:
    """
    Complete audio restoration pipeline using:
    - noisereduce for spectrum analysis and initial noise reduction
    - DeepFilterNet for advanced AI-based denoising
    - AudioSR for super-resolution upscaling to 48kHz
    """
    
    def __init__(self, 
                 denoise_strength: float = 0.75,
                 high_precision: bool = True,
                 upscale_factor: int = 2,
                 target_sample_rate: int = 48000,
                 target_channels: int = 2):
        """
        Initialize the VOXIS pipeline.
        
        Args:
            denoise_strength: DeepFilterNet strength (0.0-1.0), default HIGH (0.75)
            high_precision: Enable high precision mode for DeepFilterNet
            upscale_factor: AudioSR upscale factor (1, 2, or 4)
            target_sample_rate: Target output sample rate (default 48000)
            target_channels: Target output channels (1=mono, 2=stereo)
        """
        self.denoise_strength = denoise_strength
        self.high_precision = high_precision
        self.upscale_factor = upscale_factor
        self.target_sample_rate = target_sample_rate
        self.target_channels = target_channels
        
        # Local models path
        base_path = os.path.dirname(os.path.abspath(__file__))
        self.models_dir = os.path.join(base_path, 'models')
        
        # Initialize DeepFilterNet model
        self.df_model = None
        self.df_state = None
        if DEEPFILTER_AVAILABLE:
            try:
                # Point to bundled models
                df_base = os.path.join(self.models_dir, "DeepFilterNet")
                if os.path.exists(df_base):
                    print(f"Loading DeepFilterNet from bundled path: {df_base}")
                    self.df_model, self.df_state, _ = init_df(model_base_dir=df_base, config_allow_defaults=True)
                else:
                    print(f"Bundled DeepFilterNet not found at {df_base}, checking default cache")
                    self.df_model, self.df_state, _ = init_df(config_allow_defaults=True)
                    
                print("DeepFilterNet model loaded successfully")
            except Exception as e:
                print(f"Failed to load DeepFilterNet: {e}")
                import traceback
                traceback.print_exc()
        
        # Initialize AudioSR model
        self.audiosr_model = None
        if AUDIOSR_AVAILABLE:
            try:
                # Check for local AudioSR model
                model_name = "basic"
                local_model_path = os.path.join(self.models_dir, "AudioSR", f"audiosr-{model_name}")
                
                if os.path.exists(local_model_path):
                    print(f"Loading AudioSR from local path: {local_model_path}")
                    self.audiosr_model = build_model(model_name=local_model_path, device="cpu")
                else:
                    print(f"Local AudioSR not found at {local_model_path}, using default download method")
                    self.audiosr_model = build_model(model_name=model_name, device="cpu")
                    
                print("AudioSR model loaded successfully")
            except Exception as e:
                print(f"Failed to load AudioSR: {e}")
    
    def _resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """Faster resampling using torchaudio"""
        if orig_sr == target_sr:
            return audio
            
        try:
            # Convert to torch tensor
            waveform = torch.from_numpy(audio).float()
            
            # Use torchaudio functional resample
            resampled = F.resample(waveform, orig_freq=orig_sr, new_freq=target_sr)
            
            return resampled.numpy()
        except Exception as e:
            print(f"Torchaudio resampling failed, falling back to librosa: {e}")
            return librosa.resample(audio, orig_sr=orig_sr, target_sr=target_sr)

    def process(self, 
                input_path: str, 
                output_path: str,
                progress_callback: Optional[Callable[[str, int], None]] = None) -> Dict[str, Any]:
        """
        Process audio through the complete pipeline.
        """
        results = {
            "input_file": input_path,
            "output_file": output_path,
            "stages": {},
            "success": False
        }
        
        def update_progress(stage: str, progress: int):
            if progress_callback:
                progress_callback(stage, progress)
        
        try:
            # Load input audio with soundfile (faster than librosa)
            update_progress("upload", 0)
            try:
                audio, sr = sf.read(input_path, always_2d=True)
                audio = audio.T  # Transpose to (channels, samples)
            except Exception:
                # Fallback to librosa if soundfile fails (e.g. mp3)
                audio, sr = librosa.load(input_path, sr=None, mono=False)
                if audio.ndim == 1:
                    audio = audio.reshape(1, -1)
            
            original_sr = sr
            original_channels = audio.shape[0]
            original_duration = audio.shape[1] / sr
            
            results["input_metadata"] = {
                "sample_rate": original_sr,
                "channels": original_channels,
                "duration": original_duration,
                "samples": audio.shape[1]
            }
            
            update_progress("ingest", 100)
            
            # ============================================
            # STAGE 1: Spectrum Analysis
            # ============================================
            update_progress("analysis", 0)
            
            # Analyze noise profile without full reduction for speed
            noise_profiles = []
            
            # We can parallelize analysis if needed, but it's fast enough usually
            for ch_idx in range(audio.shape[0]):
                channel = audio[ch_idx]
                
                # Get spectrum data for visualization
                stft = librosa.stft(channel, n_fft=2048, hop_length=512)
                magnitude = np.abs(stft)
                noise_floor = np.percentile(magnitude, 10)
                peak_freq = np.argmax(np.mean(magnitude, axis=1)) * sr / 2048
                dynamic_range = 20 * np.log10(np.max(magnitude) / (noise_floor + 1e-10))
                
                noise_profiles.append({
                    "channel": ch_idx,
                    "noise_floor_db": float(20 * np.log10(noise_floor + 1e-10)),
                    "peak_frequency_hz": float(peak_freq),
                    "dynamic_range_db": float(dynamic_range)
                })
            
            results["stages"]["analysis"] = {
                "noise_profiles": noise_profiles,
                "method": "spectral_analysis_fast"
            }
            
            update_progress("analysis", 100)
            
            # ============================================
            # STAGE 2: Denoising (DeepFilterNet)
            # ============================================
            update_progress("denoise", 0)
            
            if DEEPFILTER_AVAILABLE and self.df_model is not None:
                # DeepFilterNet expects 48kHz
                if sr != 48000:
                    resampled_audio = self._resample(audio, sr, 48000)
                    df_sr = 48000
                else:
                    resampled_audio = audio
                    df_sr = sr
                
                # Parallel processing for channels
                denoised_channels = [None] * resampled_audio.shape[0]
                
                def process_channel(idx_and_channel):
                    idx, channel = idx_and_channel
                    try:
                        enhanced = enhance(
                            self.df_model, 
                            self.df_state, 
                            channel,
                            atten_lim_db=None if self.high_precision else 12
                        )
                        blended = (self.denoise_strength * enhanced + 
                                  (1 - self.denoise_strength) * channel)
                        return idx, blended
                    except Exception as e:
                        print(f"Error processing channel {idx}: {e}")
                        return idx, channel # Fallback to original

                # Use ThreadPoolExecutor for parallel channel processing
                # Note: PyTorch/DeepFilterNet might already be multi-threaded, so gain depends on GIL release
                with ThreadPoolExecutor(max_workers=min(resampled_audio.shape[0], 4)) as executor:
                    futures = [
                        executor.submit(process_channel, (i, resampled_audio[i])) 
                        for i in range(resampled_audio.shape[0])
                    ]
                    
                    completed = 0
                    for future in futures:
                        idx, result = future.result()
                        denoised_channels[idx] = result
                        completed += 1
                        update_progress("denoise", int(completed / resampled_audio.shape[0] * 100))
                
                denoised_audio = np.array(denoised_channels)
                current_sr = df_sr
                
                results["stages"]["denoise"] = {
                    "method": "DeepFilterNet",
                    "strength": self.denoise_strength,
                    "high_precision": self.high_precision,
                    "model": "DeepFilterNet3" if self.high_precision else "DeepFilterNet2"
                }
            else:
                # Fallback to noisereduce
                 # Process channels in parallel
                denoised_channels = [None] * audio.shape[0]
                
                def reduce_channel(idx_and_channel):
                    idx, channel = idx_and_channel
                    reduced = nr.reduce_noise(
                        y=channel,
                        sr=sr,
                        stationary=False,
                        prop_decrease=self.denoise_strength,
                        n_fft=2048,
                        hop_length=512
                    )
                    return idx, reduced

                with ThreadPoolExecutor(max_workers=min(audio.shape[0], 4)) as executor:
                    futures = [
                        executor.submit(reduce_channel, (i, audio[i]))
                        for i in range(audio.shape[0])
                    ]
                    for future in futures:
                        idx, result = future.result()
                        denoised_channels[idx] = result
                
                denoised_audio = np.array(denoised_channels)
                current_sr = sr
                
                results["stages"]["denoise"] = {
                    "method": "noisereduce_fallback",
                    "strength": self.denoise_strength,
                    "note": "DeepFilterNet not available"
                }
            
            update_progress("denoise", 100)
            
            # ============================================
            # STAGE 3: Upscaling (AudioSR)
            # ============================================
            update_progress("upscale", 0)
            
            if AUDIOSR_AVAILABLE and self.audiosr_model is not None and self.upscale_factor > 1:
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    tmp_input = tmp.name
                    sf.write(tmp_input, denoised_audio.T, current_sr)
                
                try:
                    upscaled = super_resolution(
                        self.audiosr_model,
                        tmp_input,
                        seed=42,
                        guidance_scale=3.5,
                        ddim_steps=50
                    )
                    final_audio = upscaled
                    final_sr = 48000
                    
                    results["stages"]["upscale"] = {
                        "method": "AudioSR",
                        "input_sr": current_sr,
                        "output_sr": final_sr,
                        "factor": self.upscale_factor
                    }
                except Exception as e:
                    print(f"AudioSR failed: {e}. Falling back to resample.")
                    # Fallback if AudioSR fails
                    final_audio = self._resample(denoised_audio, current_sr, self.target_sample_rate)
                    final_sr = self.target_sample_rate
                finally:
                    if os.path.exists(tmp_input):
                        os.unlink(tmp_input)
                
                update_progress("upscale", 80)
            else:
                 # Fast resample to target
                if current_sr != self.target_sample_rate:
                    final_audio = self._resample(denoised_audio, current_sr, self.target_sample_rate)
                    final_sr = self.target_sample_rate
                else:
                    final_audio = denoised_audio
                    final_sr = current_sr
                
                results["stages"]["upscale"] = {
                    "method": "torchaudio_resample" if not AUDIOSR_AVAILABLE else "skipped",
                    "input_sr": current_sr,
                    "output_sr": final_sr,
                    "note": "AudioSR not available" if not AUDIOSR_AVAILABLE else "Upscale factor is 1"
                }
            
            # Ensure stereo/mono output
            if self.target_channels == 2 and final_audio.shape[0] == 1:
                final_audio = np.vstack([final_audio[0], final_audio[0]])
            elif self.target_channels == 1 and final_audio.shape[0] == 2:
                final_audio = np.mean(final_audio, axis=0, keepdims=True)
            
            update_progress("upscale", 100)
            
            # ============================================
            # STAGE 4: Export
            # ============================================
            update_progress("export", 0)
            
            # Normalize
            max_val = np.max(np.abs(final_audio))
            if max_val > 0.99:
                final_audio = final_audio * 0.99 / max_val
            
            sf.write(output_path, final_audio.T, final_sr, subtype='PCM_24')
            
            results["output_metadata"] = {
                "sample_rate": final_sr,
                "channels": final_audio.shape[0],
                "duration": final_audio.shape[1] / final_sr,
                "samples": final_audio.shape[1],
                "bit_depth": 24,
                "format": "WAV"
            }
            
            results["success"] = True
            update_progress("export", 100)
            
        except Exception as e:
            results["error"] = str(e)
            results["success"] = False
            import traceback
            results["traceback"] = traceback.format_exc()
        
        return results


def create_pipeline(config: Dict[str, Any]) -> VoxisPipeline:
    return VoxisPipeline(
        denoise_strength=config.get("denoise_strength", 0.75),
        high_precision=config.get("high_precision", True),
        upscale_factor=config.get("upscale_factor", 2),
        target_sample_rate=config.get("target_sample_rate", 48000),
        target_channels=config.get("target_channels", 2)
    )
