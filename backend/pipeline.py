"""
VOXIS Audio Processing Pipeline
Powered by Trinity | Built by Glass Stone

This module orchestrates the complete audio processing pipeline:
1. Spectrum Analysis (noisereduce spectral gating)
2. Denoising (DeepFilterNet)
3. Upscaling (AudioSR to 48kHz stereo)
"""

import os
import numpy as np
import soundfile as sf
import librosa
import noisereduce as nr
from typing import Dict, Any, Callable, Optional
import tempfile
import shutil

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
        
        # Initialize DeepFilterNet model
        self.df_model = None
        self.df_state = None
        if DEEPFILTER_AVAILABLE:
            try:
                self.df_model, self.df_state, _ = init_df()
                print("DeepFilterNet model loaded successfully")
            except Exception as e:
                print(f"Failed to load DeepFilterNet: {e}")
        
        # Initialize AudioSR model
        self.audiosr_model = None
        if AUDIOSR_AVAILABLE:
            try:
                self.audiosr_model = build_model(model_name="basic", device="cpu")
                print("AudioSR model loaded successfully")
            except Exception as e:
                print(f"Failed to load AudioSR: {e}")
    
    def process(self, 
                input_path: str, 
                output_path: str,
                progress_callback: Optional[Callable[[str, int], None]] = None) -> Dict[str, Any]:
        """
        Process audio through the complete pipeline.
        
        Args:
            input_path: Path to input audio file
            output_path: Path for output audio file
            progress_callback: Optional callback(stage_name, progress_percent)
            
        Returns:
            Dictionary with processing metadata and results
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
            # Load input audio
            update_progress("upload", 0)
            audio, sr = librosa.load(input_path, sr=None, mono=False)
            
            # Handle mono/stereo
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
            # STAGE 1: Spectrum Analysis (noisereduce)
            # Using Yazdi9/Audio-Noise-Reduction approach
            # ============================================
            update_progress("analysis", 0)
            
            # Process each channel
            analyzed_audio = []
            noise_profiles = []
            
            for ch_idx in range(audio.shape[0]):
                channel = audio[ch_idx]
                
                # Compute noise profile using spectral gating
                # This is the Yazdi9 approach - stationary noise reduction
                noise_profile = nr.reduce_noise(
                    y=channel,
                    sr=sr,
                    stationary=True,
                    prop_decrease=0.0,  # Just analyze, don't reduce yet
                    n_fft=2048,
                    hop_length=512
                )
                
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
                
                analyzed_audio.append(channel)
            
            analyzed_audio = np.array(analyzed_audio)
            results["stages"]["analysis"] = {
                "noise_profiles": noise_profiles,
                "method": "spectral_gating_stationary"
            }
            
            update_progress("analysis", 100)
            
            # ============================================
            # STAGE 2: Denoising (DeepFilterNet)
            # Using Rikorose/DeepFilterNet - HIGH strength
            # ============================================
            update_progress("denoise", 0)
            
            if DEEPFILTER_AVAILABLE and self.df_model is not None:
                # DeepFilterNet expects 48kHz input
                # Resample if needed
                if sr != 48000:
                    resampled_audio = librosa.resample(
                        analyzed_audio, 
                        orig_sr=sr, 
                        target_sr=48000
                    )
                    df_sr = 48000
                else:
                    resampled_audio = analyzed_audio
                    df_sr = sr
                
                # DeepFilterNet processes mono, so handle each channel
                denoised_channels = []
                for ch_idx in range(resampled_audio.shape[0]):
                    channel = resampled_audio[ch_idx]
                    
                    # Apply DeepFilterNet
                    enhanced = enhance(
                        self.df_model, 
                        self.df_state, 
                        channel,
                        atten_lim_db=None if self.high_precision else 12
                    )
                    
                    # Apply strength blending
                    blended = (self.denoise_strength * enhanced + 
                              (1 - self.denoise_strength) * channel)
                    
                    denoised_channels.append(blended)
                    update_progress("denoise", int(50 + (ch_idx + 1) / resampled_audio.shape[0] * 50))
                
                denoised_audio = np.array(denoised_channels)
                current_sr = df_sr
                
                results["stages"]["denoise"] = {
                    "method": "DeepFilterNet",
                    "strength": self.denoise_strength,
                    "high_precision": self.high_precision,
                    "model": "DeepFilterNet3" if self.high_precision else "DeepFilterNet2"
                }
            else:
                # Fallback to noisereduce if DeepFilterNet unavailable
                denoised_channels = []
                for ch_idx in range(analyzed_audio.shape[0]):
                    channel = analyzed_audio[ch_idx]
                    
                    # Apply noisereduce with strength
                    reduced = nr.reduce_noise(
                        y=channel,
                        sr=sr,
                        stationary=False,
                        prop_decrease=self.denoise_strength,
                        n_fft=2048,
                        hop_length=512
                    )
                    denoised_channels.append(reduced)
                    update_progress("denoise", int(50 + (ch_idx + 1) / analyzed_audio.shape[0] * 50))
                
                denoised_audio = np.array(denoised_channels)
                current_sr = sr
                
                results["stages"]["denoise"] = {
                    "method": "noisereduce_fallback",
                    "strength": self.denoise_strength,
                    "note": "DeepFilterNet not available, using noisereduce"
                }
            
            update_progress("denoise", 100)
            
            # ============================================
            # STAGE 3: Upscaling (AudioSR)
            # Using ORI-Muchim/AudioSR-Upsampling
            # Target: 48kHz stereo high-quality output
            # ============================================
            update_progress("upscale", 0)
            
            if AUDIOSR_AVAILABLE and self.audiosr_model is not None and self.upscale_factor > 1:
                # AudioSR requires saving to temp file
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    tmp_input = tmp.name
                    # Write current audio to temp file
                    sf.write(tmp_input, denoised_audio.T, current_sr)
                
                try:
                    # Run AudioSR super-resolution
                    upscaled = super_resolution(
                        self.audiosr_model,
                        tmp_input,
                        seed=42,
                        guidance_scale=3.5,
                        ddim_steps=50
                    )
                    
                    # AudioSR outputs 48kHz
                    final_audio = upscaled
                    final_sr = 48000
                    
                    results["stages"]["upscale"] = {
                        "method": "AudioSR",
                        "input_sr": current_sr,
                        "output_sr": final_sr,
                        "factor": self.upscale_factor
                    }
                finally:
                    os.unlink(tmp_input)
                
                update_progress("upscale", 80)
            else:
                # Fallback: High-quality resampling with librosa
                if current_sr != self.target_sample_rate:
                    final_audio = librosa.resample(
                        denoised_audio,
                        orig_sr=current_sr,
                        target_sr=self.target_sample_rate,
                        res_type='kaiser_best'
                    )
                    final_sr = self.target_sample_rate
                else:
                    final_audio = denoised_audio
                    final_sr = current_sr
                
                results["stages"]["upscale"] = {
                    "method": "librosa_resample" if not AUDIOSR_AVAILABLE else "skipped",
                    "input_sr": current_sr,
                    "output_sr": final_sr,
                    "note": "AudioSR not available" if not AUDIOSR_AVAILABLE else "Upscale factor is 1"
                }
            
            # Ensure stereo output if requested
            if self.target_channels == 2 and final_audio.shape[0] == 1:
                # Duplicate mono to stereo
                final_audio = np.vstack([final_audio[0], final_audio[0]])
            elif self.target_channels == 1 and final_audio.shape[0] == 2:
                # Mix to mono
                final_audio = np.mean(final_audio, axis=0, keepdims=True)
            
            update_progress("upscale", 100)
            
            # ============================================
            # STAGE 4: Export
            # Write final high-quality WAV file
            # ============================================
            update_progress("export", 0)
            
            # Normalize to prevent clipping
            max_val = np.max(np.abs(final_audio))
            if max_val > 0.99:
                final_audio = final_audio * 0.99 / max_val
            
            # Write output (channels last for soundfile)
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
    """Factory function to create a configured pipeline."""
    return VoxisPipeline(
        denoise_strength=config.get("denoise_strength", 0.75),
        high_precision=config.get("high_precision", True),
        upscale_factor=config.get("upscale_factor", 2),
        target_sample_rate=config.get("target_sample_rate", 48000),
        target_channels=config.get("target_channels", 2)
    )
