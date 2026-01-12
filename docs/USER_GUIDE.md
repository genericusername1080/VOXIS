# VOXIS User Guide
**Audio Restoration Manual**

## Getting Started

1.  **Open VOXIS**: Navigate to `http://localhost:5173`
2.  **Check Status**: Ensure the "SYSTEM ONLINE" light in the top right is green.

## Workflow

1.  **Drop & Stage**: Drag an audio file onto the drop zone or click **SELECT FILE**.
    - *Supported Formats*: WAV, MP3, FLAC, OGG, M4A, AAC.
2.  **Configure**: Adjust the settings in the left sidebar (Trinity Engine).
3.  **Start Processing**: Review the file info in the center panel and click the red **START PROCESSING** button.
4.  **Wait**: The pipeline progress (01-06) will update in real-time.
5.  **Audit**: Once complete, use the player to preview the result.
6.  **Export**: Click **DOWNLOAD** or select a format (FLAC/MP3) to save.

## Trinity Engine Settings

The sidebar controls the AI processing pipeline.

### 1. Denoise (DeepFilterNet)
- **Strength (Slider)**: 0% to 100%.
  - **75% (Default)**: Balanced noise reduction.
  - **100%**: Maximum removal, may affect speech slightly.
  - **<50%**: Light touch, preserves breathing/room tone.

### 2. Noise Profile
Selects the algorithm behavior for noise/signal separation.
- **AUTO**: Evaluates the audio and picks the best strategy. Recommended for 90% of cases.
- **AGGR (Aggressive)**: Hard gating. Great for isolating voice in very noisy environments (street, construction). Can sound robotic.
- **GENTLE**: Soft gate. Reduces hiss but keeps general ambience. Best for studio recordings with light hum.

### 3. Upscale (AudioSR)
Enhances low-quality or muffled audio.
- **1×**: Bypass. No upscaling.
- **2×**: Doubles perceived clarity. Good for standard restoration.
- **4×**: Maximum neural enhancement. Use for very low bitrate (old GSM/telephone) recordings. *Note: Slower processing.*

### 4. Sample Rate
- **44.1k**: CD Quality.
- **48k**: Video Standard (Default).
- **96k**: Studio Master resolution.

### 5. High Precision
- **ON**: Uses DeepFilterNet3's complex extraction model (Slower, better quality).
- **OFF**: Faster lightweight model.

### 6. Stereo Output
- **ON**: Exports 2-channel stereo.
- **OFF**: Exports mono (useful for single-mic voice recordings).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **"System Offline"** | Run `./run-local.sh` to restart the backend. |
| **"Upload Failed"** | Check file size is under 500MB and format is supported. |
| **"Start button disabled"** | Ensure a file is staged first. |
| **"Export Error"** | FFmpeg might be missing. Check server logs. |
