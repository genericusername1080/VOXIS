"""
VOXIS 4 Dense - Audio Processing Pipeline
Powered by Trinity 8.1 | Built by Glass Stone
Copyright (c) 2026 Glass Stone. All rights reserved.

Pipeline: Ingest > Spectrum > Dense(UVR5) > Denoise(DeepFilterNet) > Upscale(AudioSR) > Export
"""

import os
import numpy as np
import soundfile as sf
import librosa
import noisereduce as nr
from typing import Dict, Any, Callable, Optional
import tempfile
import logging
from config import MODEL_NAMES

logger = logging.getLogger('VOXIS.Dense')

try:
    from df.enhance import enhance, init_df
    DEEPFILTER_AVAILABLE = True
except ImportError:
    DEEPFILTER_AVAILABLE = False
    logger.warning("DeepFilterNet not available")

try:
    from audiosr import super_resolution, build_model
    AUDIOSR_AVAILABLE = True
except ImportError:
    AUDIOSR_AVAILABLE = False
    logger.warning("AudioSR not available")

try:
    from audio_separator.separator import Separator
    UVR5_AVAILABLE = True
except ImportError:
    UVR5_AVAILABLE = False
    logger.warning("UVR5 (audio-separator) not available")


class VoxisPipeline:
    """
    VOXIS 4 Dense pipeline.
    Modes: quick (fast denoise + resample), standard (diffusion default), extreme (full UVR5 + max restore).
    """

    def __init__(self, mode='standard', denoise_strength=0.85, high_precision=True,
                 upscale_factor=2, target_sample_rate=48000, target_channels=2):
        self.mode = mode
        self.denoise_strength = denoise_strength
        self.high_precision = high_precision
        self.upscale_factor = upscale_factor
        self.target_sample_rate = target_sample_rate
        self.target_channels = target_channels

        self.df_model = self.df_state = None
        if DEEPFILTER_AVAILABLE:
            try:
                self.df_model, self.df_state, _ = init_df()
                logger.info(f"{MODEL_NAMES['denoise']} loaded (DeepFilterNet)")
            except Exception as e:
                logger.error(f"DeepFilterNet init: {e}")

        self.audiosr_model = None
        if AUDIOSR_AVAILABLE:
            try:
                self.audiosr_model = build_model(model_name="basic", device="cpu")
                logger.info(f"{MODEL_NAMES['upscale']} loaded (AudioSR)")
            except Exception as e:
                logger.error(f"AudioSR init: {e}")

        self.separator = None
        if UVR5_AVAILABLE:
            try:
                self.separator = Separator()
                logger.info(f"{MODEL_NAMES['dense']} loaded (UVR5)")
            except Exception as e:
                logger.error(f"UVR5 init: {e}")

    def process(self, input_path, output_path, progress_callback=None):
        results = {"input_file": input_path, "output_file": output_path,
                   "stages": {}, "success": False, "mode": self.mode}

        def update(stage, progress):
            if progress_callback:
                progress_callback(stage, progress)

        try:
            # INGEST
            update("ingest", 0)
            audio, sr = librosa.load(input_path, sr=None, mono=False)
            if audio.ndim == 1:
                audio = audio.reshape(1, -1)
            results["input_metadata"] = {
                "sample_rate": int(sr), "channels": int(audio.shape[0]),
                "duration": float(audio.shape[1] / sr), "samples": int(audio.shape[1])
            }
            update("ingest", 100)

            # SPECTRUM ANALYSIS
            update("analysis", 0)
            profiles = []
            for ch in range(audio.shape[0]):
                stft = librosa.stft(audio[ch], n_fft=2048, hop_length=512)
                mag = np.abs(stft)
                nf = np.percentile(mag, 10)
                profiles.append({
                    "channel": ch,
                    "noise_floor_db": float(20 * np.log10(nf + 1e-10)),
                    "peak_hz": float(np.argmax(np.mean(mag, axis=1)) * sr / 2048),
                    "dynamic_range_db": float(20 * np.log10(np.max(mag) / (nf + 1e-10)))
                })
            results["stages"]["analysis"] = {"profiles": profiles}
            update("analysis", 100)

            # DENSE (UVR5) — skipped in quick mode
            update("dense", 0)
            if self.mode == 'quick':
                results["stages"]["dense"] = {"method": "skipped_quick_mode"}
            elif UVR5_AVAILABLE and self.separator:
                try:
                    tmp_dir = tempfile.mkdtemp(prefix='voxis_')
                    separated = self.separator.separate(input_path, tmp_dir)
                    if separated and os.path.exists(separated[0]):
                        audio, sr = librosa.load(separated[0], sr=sr, mono=False)
                        if audio.ndim == 1:
                            audio = audio.reshape(1, -1)
                    results["stages"]["dense"] = {"model": MODEL_NAMES['dense'], "engine": "UVR5", "status": "ok"}
                except Exception as e:
                    logger.warning(f"UVR5 skipped: {e}")
                    results["stages"]["dense"] = {"model": MODEL_NAMES['dense'], "engine": "UVR5", "status": "skipped"}
            else:
                results["stages"]["dense"] = {"method": "passthrough"}
            update("dense", 100)

            # DENOISE (DeepFilterNet / noisereduce)
            update("denoise", 0)
            if self.mode == 'quick':
                # Quick mode: always use noisereduce (fast, no model needed)
                channels = []
                for ch in range(audio.shape[0]):
                    channels.append(nr.reduce_noise(y=audio[ch], sr=sr, stationary=True,
                                                     prop_decrease=self.denoise_strength))
                    update("denoise", int(50 + (ch + 1) / audio.shape[0] * 50))
                audio = np.array(channels)
                results["stages"]["denoise"] = {"model": MODEL_NAMES['denoise'], "engine": "noisereduce_quick", "strength": self.denoise_strength}
            elif DEEPFILTER_AVAILABLE and self.df_model:
                if sr != 48000:
                    resampled = librosa.resample(audio, orig_sr=sr, target_sr=48000)
                    df_sr = 48000
                else:
                    resampled = audio
                    df_sr = sr

                channels = []
                for ch in range(resampled.shape[0]):
                    enhanced_ch = enhance(self.df_model, self.df_state, resampled[ch],
                                          atten_lim_db=None if self.high_precision else 12)
                    blended = self.denoise_strength * enhanced_ch + (1 - self.denoise_strength) * resampled[ch]
                    channels.append(blended)
                    update("denoise", int(50 + (ch + 1) / resampled.shape[0] * 50))
                audio = np.array(channels)
                sr = df_sr
                results["stages"]["denoise"] = {"model": MODEL_NAMES['denoise'], "engine": "DeepFilterNet3", "strength": self.denoise_strength}
            else:
                channels = []
                for ch in range(audio.shape[0]):
                    channels.append(nr.reduce_noise(y=audio[ch], sr=sr, stationary=False,
                                                     prop_decrease=self.denoise_strength))
                    update("denoise", int(50 + (ch + 1) / audio.shape[0] * 50))
                audio = np.array(channels)
                results["stages"]["denoise"] = {"model": MODEL_NAMES['denoise'], "engine": "noisereduce_fallback"}
            update("denoise", 100)

            # UPSCALE (AudioSR diffusion)
            update("upscale", 0)
            if AUDIOSR_AVAILABLE and self.audiosr_model and self.upscale_factor > 1:
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    tmp_path = tmp.name
                    sf.write(tmp_path, audio.T, sr)
                try:
                    audio = super_resolution(self.audiosr_model, tmp_path,
                                             seed=42, guidance_scale=3.5, ddim_steps=50)
                    sr = 48000
                    results["stages"]["upscale"] = {"model": MODEL_NAMES['upscale'], "engine": "AudioSR_diffusion", "sr": 48000}
                finally:
                    os.unlink(tmp_path)
            else:
                if sr != self.target_sample_rate:
                    audio = librosa.resample(audio, orig_sr=sr, target_sr=self.target_sample_rate,
                                              res_type='kaiser_best')
                    sr = self.target_sample_rate
                results["stages"]["upscale"] = {"model": MODEL_NAMES['upscale'], "engine": "resample", "sr": sr}
            update("upscale", 80)

            if self.target_channels == 2 and audio.shape[0] == 1:
                audio = np.vstack([audio[0], audio[0]])
            elif self.target_channels == 1 and audio.shape[0] == 2:
                audio = np.mean(audio, axis=0, keepdims=True)
            update("upscale", 100)

            # EXPORT
            update("export", 0)
            peak = np.max(np.abs(audio))
            if peak > 0.99:
                audio = audio * 0.99 / peak
            sf.write(output_path, audio.T, sr, subtype='PCM_24')
            results["output_metadata"] = {
                "sample_rate": int(sr), "channels": int(audio.shape[0]),
                "duration": float(audio.shape[1] / sr), "bit_depth": 24, "format": "WAV"
            }
            results["success"] = True
            update("export", 100)

        except Exception as e:
            results["error"] = str(e)
            import traceback
            results["traceback"] = traceback.format_exc()
            logger.exception(f"Pipeline error: {e}")

        return results


def create_pipeline(config):
    return VoxisPipeline(
        mode=config.get("mode", "standard"),
        denoise_strength=config.get("denoise_strength", 0.85),
        high_precision=config.get("high_precision", True),
        upscale_factor=config.get("upscale_factor", 2),
        target_sample_rate=config.get("target_sample_rate", 48000),
        target_channels=config.get("target_channels", 2)
    )
