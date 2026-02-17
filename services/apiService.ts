/**
 * VOXIS 3.2 Dense — API Service
 * Powered by Trinity v7 | Built by Glass Stone
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// Retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastErr: Error = new Error('Unknown');
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (i < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, i) + Math.random() * 100, 5000);
        console.warn(`[VOXIS] Retry ${i + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// Type definitions
export interface UploadResponse {
  success: boolean;
  file_id: string;
  filename: string;
  filepath: string;
  size: number;
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
  config: Record<string, any>;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  results?: ProcessingResults;
}

export interface ProcessingResults {
  input_file: string;
  output_file: string;
  success: boolean;
  input_metadata?: {
    sample_rate: number;
    channels: number;
    duration: number;
    samples: number;
  };
  output_metadata?: {
    sample_rate: number;
    channels: number;
    duration: number;
    samples: number;
    bit_depth: number;
    format: string;
  };
  stages: Record<string, any>;
  error?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  powered_by: string;
  built_by: string;
  timestamp: string;
}

// =============================================================================
// API SERVICE
// =============================================================================

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Health check
  async healthCheck(): Promise<HealthResponse> {
    return withRetry(async () => {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/health`, {}, 5000);
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      return res.json();
    });
  }

  // Upload file
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
    return withRetry(async () => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.timeout = 300000;
        xhr.ontimeout = () => reject(new Error('Upload timeout'));

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.open('POST', `${this.baseUrl}/api/upload`);
        xhr.send(formData);
      });
    }, 2);
  }

  // Start processing with mode support
  async startProcessing(
    fileId: string,
    config: {
      mode: 'standard' | 'extreme';
      denoiseStrength: number;
      highPrecision: boolean;
      upscaleFactor: number;
      targetSampleRate: number;
      targetChannels?: number;
      noiseProfile?: 'auto' | 'aggressive' | 'gentle';
    }
  ): Promise<ProcessResponse> {
    return withRetry(async () => {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          mode: config.mode,
          denoise_strength: config.denoiseStrength,
          high_precision: config.highPrecision,
          upscale_factor: config.upscaleFactor,
          target_sample_rate: config.targetSampleRate,
          target_channels: config.targetChannels || 2,
          noise_profile: config.noiseProfile || 'auto',
        }),
      }, 10000);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start processing');
      return data;
    });
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<JobStatus> {
    return withRetry(async () => {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/status/${jobId}`, {}, 5000);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get status');
      return data;
    }, 2);
  }

  // Poll job status
  async pollJobStatus(
    jobId: string,
    onUpdate: (status: JobStatus) => void,
    intervalMs: number = 500
  ): Promise<JobStatus> {
    let errors = 0;
    const maxErrors = 5;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          errors = 0;
          onUpdate(status);

          if (status.status === 'complete') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (err) {
          errors++;
          if (errors >= maxErrors) {
            reject(new Error('Lost connection to backend'));
          } else {
            setTimeout(poll, Math.min(intervalMs * Math.pow(2, errors), 5000));
          }
        }
      };
      poll();
    });
  }

  // Download URL
  getDownloadUrl(jobId: string): string {
    return `${this.baseUrl}/api/download/${jobId}`;
  }

  // Download file
  async downloadFile(jobId: string): Promise<Blob> {
    return withRetry(async () => {
      const res = await fetchWithTimeout(this.getDownloadUrl(jobId), {}, 60000);
      if (!res.ok) throw new Error('Download failed');
      return res.blob();
    });
  }
}

// Export singleton
export const apiService = new ApiService();
export default apiService;
