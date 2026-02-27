"""
VOXIS Audio Processing Pipeline v4.0.0 — Voice-Optimized, Always-On
Powered by Trinity v8.1 | Built by Glass Stone
Copyright (c) 2026 Glass Stone. All rights reserved.

Pipeline Stages (all always active, voice-optimized):
  1. Ingest            — Robust file loading, format detection, validation
  2. Spectrum Analysis  — FFT + voice band profiling
  3. Frequency Filter   — Voice-band Butterworth (80 Hz HP + 12 kHz LP)
  4. Denoising         — DeepFilterNet (HIGH) + spectral gating fallback
  5. VOXIS Sharding    — Neural vocal isolation (MDX-NET)
  6. Dynamic Amplify   — Voice-targeted gain boost
  7. Hybrid Restore    — VoiceRestore(Pre) + Diff-HierVC + VoiceRestore(Post)
  8. Upscale           — AudioSR neural super-resolution (2-channel)
  9. PhaseLimiter      — Voice mastering, -14 LUFS
  10. Export           — 24-bit WAV output (original_name-voxis.wav)

PERFORMANCE OPTIMIZATIONS:
  - Pre-computed Butterworth filter coefficients (cached in __init__)
  - Cached torchaudio resamplers (avoid re-creating for same sr pairs)
  - Batch resampling in Stage 7 (resample once, not 4x per channel)
  - In-place operations where safe (no unnecessary array copies)
  - Reduced gc.collect() calls (only at GPU tensor boundaries)
  - Direct channel processing for stereo (no ThreadPool overhead)
  - Pipeline instance cached between jobs via worker.py singleton

Output naming convention: original_name-voxis.format
"""

import os
import sys
import subprocess
import gc
import logging
# Apply torchaudio patch — must be before torchaudio import
# Handle both dev mode (backend.utils.*) and PyInstaller frozen mode
try:
    import backend.utils.patch_torchaudio as patch_torchaudio
except ImportError:
    try:
        import utils.patch_torchaudio as patch_torchaudio
    except ImportError:
        pass  # patch not found — DeepFilterNet may fail

import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as F
import librosa
import noisereduce as nr
from scipy.signal import butter, sosfilt
from typing import Dict, Any, Callable, Optional
import tempfile
import shutil

# Import VOXIS Engine Core Modules (V4)
# Handle both dev mode (backend.*) and PyInstaller frozen mode
try:
    from backend.voxis_engine.core.failsafe import with_oom_failsafe, safe_tensor_delete
    from backend.voxis_engine.core.optimization import optimize_model_for_inference, get_optimal_device
    from backend.voxis_engine.core.errors import (
        VoxisError, DeviceMemoryError, ModelLoadError, AudioProcessingError, FormatUnsupportedError
    )
except ImportError:
    from voxis_engine.core.failsafe import with_oom_failsafe, safe_tensor_delete
    from voxis_engine.core.optimization import optimize_model_for_inference, get_optimal_device
    from voxis_engine.core.errors import (
        VoxisError, DeviceMemoryError, ModelLoadError, AudioProcessingError, FormatUnsupportedError
    )

# PERFORMANCE: Set torch to use all available threads and optimize for inference
torch.set_num_threads(max(1, os.cpu_count() or 4))
torch.set_grad_enabled(False)  # Global: no gradient computation needed for inference

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional dependency imports — guarded for graceful degradation
# ---------------------------------------------------------------------------

# Trinity Polish Module (Denoise)
try:
    from df.enhance import enhance, init_df
    DEEPFILTER_AVAILABLE = True
except ImportError:
    DEEPFILTER_AVAILABLE = False
    print("WARNING: DeepFilterNet not available. Install with: pip install deepfilternet")

# Trinity Spatial Magnify (Upscale)
try:
    from audiosr import super_resolution, build_model
    AUDIOSR_AVAILABLE = True
except ImportError:
    AUDIOSR_AVAILABLE = False
    print("WARNING: Spatial Magnify not available. Contact Glass Stone Support.")

# Trinity Reconstruction (Restore)
try:
    repo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voxis_engine", "models", "voicerestore_repo")
    if os.path.exists(repo_path) and repo_path not in sys.path:
        sys.path.append(repo_path)

    # Also add BigVGAN to path (nested dependency)
    bigvgan_path = os.path.join(repo_path, "BigVGAN")
    if os.path.exists(bigvgan_path) and bigvgan_path not in sys.path:
        sys.path.append(bigvgan_path)
    from model import OptimizedAudioRestorationModel
    VOICERESTORE_AVAILABLE = True
except ImportError:
    VOICERESTORE_AVAILABLE = False
    print("WARNING: Neural Reconstruction not available. Contact Glass Stone Support.")



# VOXIS Sharding — Neural Vocal Separation Engine
try:
    from backend.voxis_engine.wrappers.uvr_wrapper import UVRWrapper
    SHARDING_AVAILABLE = True
except ImportError:
    try:
        from voxis_engine.wrappers.uvr_wrapper import UVRWrapper
        SHARDING_AVAILABLE = True
    except ImportError:
        SHARDING_AVAILABLE = False
        print("WARNING: VOXIS Sharding (audio-separator) not available. Install with: pip install audio-separator[cpu]")

# Diff-HierVC (hayeong0/Diff-HierVC)
try:
    diff_hier_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voxis_engine", "models", "diff_hiervc")
    if os.path.exists(diff_hier_path) and diff_hier_path not in sys.path:
        sys.path.insert(0, diff_hier_path)
    try:
        from backend.voxis_engine.wrappers.diff_hiervc_wrapper import DiffHierVCWrapper
    except ImportError:
        from voxis_engine.wrappers.diff_hiervc_wrapper import DiffHierVCWrapper
    DIFF_HIER_AVAILABLE = True
except ImportError:
    DIFF_HIER_AVAILABLE = False
    import traceback
    traceback.print_exc()
    print("WARNING: Diff-HierVC wrapper could not be imported")

# PhaseLimiter (Glass Stone / Bakuage)
try:
    from backend.voxis_engine.wrappers.phaselimiter_wrapper import PhaseLimiter
    PHASELIMITER_AVAILABLE = True
except ImportError:
    try:
        from voxis_engine.wrappers.phaselimiter_wrapper import PhaseLimiter
        PHASELIMITER_AVAILABLE = True
    except ImportError:
        PHASELIMITER_AVAILABLE = False
        print("WARNING: PhaseLimiter wrapper not available.")

# Spectrum Analyzer (Yazdi9 / VoiceRestore integration)
try:
    from backend.voxis_engine.wrappers.spectrum_wrapper import SpectrumAnalyzer
    SPECTRUM_AVAILABLE = True
except ImportError:
    try:
        from voxis_engine.wrappers.spectrum_wrapper import SpectrumAnalyzer
        SPECTRUM_AVAILABLE = True
    except ImportError:
        SPECTRUM_AVAILABLE = False
        print("WARNING: SpectrumAnalyzer wrapper not available.")


class VoxisPipeline:
    """
    VOXIS v4.0.0 Voice-Optimized Audio Restoration Pipeline — Trinity v8.1 Engine
    By Glass Stone 2026 / Closed License

    All models are always active. Diffusion and Transformer run together
    in a single unified restoration stage for maximum voice quality.

    Voice-Optimized Defaults:
      - HP Filter: 80 Hz (removes rumble, HVAC, traffic)
      - LP Filter: 12 kHz (removes hiss, ultrasonic artifacts — voice harmonics peak at 8kHz)
      - Denoise: 0.92 strength (aggressive noise suppression, voice-safe)
      - Amp threshold: -26 dB (catches medium-quiet speech)
      - Amp target: -16 dB (broadcast voice level)
    """

    def __init__(
        self,
        denoise_strength: float = 0.92,  # Voice: more aggressive noise removal
        high_precision: bool = True,
        upscale_factor: int = 2,
        target_sample_rate: int = 48000,
        target_channels: int = 2,
        voicerestore_steps: int = 32,
        voicerestore_cfg: float = 0.5,
        hp_freq: float = 80.0,     # Voice HP: remove sub-bass rumble
        lp_freq: float = 16000.0,  # Voice LP: 16kHz (preserves full voice spectrum + air)
        amp_target_db: float = -16.0,   # Voice broadcast level
        amp_threshold_db: float = -26.0, # Catch medium-quiet speech
        **kwargs,  # Accept and ignore legacy params like 'mode'
    ):
        self.denoise_strength = denoise_strength
        self.high_precision = high_precision
        self.upscale_factor = upscale_factor
        self.target_sample_rate = target_sample_rate
        self.target_channels = target_channels
        self.voicerestore_steps = voicerestore_steps
        self.voicerestore_cfg = voicerestore_cfg
        self.hp_freq = hp_freq
        self.lp_freq = lp_freq
        self.amp_target_db = amp_target_db
        self.amp_threshold_db = amp_threshold_db

        # PERFORMANCE: Pre-compute Butterworth filter coefficients
        # These never change after init — saves ~5ms per process() call
        self._hp_sos = None
        self._lp_sos = None
        self._filter_sr = None

        # PERFORMANCE: Cache torchaudio resamplers — avoids re-creating for same sr pairs
        self._resampler_cache: Dict[tuple, torchaudio.transforms.Resample] = {}

        # PERFORMANCE: Correct path resolution for PyInstaller frozen mode + Electron Bundle
        if os.environ.get("VOXIS_ROOT_PATH"):
            exe_dir = os.environ["VOXIS_ROOT_PATH"]
            self.models_dir = os.path.abspath(os.path.join(exe_dir, "..", "..", "models"))
            logger.info(f"VOXIS Root Path set: {exe_dir}")
            logger.info(f"Models Dir resolution: {self.models_dir}")
        elif getattr(sys, 'frozen', False):
            exe_dir = os.path.dirname(sys.executable)
            self.models_dir = os.path.abspath(os.path.join(exe_dir, "..", "..", "models"))
        else:
            base_path = os.path.dirname(os.path.abspath(__file__))
            self.models_dir = os.path.join(base_path, "models")

        # Device detection — prioritize Apple Silicon MPS and CUDA
        if torch.cuda.is_available():
            self.device = "cuda"
            logger.info("TRINITY v8.1 | Device: CUDA")
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            self.device = "mps"
            logger.info("TRINITY v8.1 | Device: MPS (Apple Silicon)")
        else:
            self.device = "cpu"
            logger.info("TRINITY v8.1 | Device: CPU")

        # --- Polish Module (Denoise) -----------------------------------------
        self.df_model = None
        self.df_state = None
        if DEEPFILTER_AVAILABLE:
            try:
                df_base = os.path.join(self.models_dir, "TrinityDenoise", "DeepFilterNet3")
                if os.path.exists(df_base) and os.path.exists(os.path.join(df_base, "config.ini")):
                    logger.info(f"Loading DeepFilterNet3 from: {df_base}")
                    self.df_model, self.df_state, _ = init_df(
                        model_base_dir=df_base, config_allow_defaults=True
                    )
                else:
                    logger.warning("DeepFilterNet3 not found locally, using default download")
                    self.df_model, self.df_state, _ = init_df(config_allow_defaults=True)
                logger.info("Trinity Polish Module loaded — HIGH precision, voice-optimized")
            except Exception as e:
                logger.exception(f"Failed to load Polish Module: {e}")

        # --- Spatial Magnify (Upscale) — Always active ------------------------
        self.audiosr_model = None
        if AUDIOSR_AVAILABLE:
            try:
                model_name = "basic"
                local_model_dir = os.path.join(self.models_dir, "TrinityUpscale", f"audiosr-{model_name}")
                if os.path.exists(local_model_dir):
                    ckpt_file = os.path.join(local_model_dir, "pytorch_model.bin")
                    if os.path.exists(ckpt_file):
                        logger.info(f"Loading AudioSR from: {ckpt_file}")
                    self.audiosr_model = build_model(model_name=model_name, device=self.device)
                    self.audiosr_model = optimize_model_for_inference(self.audiosr_model, device=self.device, enable_fp16=(self.device != "mps"))
                else:
                    logger.warning("Spatial Magnify not found locally, using default download")
                    self.audiosr_model = build_model(model_name=model_name, device=self.device)
                logger.info(f"Spatial Magnify loaded — {self.upscale_factor}x upscale, {self.target_channels}ch output")
            except Exception as e:
                logger.exception(f"Failed to load Spatial Magnify: {e}")

    # --- Neural Reconstruction (Restore) — Always active ------------------
        self.voicerestore_model = None
        if VOICERESTORE_AVAILABLE:
            try:
                checkpoint_dir = os.path.join(self.models_dir, "TrinityRestore")
                ckpt_path = os.path.join(checkpoint_dir, "voicerestore-1.1.pth")
                if os.path.exists(ckpt_path):
                    print(f"Loading VoiceRestore from: {ckpt_path}")
                    # Load BigVGAN first
                    print("Loading BigVGAN for VoiceRestore...")
                    try:
                        from BigVGAN.bigvgan import BigVGAN as VR_BigVGAN
                        bigvgan = VR_BigVGAN.from_pretrained('nvidia/bigvgan_v2_24khz_100band_256x', use_cuda_kernel=False)
                        bigvgan.remove_weight_norm()
                        bigvgan = bigvgan.eval().to(self.device)
                    except Exception as e:
                        raise ModelLoadError(f"Failed to load Neural Reconstruction BigVGAN: {e}", stage="RESTORE")

                    model = OptimizedAudioRestorationModel(
                        target_sample_rate=24000,
                        device=self.device,
                        bigvgan_model=bigvgan
                    )
                    state_dict = torch.load(ckpt_path, map_location=self.device)
                    model.load_state_dict(state_dict, strict=False)
                    model.to(self.device).eval()
                    self.voicerestore_model = optimize_model_for_inference(model, device=self.device, enable_fp16=(self.device != "mps"))
                    print("VoiceRestore loaded — voice-optimized restoration mode")
                else:
                    print(f"VoiceRestore checkpoint not found at {ckpt_path}")
            except Exception as e:
                print(f"Failed to load VoiceRestore: {e}")
                import traceback
                traceback.print_exc()

        # --- Diff-HierVC (Diffusion Restoration) — Always active --------------
        self.diff_hier_model = None
        if DIFF_HIER_AVAILABLE:
            try:
                self.diff_hier_model = DiffHierVCWrapper(self.models_dir)
                if not self.diff_hier_model.loaded:
                    print("DiffHierVC wrapper loaded but model initialization failed")
                    self.diff_hier_model = None
                else:
                    print("DiffHierVC loaded — Diffusion voice restoration active")
            except VoxisError as ve:
                raise
            except Exception as e:
                logger.error(f"Failed to load Diff-HierVC: {e}")
                import traceback
                traceback.print_exc()

        # --- PhaseLimiter (Mastering) — Always active -------------------------
        self.phaselimiter = None
        if PHASELIMITER_AVAILABLE:
            try:
                self.phaselimiter = PhaseLimiter()
                print("PhaseLimiter loaded — voice mastering active")
            except Exception as e:
                print(f"Failed to init PhaseLimiter: {e}")

        # --- Spectrum Analyzer -----------------------------------------------
        self.spectrum_analyzer = None
        if SPECTRUM_AVAILABLE:
            try:
                self.spectrum_analyzer = SpectrumAnalyzer()
                print("SpectrumAnalyzer loaded")
            except Exception as e:
                print(f"Failed to init SpectrumAnalyzer: {e}")

        # --- VOXIS Sharding (Neural Separation) — Always active ----------------
        self.uvr_wrapper = None
        if SHARDING_AVAILABLE:
            try:
                self.uvr_wrapper = UVRWrapper(
                    model_filename="UVR-MDX-NET-Voc_FT.onnx",
                    output_format="wav",
                    normalization_threshold=0.9,
                    output_single_stem="vocals",
                    log_level=logging.WARNING
                )
                print("VOXIS Sharding initialized — voice isolation active")
            except Exception as e:
                print(f"Failed to init VOXIS Sharding: {e}")

        # PERFORMANCE: Pre-compute filters at default sample rate (48kHz)
        self._precompute_filters(self.target_sample_rate)

    # ── PERFORMANCE: Pre-computed filter coefficients ─────────────────────
    def _precompute_filters(self, sr: int):
        """Pre-compute Butterworth SOS coefficients for given sample rate."""
        if self._filter_sr == sr:
            return  # Already computed for this sr
        nyquist = sr / 2.0
        order = 4
        if self.hp_freq > 0 and self.hp_freq < nyquist:
            self._hp_sos = butter(order, self.hp_freq / nyquist, btype='highpass', output='sos')
        else:
            self._hp_sos = None
        if self.lp_freq > 0 and self.lp_freq < nyquist:
            self._lp_sos = butter(order, self.lp_freq / nyquist, btype='lowpass', output='sos')
        else:
            self._lp_sos = None
        self._filter_sr = sr

    # ── PERFORMANCE: Cached resampler ─────────────────────────────────────
    def _resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """Fast resampling with cached torchaudio Resample transforms."""
        if orig_sr == target_sr:
            return audio
        try:
            waveform = torch.from_numpy(audio).float()
            # Use cached resampler — avoids recomputing filter bank each call
            cache_key = (orig_sr, target_sr)
            if cache_key not in self._resampler_cache:
                self._resampler_cache[cache_key] = torchaudio.transforms.Resample(
                    orig_freq=orig_sr, new_freq=target_sr
                )
            resampler = self._resampler_cache[cache_key]
            resampled = resampler(waveform)
            return resampled.numpy()
        except Exception as e:
            print(f"Torchaudio resampling failed, falling back to librosa: {e}")
            return librosa.resample(audio, orig_sr=orig_sr, target_sr=target_sr)

    # ── PERFORMANCE: In-place filtering with pre-computed coefficients ────
    def _apply_filters(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """
        Apply voice-band Butterworth filters using pre-computed coefficients.
        HP removes rumble (sub-80Hz). LP removes hiss (above 12kHz).
        In-place processing — no unnecessary array copy.
        """
        self._precompute_filters(sr)

        if self._hp_sos is not None:
            for i in range(audio.shape[0]):
                audio[i] = sosfilt(self._hp_sos, audio[i]).astype(np.float32)

        if self._lp_sos is not None:
            for i in range(audio.shape[0]):
                audio[i] = sosfilt(self._lp_sos, audio[i]).astype(np.float32)

        return audio

    # ── PERFORMANCE: Vectorized dynamic amplification ─────────────────────
    def _dynamic_amplify(self, audio: np.ndarray, sr: int,
                         threshold_db: float = None,
                         target_db: float = None) -> tuple:
        """
        Voice-optimized dynamic amplification.
        Measures per-channel RMS. If below threshold, boosts toward target
        with tanh soft-limiting to prevent clipping.
        In-place operation — no unnecessary copy.
        """
        threshold = threshold_db if threshold_db is not None else self.amp_threshold_db
        target = target_db if target_db is not None else self.amp_target_db
        max_gain_db = 30.0
        details = {"channels": [], "threshold_db": threshold, "target_db": target}

        for i in range(audio.shape[0]):
            channel = audio[i]

            # Vectorized RMS
            rms = np.sqrt(np.dot(channel, channel) / len(channel))
            if rms < 1e-10:
                details["channels"].append({"channel": i, "action": "silence_skip"})
                continue

            rms_db = 20 * np.log10(rms + 1e-10)

            if rms_db < threshold:
                gain_db = min(target - rms_db, max_gain_db)
                gain_linear = 10 ** (gain_db / 20.0)

                # In-place multiply
                np.multiply(channel, gain_linear, out=channel)

                # Soft limiter (tanh) — prevent harsh clipping
                peak = np.max(np.abs(channel))
                if peak > 0.95:
                    np.divide(channel, 0.95, out=channel)
                    np.tanh(channel, out=channel)
                    np.multiply(channel, 0.95, out=channel)

                audio[i] = channel.astype(np.float32)
                new_rms = np.sqrt(np.dot(audio[i], audio[i]) / len(audio[i]))
                details["channels"].append({
                    "channel": i,
                    "action": "boosted",
                    "original_rms_db": round(float(rms_db), 2),
                    "gain_db": round(float(gain_db), 2),
                    "new_rms_db": round(float(20 * np.log10(new_rms + 1e-10)), 2),
                })
            else:
                details["channels"].append({
                    "channel": i,
                    "action": "no_boost_needed",
                    "rms_db": round(float(rms_db), 2),
                })

        return audio, details

    # ── PERFORMANCE: Batch VoiceRestore inference (both channels at once) ─
    def _voicerestore_pass(self, audio_channels_24k: list, pass_name: str) -> list:
        """
        Run VoiceRestore on a list of 24kHz channel arrays.
        Processes each channel through the model. Returns restored channels.
        """
        results = []
        for channel_24k in audio_channels_24k:
            try:
                input_tensor = torch.from_numpy(channel_24k).float().unsqueeze(0).to(self.device)
                with torch.inference_mode():
                    restored_tensor = self.voicerestore_model.forward(
                        input_tensor,
                        steps=self.voicerestore_steps,
                        cfg_strength=self.voicerestore_cfg,
                    )
                restored_np = restored_tensor.detach().cpu().squeeze(0).numpy()
                results.append(restored_np)
                # PERFORMANCE: Free GPU tensor immediately
                del input_tensor, restored_tensor
            except Exception as e:
                logger.error(f"{pass_name} failed: {e}")
                results.append(channel_24k)  # fallback: return input unchanged
        return results

    @with_oom_failsafe(fallback_device="cpu", clear_cache=True)
    def process(
        self,
        input_path: str,
        output_path: str,
        status_callback: Optional[Callable[[str, int, Optional[Dict]], None]] = None
    ) -> Dict[str, Any]:
        """Process audio through the Trinity v8.1 voice pipeline — all stages always active."""

        # ── ROBUST FORMAT VALIDATION ──────────────────────────────────────
        SUPPORTED_AUDIO = {"wav", "mp3", "flac", "ogg", "m4a", "aac", "wma", "aiff", "opus", "webm"}
        SUPPORTED_VIDEO = {"mp4", "mov", "mkv", "avi", "webm"}
        SUPPORTED_ALL = SUPPORTED_AUDIO | SUPPORTED_VIDEO

        input_ext = os.path.splitext(input_path)[1].lower().lstrip('.')
        if input_ext not in SUPPORTED_ALL:
            raise FormatUnsupportedError(
                f"Unsupported format: .{input_ext}  — accepted: {', '.join(sorted(SUPPORTED_ALL))}",
                stage="INGEST"
            )

        if not os.path.exists(input_path):
            raise AudioProcessingError(f"Input file not found: {input_path}", stage="INGEST")

        file_size = os.path.getsize(input_path)
        if file_size == 0:
            raise AudioProcessingError("Input file is empty (0 bytes)", stage="INGEST")

        # ── DERIVE OUTPUT NAME: original_name-voxis.format ────────────────
        original_basename = os.path.splitext(os.path.basename(input_path))[0]
        output_ext = os.path.splitext(output_path)[1].lower().lstrip('.')
        if not output_ext:
            output_ext = "wav"
        voxis_output_name = f"{original_basename}-voxis.{output_ext}"
        voxis_output_path = os.path.join(os.path.dirname(output_path), voxis_output_name)

        results: Dict[str, Any] = {
            "input_file": os.path.basename(input_path),
            "output_file": voxis_output_name,
            "output_path": voxis_output_path,
            "mode": "voice_optimized",
            "engine": "Trinity v8.1",
            "copyright": "Glass Stone 2026 / Closed License",
            "stages": {},
            "success": False,
        }

        def update_progress(stage: str, progress: int, details: Optional[Dict] = None):
            if status_callback:
                status_callback(stage, progress, details)

        try:
            # ==============================================================
            # STAGE 1 — ROBUST INGEST
            # ==============================================================
            update_progress("ingest", 0)
            actual_input = input_path
            load_method = "unknown"
            update_progress("ingest", 10, {"message": "Detecting format"})

            # ── VIDEO EXTRACTION ──────────────────────────────────────────
            if input_ext in SUPPORTED_VIDEO:
                update_progress("ingest", 15, {"message": "Extracting audio from video"})
                try:
                    extracted = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                    extracted_path = extracted.name
                    extracted.close()
                    cmd = [
                        "ffmpeg", "-y", "-i", input_path,
                        "-vn", "-acodec", "pcm_s16le", "-ar", "48000", "-ac", "2",
                        extracted_path
                    ]
                    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=300)
                    actual_input = extracted_path
                    load_method = "ffmpeg_video_extract"
                    print(f"INGEST: Extracted audio from video {input_ext}")
                except subprocess.CalledProcessError as e:
                    raise AudioProcessingError(f"FFmpeg video extraction failed: {e.stderr.decode()[:200]}", stage="INGEST")
                except subprocess.TimeoutExpired:
                    raise AudioProcessingError("Video extraction timed out (>5 min)", stage="INGEST")

            update_progress("ingest", 25, {"message": "Loading audio file"})

            # ── AUDIO LOADING — multi-strategy with fallbacks ─────────────
            audio = None
            sr = None

            # Strategy 1: soundfile (fastest)
            try:
                audio, sr = sf.read(actual_input, always_2d=True)
                audio = audio.T
                load_method = load_method if load_method != "unknown" else "soundfile"
            except Exception as sf_err:
                logger.warning(f"soundfile failed: {sf_err}")

            # Strategy 2: librosa
            if audio is None:
                try:
                    audio, sr = librosa.load(actual_input, sr=None, mono=False)
                    if audio.ndim == 1:
                        audio = audio.reshape(1, -1)
                    load_method = "librosa"
                except Exception as lib_err:
                    logger.warning(f"librosa failed: {lib_err}")

            # Strategy 3: ffmpeg → soundfile
            if audio is None:
                try:
                    update_progress("ingest", 35, {"message": "Converting via ffmpeg"})
                    ffmpeg_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                    ffmpeg_tmp_path = ffmpeg_tmp.name
                    ffmpeg_tmp.close()
                    cmd = [
                        "ffmpeg", "-y", "-i", actual_input,
                        "-vn", "-acodec", "pcm_s16le", "-ar", "48000", "-ac", "2",
                        ffmpeg_tmp_path
                    ]
                    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=300)
                    audio, sr = sf.read(ffmpeg_tmp_path, always_2d=True)
                    audio = audio.T
                    load_method = "ffmpeg_convert"
                    os.unlink(ffmpeg_tmp_path)
                except Exception as ff_err:
                    raise AudioProcessingError(
                        f"All audio loading strategies failed. Last error: {ff_err}", stage="INGEST"
                    )

            update_progress("ingest", 50, {"message": "Validating audio"})

            # ── VALIDATION ────────────────────────────────────────────────
            if audio.shape[-1] == 0:
                raise AudioProcessingError("Audio file has 0 samples", stage="INGEST")
            if sr < 8000:
                raise AudioProcessingError(f"Sample rate too low ({sr} Hz). Minimum 8000 Hz.", stage="INGEST")
            duration_sec = audio.shape[1] / sr
            if duration_sec > 7200:
                raise AudioProcessingError(f"Audio exceeds 2-hour limit ({duration_sec/3600:.1f}h)", stage="INGEST")
            if duration_sec < 0.1:
                raise AudioProcessingError(f"Audio too short ({duration_sec:.3f}s). Minimum 0.1s.", stage="INGEST")

            update_progress("ingest", 60, {"message": "Normalizing audio"})

            # ── NORMALIZE TO FLOAT32 [-1, 1] ──────────────────────────────
            if audio.dtype != np.float32:
                audio = audio.astype(np.float32)
            peak = np.max(np.abs(audio))
            if peak > 1.0:
                audio /= peak  # In-place
            elif peak < 1e-10:
                logger.warning("Audio appears to be near-silence (peak < -200dB)")
            elif peak < 0.1:
                gain = 0.5 / peak
                audio *= gain  # In-place
                print(f"INGEST: Quiet input (peak={peak:.6f}), boosted to {np.max(np.abs(audio)):.3f}")
                peak = np.max(np.abs(audio))

            update_progress("ingest", 80, {"message": "Gathering metadata"})

            original_sr = sr
            original_channels = audio.shape[0]
            original_duration = audio.shape[1] / sr

            results["input_metadata"] = {
                "sample_rate": original_sr,
                "channels": original_channels,
                "duration": round(original_duration, 3),
                "samples": audio.shape[1],
                "format": input_ext,
                "file_size_bytes": file_size,
                "load_method": load_method,
                "peak_amplitude": round(float(peak), 6),
            }
            results["original_name"] = original_basename

            print(f"INGEST: .{input_ext} | {original_sr}Hz | {original_channels}ch | {original_duration:.1f}s | {file_size/1024:.0f}KB | via {load_method}")
            update_progress("ingest", 100)

            # ==============================================================
            # STAGE 2 — SPECTRUM ANALYSIS
            # ==============================================================
            update_progress("analysis", 0)

            if self.spectrum_analyzer:
                try:
                    spectral_results = self.spectrum_analyzer.analyze(audio, sr)
                except Exception as e:
                    logger.warning(f"Spectrum analysis failed: {e}")
                    spectral_results = {"error": f"SpectrumAnalyzer failed: {e}"}
            else:
                spectral_results = {"error": "SpectrumAnalyzer not available"}

            results["stages"]["analysis"] = spectral_results
            update_progress("analysis", 100)

            # ==============================================================
            # STAGE 3 — VOICE-BAND FREQUENCY FILTER (HP 80Hz + LP 12kHz)
            # ==============================================================
            update_progress("filter", 0)

            try:
                audio = self._apply_filters(audio, sr)  # In-place with pre-computed coefficients
                results["stages"]["filter"] = {
                    "method": "Butterworth",
                    "order": 4,
                    "high_pass_hz": self.hp_freq,
                    "low_pass_hz": self.lp_freq,
                    "voice_optimized": True,
                }
                print(f"FILTER: Voice-band HP={self.hp_freq}Hz LP={self.lp_freq}Hz applied")
            except Exception as e:
                logger.error(f"Frequency filter failed: {e}. Continuing without filtering.")
                results["stages"]["filter"] = {"error": str(e)}

            update_progress("filter", 100)

            # ==============================================================
            # STAGE 4 — DENOISING (DeepFilterNet HIGH — voice-optimized)
            # ==============================================================
            update_progress("denoise", 0)

            if DEEPFILTER_AVAILABLE and self.df_model is not None:
                # DeepFilterNet expects 48 kHz
                if sr != 48000:
                    resampled_audio = self._resample(audio, sr, 48000)
                    df_sr = 48000
                else:
                    resampled_audio = audio
                    df_sr = sr

                num_channels = resampled_audio.shape[0]

                # PERFORMANCE: Direct processing for stereo (no ThreadPool overhead)
                def _denoise_channel(channel):
                    """Denoise a single channel with gain preservation."""
                    channel_tensor = torch.from_numpy(channel).float()
                    if channel_tensor.dim() == 1:
                        channel_tensor = channel_tensor.unsqueeze(0)

                    with torch.inference_mode():
                        enhanced_tensor = enhance(
                            self.df_model,
                            self.df_state,
                            channel_tensor,
                            atten_lim_db=40,  # 40dB limit — aggressive but preserves vocals
                        )
                    if isinstance(enhanced_tensor, torch.Tensor):
                        enhanced = enhanced_tensor.squeeze(0).numpy() if enhanced_tensor.dim() > 1 else enhanced_tensor.numpy()
                    else:
                        enhanced = enhanced_tensor.squeeze() if enhanced_tensor.ndim > 1 else enhanced_tensor

                    # Blend with strength
                    blended = self.denoise_strength * enhanced + (1 - self.denoise_strength) * channel

                    # Gain preservation — restore original RMS after denoise blend
                    orig_rms = np.sqrt(np.dot(channel, channel) / len(channel))
                    blend_rms = np.sqrt(np.dot(blended, blended) / len(blended))
                    if blend_rms > 1e-10 and orig_rms > 1e-10:
                        gain_restore = min(orig_rms / blend_rms, 2.0)
                        blended *= gain_restore

                    return blended

                try:
                    # PERFORMANCE: Process channels directly — ThreadPool overhead
                    # isn't worth it for just 1-2 channels
                    denoised_channels = np.empty_like(resampled_audio)
                    for i in range(num_channels):
                        denoised_channels[i] = _denoise_channel(resampled_audio[i])
                        update_progress("denoise", int((i + 1) / num_channels * 100))

                    denoised_audio = denoised_channels
                    current_sr = df_sr

                    results["stages"]["denoise"] = {
                        "method": "DeepFilterNet3",
                        "strength": self.denoise_strength,
                        "high_precision": True,
                        "setting": "HIGH",
                        "atten_lim_db": "unlimited",
                        "voice_optimized": True,
                    }
                except Exception as e:
                    logger.error(f"DeepFilterNet stage failed: {e}. Falling back to noisereduce.")
                    results["stages"]["denoise"] = {"method": "DeepFilterNet_failed_fallback", "error": str(e)}
                    denoised_audio = audio
                    current_sr = sr
            else:
                # Fallback — noisereduce spectral gating (voice-tuned)
                try:
                    denoised_channels = np.empty_like(audio)
                    for i in range(audio.shape[0]):
                        denoised_channels[i] = nr.reduce_noise(
                            y=audio[i], sr=sr, stationary=False,
                            prop_decrease=self.denoise_strength,
                            n_fft=2048, hop_length=512,
                        )
                        update_progress("denoise", int((i + 1) / audio.shape[0] * 100))
                    denoised_audio = denoised_channels
                    current_sr = sr
                    results["stages"]["denoise"] = {
                        "method": "noisereduce_fallback",
                        "strength": self.denoise_strength,
                        "note": "DeepFilterNet not available, using spectral gating",
                    }
                except Exception as e:
                    logger.error(f"Noisereduce fallback also failed: {e}. Skipping denoise.")
                    denoised_audio = audio
                    current_sr = sr
                    results["stages"]["denoise"] = {"method": "skipped_due_to_error", "error": str(e)}

            update_progress("denoise", 100)

            # PERFORMANCE: Free original audio buffer — only gc at GPU boundary
            del audio
            if 'resampled_audio' in dir():
                del resampled_audio

            # ==============================================================
            # STAGE 5 — VOXIS SHARDING (Neural Vocal Isolation)
            # ==============================================================
            update_progress("sharding", 0)

            if SHARDING_AVAILABLE:
                dense_input = None
                dense_output_dir = None
                pre_sharding_rms = np.sqrt(np.mean(denoised_audio ** 2))
                try:
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                        dense_input = tmp.name
                        sf.write(dense_input, denoised_audio.T, current_sr)

                    dense_output_dir = tempfile.mkdtemp(prefix="voxis_dense_")
                    update_progress("sharding", 20, {"message": "Running vocal isolation"})

                    if self.uvr_wrapper:
                        separation_files = self.uvr_wrapper.separate(dense_input, dense_output_dir)
                    else:
                         raise RuntimeError("VOXIS Sharding engine not initialized")

                    update_progress("sharding", 80, {"message": "Loading isolated vocals"})

                    # ── VOCAL STEM SELECTION ──────────────────────────────────
                    # output_single_stem="vocals" is set, so separator should return
                    # only the vocal stem file. Log everything for diagnostics.
                    vocal_loaded = False
                    print(f"SHARDING: Separator returned {len(separation_files) if separation_files else 0} files: {separation_files}")

                    if separation_files:
                        # Strategy 1: If output_single_stem is configured, there should be
                        # exactly one file — use it directly (it IS the vocal stem)
                        if len(separation_files) == 1:
                            stem_path = separation_files[0]
                            if os.path.exists(stem_path):
                                dense_audio, dense_sr = sf.read(stem_path, always_2d=True)
                                dense_audio = dense_audio.T
                                vocal_loaded = True
                                print(f"SHARDING: Single-stem mode — using {os.path.basename(stem_path)}")

                        # Strategy 2: Multiple files — search for vocal stem by name patterns
                        if not vocal_loaded:
                            vocal_patterns = ["(Vocals)", "Vocals", "vocal", "voice"]
                            instrumental_patterns = ["(Instrumental)", "Instrumental", "instrumental", "inst", "accompaniment"]
                            
                            for fpath in separation_files:
                                basename = os.path.basename(fpath)
                                # Check if this is a VOCAL file (not instrumental)
                                is_vocal = any(p in basename for p in vocal_patterns)
                                is_instrumental = any(p in basename for p in instrumental_patterns)
                                
                                if is_vocal and not is_instrumental and os.path.exists(fpath):
                                    dense_audio, dense_sr = sf.read(fpath, always_2d=True)
                                    dense_audio = dense_audio.T
                                    vocal_loaded = True
                                    print(f"SHARDING: Found vocal stem: {basename}")
                                    break

                        # Strategy 3: Last resort — use the SMALLEST file (vocals are
                        # typically smaller than the full mix/instrumental)
                        if not vocal_loaded:
                            existing_files = [(f, os.path.getsize(f)) for f in separation_files if os.path.exists(f)]
                            if existing_files:
                                # Skip any file with instrumental patterns
                                non_instrumental = [
                                    (f, s) for f, s in existing_files
                                    if not any(p in os.path.basename(f) for p in ["Instrumental", "instrumental", "accompaniment"])
                                ]
                                if non_instrumental:
                                    # Use the one that's NOT instrumental
                                    chosen = non_instrumental[0][0]
                                else:
                                    # All files look instrumental — just use the first
                                    chosen = existing_files[0][0]
                                
                                dense_audio, dense_sr = sf.read(chosen, always_2d=True)
                                dense_audio = dense_audio.T
                                vocal_loaded = True
                                print(f"SHARDING: WARNING — Fallback stem selection used: {os.path.basename(chosen)}")
                                print(f"SHARDING: Available files were: {[os.path.basename(f) for f, _ in existing_files]}")

                    if vocal_loaded:
                        if dense_sr != current_sr:
                            dense_audio = self._resample(dense_audio, dense_sr, current_sr)

                        # SAFETY CHECK: If sharding removed >90% of energy, skip it
                        # (means vocals were likely misclassified as instrumental)
                        post_sharding_rms = np.sqrt(np.mean(dense_audio ** 2))
                        rms_ratio = post_sharding_rms / (pre_sharding_rms + 1e-10)
                        print(f"SHARDING: RMS ratio = {rms_ratio:.3f} (pre={pre_sharding_rms:.4f}, post={post_sharding_rms:.4f})")

                        if rms_ratio < 0.1:
                            print(f"SHARDING: WARNING — Vocal stem lost >90% energy (ratio={rms_ratio:.3f}). Skipping separation.")
                            results["stages"]["sharding"] = {
                                "method": "skipped_safety",
                                "reason": f"Vocal stem energy too low (ratio={rms_ratio:.3f})",
                            }
                        else:
                            denoised_audio = dense_audio
                            print(f"SHARDING: Vocal isolation complete — {denoised_audio.shape}")
                            results["stages"]["sharding"] = {
                                "method": "VOXIS Sharding",
                                "engine": "MDX-NET",
                                "model": "UVR-MDX-NET-Voc_FT",
                                "stem": "vocals",
                                "rms_ratio": round(float(rms_ratio), 3),
                            }
                    else:
                        print("SHARDING: No output files found — skipping separation")
                        results["stages"]["sharding"] = {"method": "skipped", "note": "No output files found"}

                except Exception as e:
                    logger.error(f"VOXIS Sharding failed: {e}. Continuing without separation.")
                    import traceback
                    traceback.print_exc()
                    results["stages"]["sharding"] = {"method": "skipped", "error": str(e)}
                finally:
                    # Clean up temp files including any stray separator outputs
                    try:
                        if dense_input and os.path.exists(dense_input):
                            os.unlink(dense_input)
                        if dense_output_dir and os.path.exists(dense_output_dir):
                            shutil.rmtree(dense_output_dir, ignore_errors=True)
                        # Clean any stray separator output in CWD
                        cwd = os.getcwd()
                        for f in os.listdir(cwd):
                            if f.startswith("tmp") and f.endswith(".wav") and ("Vocals" in f or "Instrumental" in f):
                                try:
                                    os.unlink(os.path.join(cwd, f))
                                except Exception:
                                    pass
                    except Exception:
                        pass
            else:
                results["stages"]["sharding"] = {"method": "skipped", "note": "VOXIS Sharding not installed"}

            update_progress("sharding", 100)

            # ==============================================================
            # STAGE 6 — DYNAMIC AMPLIFICATION (Voice-targeted boost)
            # ==============================================================
            update_progress("amplify", 0)

            try:
                denoised_audio, amp_details = self._dynamic_amplify(denoised_audio, current_sr)
                results["stages"]["amplify"] = {
                    "method": "dynamic_amplification",
                    "target_rms_db": self.amp_target_db,
                    "threshold_db": self.amp_threshold_db,
                    "details": amp_details,
                }
                print(f"AMPLIFY: Voice amplification applied — {amp_details}")
            except Exception as e:
                logger.error(f"Dynamic amplification failed: {e}. Continuing.")
                results["stages"]["amplify"] = {"error": str(e)}

            update_progress("amplify", 100)

            # ==============================================================
            # STAGE 7 — UNIFIED HYBRID VOICE RESTORATION
            # PERFORMANCE: Batch resampling — resample to 24kHz ONCE,
            # run all VoiceRestore passes at 24kHz, resample back ONCE.
            # Old code: 4 resamples per channel (2 in pre-pass, 2 in post-pass)
            # New code: 2 resamples per channel total (1 down, 1 up)
            # ==============================================================
            update_progress("hybrid_restore", 0)

            hybrid_methods = []
            if self.diff_hier_model is not None or self.voicerestore_model is not None:
                num_ch = denoised_audio.shape[0]
                processed_channels = []

                for i in range(num_ch):
                    update_progress("hybrid_restore", int((i / num_ch) * 90), {"channel": i+1})
                    channel_audio = denoised_audio[i]

                    # ── BATCH RESAMPLE: Convert to 24kHz once for both VoiceRestore passes ──
                    need_resample_vr = (self.voicerestore_model is not None and current_sr != 24000)
                    if need_resample_vr:
                        channel_24k = self._resample(channel_audio.reshape(1, -1), current_sr, 24000)[0]
                    else:
                        channel_24k = channel_audio

                    # 1. Transformer Pre-Pass (VoiceRestore)
                    if self.voicerestore_model is not None:
                        try:
                            input_tensor = torch.from_numpy(channel_24k).float().unsqueeze(0).to(self.device)
                            with torch.inference_mode():
                                restored_tensor = self.voicerestore_model.forward(
                                    input_tensor,
                                    steps=self.voicerestore_steps,
                                    cfg_strength=self.voicerestore_cfg,
                                )
                            channel_24k = restored_tensor.detach().cpu().squeeze(0).numpy()
                            del input_tensor, restored_tensor
                            if "VoiceRestore(Pre)" not in hybrid_methods:
                                hybrid_methods.append("VoiceRestore(Pre)")
                        except Exception as e:
                            logger.error(f"VoiceRestore(Pre) ch{i}: {e}")

                    # 2. Diffusion Pass (Diff-HierVC) — operates at its own sample rate
                    if self.diff_hier_model is not None:
                        try:
                            # Diff-HierVC handles its own resampling internally
                            diff_input = channel_24k if not need_resample_vr else self._resample(
                                channel_24k.reshape(1, -1), 24000, current_sr
                            )[0]
                            restored_segment, out_sr = self.diff_hier_model.process(
                                diff_input, current_sr if need_resample_vr else 24000,
                                diffpitch_steps=30,
                                diffvoice_steps=6
                            )
                            if out_sr != (24000 if not need_resample_vr else current_sr):
                                restored_segment = self._resample(
                                    restored_segment.reshape(1, -1) if restored_segment.ndim == 1 else restored_segment,
                                    out_sr, 24000 if not need_resample_vr else current_sr
                                )
                                if restored_segment.ndim > 1:
                                    restored_segment = restored_segment[0]

                            # Length match
                            target_len = channel_24k.shape[-1] if not need_resample_vr else channel_audio.shape[-1]
                            if restored_segment.shape[-1] != target_len:
                                if restored_segment.shape[-1] < target_len:
                                    restored_segment = np.pad(restored_segment, (0, target_len - restored_segment.shape[-1]))
                                else:
                                    restored_segment = restored_segment[:target_len]

                            if need_resample_vr:
                                channel_24k = self._resample(restored_segment.reshape(1, -1), current_sr, 24000)[0]
                            else:
                                channel_24k = restored_segment

                            if "Diff-HierVC" not in hybrid_methods:
                                hybrid_methods.append("Diff-HierVC")
                        except Exception as e:
                            logger.error(f"Diff-HierVC ch{i}: {e}")
                            import traceback
                            traceback.print_exc()

                    # 3. Transformer Post-Pass (VoiceRestore)
                    if self.voicerestore_model is not None:
                        try:
                            input_tensor = torch.from_numpy(channel_24k).float().unsqueeze(0).to(self.device)
                            with torch.inference_mode():
                                restored_tensor = self.voicerestore_model.forward(
                                    input_tensor,
                                    steps=self.voicerestore_steps,
                                    cfg_strength=self.voicerestore_cfg,
                                )
                            channel_24k = restored_tensor.detach().cpu().squeeze(0).numpy()
                            del input_tensor, restored_tensor
                            if "VoiceRestore(Post)" not in hybrid_methods:
                                hybrid_methods.append("VoiceRestore(Post)")
                        except Exception as e:
                            logger.error(f"VoiceRestore(Post) ch{i}: {e}")

                    # ── BATCH RESAMPLE BACK: 24kHz → current_sr (once) ──
                    if need_resample_vr:
                        channel_audio = self._resample(channel_24k.reshape(1, -1), 24000, current_sr)[0]
                    else:
                        channel_audio = channel_24k

                    processed_channels.append(channel_audio)

                denoised_audio = np.array(processed_channels)

                # ── SAFE CLIPPING PREVENTION ─────────────────────────────
                max_val = np.max(np.abs(denoised_audio))
                restore_rms_db = 20 * np.log10(np.sqrt(np.mean(denoised_audio ** 2)) + 1e-10)
                print(f"RESTORE: peak={max_val:.4f}, RMS={restore_rms_db:.1f}dB")

                if max_val > 1.0:
                    np.tanh(denoised_audio, out=denoised_audio)
                    denoised_audio *= 0.98
                    print(f"RESTORE: Soft-clipped peaks from {max_val:.3f} → {np.max(np.abs(denoised_audio)):.3f}")
                elif max_val < 0.01 and max_val > 0:
                    print(f"RESTORE: WARNING — near-silence ({max_val:.6f}), boosting")
                    denoised_audio = denoised_audio / max_val * 0.5

                results["stages"]["hybrid_restore"] = {
                    "methods": hybrid_methods,
                    "restore_peak": round(float(max_val), 4),
                    "restore_rms_db": round(float(restore_rms_db), 1),
                    "status": "success" if hybrid_methods else "skipped due to errors"
                }
            else:
                results["stages"]["hybrid_restore"] = {"method": "skipped", "note": "Models not loaded"}

            update_progress("hybrid_restore", 100)

            # PERFORMANCE: Only gc.collect() at major GPU boundary
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()

            # ==============================================================
            # STAGE 7.5 — POST-RESTORE LOUDNESS RECOVERY
            # ==============================================================
            post_rms = np.sqrt(np.mean(denoised_audio ** 2))
            post_rms_db = 20 * np.log10(post_rms + 1e-10)
            print(f"POST-RESTORE: RMS = {post_rms_db:.1f}dB, peak = {np.max(np.abs(denoised_audio)):.4f}")

            if post_rms_db < -22.0:
                denoised_audio, post_amp_details = self._dynamic_amplify(
                    denoised_audio, current_sr,
                    threshold_db=-22.0,
                    target_db=-14.0
                )
                new_rms_db = 20 * np.log10(np.sqrt(np.mean(denoised_audio ** 2)) + 1e-10)
                print(f"POST-RESTORE AMP: {post_rms_db:.1f}dB → {new_rms_db:.1f}dB")
                results["stages"]["post_restore_amp"] = {
                    "applied": True,
                    "input_rms_db": round(post_rms_db, 1),
                    "output_rms_db": round(new_rms_db, 1),
                    "details": post_amp_details,
                }
            else:
                results["stages"]["post_restore_amp"] = {"applied": False, "rms_db": round(post_rms_db, 1)}

            # ==============================================================
            # STAGE 8 — UPSCALE (AudioSR)
            # ==============================================================
            update_progress("upscale", 0)

            print(f"UPSCALE INPUT: peak={np.max(np.abs(denoised_audio)):.4f}, RMS={20*np.log10(np.sqrt(np.mean(denoised_audio**2))+1e-10):.1f}dB")

            if AUDIOSR_AVAILABLE and self.audiosr_model is not None and self.upscale_factor > 1:
                tmp_input = None
                try:
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                        tmp_input = tmp.name
                        sf.write(tmp_input, denoised_audio.T, current_sr)

                    upscaled = super_resolution(
                        self.audiosr_model, tmp_input,
                        seed=42, guidance_scale=3.5, ddim_steps=50,
                    )
                    final_audio = upscaled

                    if hasattr(final_audio, "numpy"):
                        final_audio = final_audio.numpy()
                    while final_audio.ndim > 2:
                        final_audio = final_audio.squeeze()
                    if final_audio.ndim == 1:
                        final_audio = final_audio.reshape(1, -1)
                    if final_audio.shape[0] > final_audio.shape[1] and final_audio.shape[1] <= 2:
                         final_audio = final_audio.T

                    final_sr = self.target_sample_rate
                    results["stages"]["upscale"] = {
                        "method": "AudioSR",
                        "input_sr": current_sr,
                        "output_sr": final_sr,
                        "factor": self.upscale_factor,
                    }
                except Exception as e:
                    logger.error(f"AudioSR failed: {e}. Falling back to resample.")
                    final_audio = self._resample(denoised_audio, current_sr, self.target_sample_rate)
                    final_sr = self.target_sample_rate
                    results["stages"]["upscale"] = {
                        "method": "torchaudio_resample_fallback",
                        "input_sr": current_sr, "output_sr": final_sr, "error": str(e),
                    }
                finally:
                    if tmp_input and os.path.exists(tmp_input):
                        os.unlink(tmp_input)
                update_progress("upscale", 80)
            else:
                if current_sr != self.target_sample_rate:
                    final_audio = self._resample(denoised_audio, current_sr, self.target_sample_rate)
                    final_sr = self.target_sample_rate
                else:
                    final_audio = denoised_audio
                    final_sr = current_sr
                results["stages"]["upscale"] = {
                    "method": "torchaudio_resample" if not AUDIOSR_AVAILABLE else "skipped",
                    "input_sr": current_sr, "output_sr": final_sr,
                }

            update_progress("upscale", 100)

            # ==============================================================
            # STAGE 9 — PHASELIMITER (Voice Mastering)
            # ==============================================================
            if self.phaselimiter is not None:
                update_progress("phaselimiter", 0)
                pl_input = None
                pl_output = None
                try:
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                        pl_input = tmp.name
                        sf.write(pl_input, final_audio.T, final_sr)
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                        pl_output = tmp.name

                    update_progress("phaselimiter", 20, {"message": "Voice mastering"})

                    self.phaselimiter.process(
                        pl_input, pl_output,
                        mode="phase",
                        ceiling=-0.1,
                        ceiling_mode="true_peak",
                        reference=-14.0,
                        reference_mode="loudness",
                        freq_expansion=True,
                        freq_expansion_ratio=1.5,
                        mastering=True,
                        mastering_mode="classic"
                    )

                    update_progress("phaselimiter", 80)
                    pl_audio, pl_sr = sf.read(pl_output, always_2d=True)
                    final_audio = pl_audio.T
                    final_sr = pl_sr

                    results["stages"]["phaselimiter"] = {
                        "method": "PhaseLimiter",
                        "mastering": True,
                        "freq_expansion": True,
                        "output_sr": final_sr,
                        "voice_optimized": True,
                    }
                except Exception as e:
                    logger.error(f"PhaseLimiter failed: {e}. Continuing without mastering.")
                    results["stages"]["phaselimiter"] = {"error": str(e)}
                finally:
                    if pl_input and os.path.exists(pl_input): os.unlink(pl_input)
                    if pl_output and os.path.exists(pl_output): os.unlink(pl_output)

                update_progress("phaselimiter", 100)

            # Ensure correct channel count
            if final_audio.ndim == 1:
                final_audio = final_audio.reshape(1, -1)
            if self.target_channels == 2 and final_audio.shape[0] == 1:
                final_audio = np.vstack([final_audio[0], final_audio[0]])
            elif self.target_channels == 1 and final_audio.shape[0] == 2:
                final_audio = np.mean(final_audio, axis=0, keepdims=True)

            # ==============================================================
            # LOUDNESS SAFETY NET
            # ==============================================================
            if "phaselimiter" not in results.get("stages", {}) or \
               "error" in results.get("stages", {}).get("phaselimiter", {}):
                final_rms = np.sqrt(np.mean(final_audio ** 2))
                final_rms_db = 20 * np.log10(final_rms + 1e-10)
                target_rms_db = -16.0

                if final_rms_db < -24.0 and final_rms > 1e-10:
                    gain_db = min(target_rms_db - final_rms_db, 30.0)
                    gain_linear = 10 ** (gain_db / 20.0)
                    final_audio *= gain_linear
                    peak = np.max(np.abs(final_audio))
                    if peak > 0.98:
                        final_audio = np.tanh(final_audio / 0.98) * 0.98
                    new_rms_db = 20 * np.log10(np.sqrt(np.mean(final_audio ** 2)) + 1e-10)
                    print(f"LOUDNESS SAFETY: Boosted {final_rms_db:.1f}dB → {new_rms_db:.1f}dB")
                    results["stages"]["loudness_safety"] = {
                        "applied": True,
                        "input_rms_db": round(final_rms_db, 1),
                        "output_rms_db": round(new_rms_db, 1),
                        "gain_db": round(gain_db, 1),
                    }

            # ==============================================================
            # STAGE 10 — EXPORT (original_name-voxis.format)
            # ==============================================================
            update_progress("export", 0)

            # Peak-normalize to prevent clipping
            max_val = np.max(np.abs(final_audio))
            if max_val > 0.99:
                final_audio *= (0.99 / max_val)

            update_progress("export", 30, {"message": f"Writing {voxis_output_name}"})

            sf.write(voxis_output_path, final_audio.T, final_sr, subtype="PCM_24")

            if voxis_output_path != output_path:
                shutil.copy2(voxis_output_path, output_path)

            output_size = os.path.getsize(voxis_output_path)

            results["output_metadata"] = {
                "sample_rate": final_sr,
                "channels": final_audio.shape[0],
                "duration": round(final_audio.shape[1] / final_sr, 3),
                "samples": final_audio.shape[1],
                "bit_depth": 24,
                "format": "WAV",
                "output_name": voxis_output_name,
                "output_size_bytes": output_size,
            }

            results["success"] = True
            print(f"EXPORT: {voxis_output_name} | {final_sr}Hz | {final_audio.shape[0]}ch | {output_size/1024:.0f}KB")
            update_progress("export", 100)

            # Cleanup temp video extraction file
            if actual_input != input_path and os.path.exists(actual_input):
                try:
                    os.unlink(actual_input)
                except Exception:
                    pass

        except Exception as e:
            results["error"] = str(e)
            results["success"] = False
            import traceback
            results["traceback"] = traceback.format_exc()

        return results


def create_pipeline(config: Dict[str, Any]) -> VoxisPipeline:
    """Factory: create a VoxisPipeline from a config dict. Trinity v8.1 — voice-optimized."""
    return VoxisPipeline(
        denoise_strength=config.get("denoise_strength", 0.92),
        high_precision=config.get("high_precision", True),
        upscale_factor=config.get("upscale_factor", 2),
        target_sample_rate=config.get("target_sample_rate", 48000),
        target_channels=config.get("target_channels", 2),
        voicerestore_steps=config.get("voicerestore_steps", 32),
        voicerestore_cfg=config.get("voicerestore_cfg", 0.5),
        hp_freq=config.get("hp_freq", 80.0),
        lp_freq=config.get("lp_freq", 16000.0),
        amp_target_db=config.get("amp_target_db", -16.0),
        amp_threshold_db=config.get("amp_threshold_db", -26.0),
    )


PIPELINE_AVAILABLE = True
