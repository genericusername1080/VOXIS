**Version: 1.0.5**

Base URL: `http://localhost:5001` (Local)

## General Info

- **Content-Type**: `application/json` (except /upload)
- **Rate Limiting**: 30 requests / 60 seconds per IP
- **Health Check**: `/api/health`

---

## Endpoints

### 1. System Health

**GET** `/api/health`

Returns system status and resource usage.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "VOXIS Backend",
  "version": "1.0.5",
  "active_jobs": 0,
  "disk": {
    "free_gb": 25.4,
    "percent_used": 95.0
  }
}
```

### 2. Upload Audio

**POST** `/api/upload`

Upload a raw audio file for processing.

- **Body**: `multipart/form-data`
  - `file`: (Required) Audio file (wav, mp3, flac, ogg, m4a)

**Response (200 OK):**
```json
{
  "success": true,
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "recording.wav",
  "size": 1048576,
  "uploaded_at": "2026-01-11T12:00:00Z"
}
```

### 3. Start Processing

**POST** `/api/process`

Initiate a processing job for an uploaded file.

**Body (JSON):**
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "denoise_strength": 75,      // 0-100
  "high_precision": true,      // boolean
  "upscale_factor": 2,         // 1, 2, or 4
  "target_sample_rate": 48000, // 44100, 48000, 96000
  "target_channels": 2,        // 1 (Mono) or 2 (Stereo)
  "noise_profile": "auto"      // "auto", "aggressive", "gentle"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "job_id": "770e8400-e29b-41d4-a716-889955440000",
  "status": "queued",
  "message": "Processing started"
}
```

### 4. Get Job Status

**GET** `/api/status/<job_id>`

Poll this endpoint to track progress.

**Response (200 OK):**
```json
{
  "job_id": "770e8400-e29b-41d4-a716-889955440000",
  "status": "processing",      // "queued", "processing", "complete", "error"
  "current_stage": "denoise",  // "upload", "ingest", "spectrum", "denoise", "upscale"
  "progress": 45,              // 0-100 integer
  "stages": {
    "ingest": { "progress": 100, "updated_at": "..." },
    "denoise": { "progress": 20, "updated_at": "..." }
  }
}
```

### 5. Export / Download

**GET** `/api/export/<job_id>`

Download the final processed audio in a specific format.

**Query Parameters:**
- `format`: `wav` (default), `mp3`, `flac`
- `quality`: `low`, `medium`, `high` (applies to MP3 bitrate)

**Example:**
`/api/export/770e...?format=mp3&quality=high`

**Response (200 OK):**
- Binary file stream (audio/wav, audio/mpeg, audio/flac)

### 6. List Jobs

**GET** `/api/jobs`

List recent jobs (stats/admin use).

**Query Parameters:**
- `limit`: Number of jobs to return (default 50)
- `status`: Filter by status (e.g. `complete`)

---

## Error Codes

- **400**: Bad Request (Invalid parameters, file missing)
- **404**: Resource Not Found (Job ID or File ID invalid)
- **413**: Payload Too Large (File exceeds upload limit)
- **429**: Rate Limit Exceeded
- **500**: Internal Server Error / Processing Failed
- **503**: Service Unavailable (Circuit breaker open)
