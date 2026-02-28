/**
 * VOXIS API Service v4.0.0
 * Powered by Trinity v8.1 | Built by Glass Stone
 *
 * Features:
 * - Exponential backoff retry
 * - Circuit breaker
 * - Request timeout handling
 * - v4.0.0: Recording upload, video file support, multi-format export
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn?: (error: Error) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryOn: (error) => {
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('fetch') || msg.includes('503') || msg.includes('502');
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, config: Partial<RetryConfig> = {}): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryOn } = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const shouldRetry = attempt < maxRetries && (!retryOn || retryOn(lastError));
      if (shouldRetry) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 100, maxDelayMs);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private threshold: number = 5, private resetTimeMs: number = 30000) { }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open' && Date.now() - this.lastFailure > this.resetTimeMs) {
      this.state = 'half-open';
    }
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open - service unavailable');
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) this.state = 'open';
      throw error;
    }
  }

  getState() { return this.state; }
}

// Type definitions
export interface UploadResponse {
  success: boolean;
  file_id: string;
  filename: string;
  size: number;
  duration: number;
  channels: number;
  samplerate: number;
  source?: 'audio' | 'video' | 'recording';
  uploaded_at: string;
  error?: string;
}

export interface ProcessResponse {
  success: boolean;
  job_id: string;
  status: string;
  message: string;
  error?: string;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  current_stage: string;
  progress: number;
  stages: Record<string, { progress: number; updated_at: string }>;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  results?: any;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  powered_by: string;
  built_by: string;
  timestamp: string;
}

class ApiService {
  private baseUrl: string;
  private circuitBreaker: CircuitBreaker;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.circuitBreaker = new CircuitBreaker(5, 30000);
  }

  async healthCheck(): Promise<HealthResponse> {
    return this.circuitBreaker.execute(() =>
      withRetry(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/api/health`, {}, 5000);
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
        return response.json();
      })
    );
  }

  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
    return this.circuitBreaker.execute(() =>
      withRetry(async () => {
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);
          const xhr = new XMLHttpRequest();
          xhr.timeout = 300000;
          xhr.ontimeout = () => reject(new Error('Upload timeout'));
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              try { reject(new Error(JSON.parse(xhr.responseText).error || `Upload failed: ${xhr.status}`)); }
              catch { reject(new Error(`Upload failed: ${xhr.status}`)); }
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
          xhr.open('POST', `${this.baseUrl}/api/upload`);
          xhr.send(formData);
        });
      }, { maxRetries: 2 })
    );
  }

  async uploadRecording(blob: Blob): Promise<UploadResponse> {
    return this.circuitBreaker.execute(() =>
      withRetry(async () => {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.wav');
        const response = await fetchWithTimeout(`${this.baseUrl}/api/upload/recording`, {
          method: 'POST',
          body: formData,
        }, 120000);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Recording upload failed');
        return data;
      })
    );
  }

  async startProcessing(
    fileId: string,
    config: {
      denoiseStrength: number;
      highPrecision: boolean;
      upscaleFactor: number;
      targetSampleRate: number;
      targetChannels?: number;
      noiseProfile?: 'auto' | 'aggressive' | 'gentle';
      voicerestoreSteps?: number;
      voicerestoreCfg?: number;
    }
  ): Promise<ProcessResponse> {
    return this.circuitBreaker.execute(() =>
      withRetry(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/api/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_id: fileId,
            denoise_strength: config.denoiseStrength,
            high_precision: config.highPrecision,
            upscale_factor: config.upscaleFactor,
            target_sample_rate: config.targetSampleRate,
            target_channels: config.targetChannels || 2,
            noise_profile: config.noiseProfile || 'auto',
            voicerestore_steps: config.voicerestoreSteps || 32,
            voicerestore_cfg: config.voicerestoreCfg || 0.5,
          }),
        }, 10000);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to start processing');
        return data;
      })
    );
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/status/${jobId}`, {}, 5000);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get job status');
      return data;
    }, { maxRetries: 2 });
  }

  async pollJobStatus(jobId: string, onUpdate: (status: JobStatus) => void, intervalMs: number = 500): Promise<JobStatus> {
    let consecutiveErrors = 0;
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          consecutiveErrors = 0;
          onUpdate(status);
          if (status.status === 'complete') resolve(status);
          else if (status.status === 'error') reject(new Error(status.error || 'Processing failed'));
          else setTimeout(poll, intervalMs);
        } catch (error) {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) reject(new Error('Lost connection to backend'));
          else setTimeout(poll, Math.min(intervalMs * Math.pow(2, consecutiveErrors), 5000));
        }
      };
      poll();
    });
  }

  getDownloadUrl(jobId: string): string {
    return `${this.baseUrl}/api/download/${jobId}`;
  }

  getExportUrl(jobId: string, format: string = 'wav', quality: string = 'high'): string {
    return `${this.baseUrl}/api/export/${jobId}?format=${format}&quality=${quality}`;
  }

  async downloadFile(jobId: string): Promise<Blob> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(this.getDownloadUrl(jobId), {}, 60000);
      if (!response.ok) throw new Error('Download failed');
      return response.blob();
    });
  }

  getConnectionStatus(): { online: boolean; circuitState: string } {
    return { online: true, circuitState: this.circuitBreaker.getState() };
  }
}

export const apiService = new ApiService();
export default apiService;
