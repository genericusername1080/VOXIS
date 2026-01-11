/**
 * VOXIS API Service v2.0 - Reliability Enhanced
 * Powered by Trinity | Built by Glass Stone
 * 
 * Features:
 * - Exponential backoff retry for transient failures
 * - Circuit breaker to prevent cascade failures
 * - Connection recovery with health monitoring
 * - Request timeout handling
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// =============================================================================
// RELIABILITY UTILITIES
// =============================================================================

/**
 * Retry configuration
 */
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
    // Retry on network errors or 5xx server errors
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('fetch') || msg.includes('503') || msg.includes('502');
  }
};

/**
 * Sleep utility
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryOn } = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      const shouldRetry = attempt < maxRetries && (!retryOn || retryOn(lastError));
      
      if (shouldRetry) {
        // Exponential backoff with jitter
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 100, maxDelayMs);
        console.warn(`[VOXIS] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, lastError.message);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should reset
    if (this.state === 'open' && Date.now() - this.lastFailure > this.resetTimeMs) {
      this.state = 'half-open';
    }
    
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open - service unavailable');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.error(`[VOXIS] Circuit breaker opened after ${this.failures} failures`);
    }
  }
  
  getState() {
    return this.state;
  }
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

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
  config: ProcessingConfig;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  results?: ProcessingResults;
}

export interface ProcessingConfig {
  denoise_strength: number;
  high_precision: boolean;
  upscale_factor: number;
  target_sample_rate: number;
  target_channels: number;
  noiseProfile: 'auto' | 'aggressive' | 'gentle';
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
// API SERVICE CLASS
// =============================================================================

class ApiService {
  private baseUrl: string;
  private circuitBreaker: CircuitBreaker;
  private isOnline: boolean = false;
  private reconnectAttempts: number = 0;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.circuitBreaker = new CircuitBreaker(5, 30000);
  }

  /**
   * Check backend health with retry
   */
  async healthCheck(): Promise<HealthResponse> {
    return this.circuitBreaker.execute(() =>
      withRetry(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/api/health`, {}, 5000);
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }
        this.isOnline = true;
        this.reconnectAttempts = 0;
        return response.json();
      })
    );
  }

  /**
   * Upload an audio file with retry and progress
   */
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
    return this.circuitBreaker.execute(() =>
      withRetry(async () => {
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);

          const xhr = new XMLHttpRequest();
          
          // Timeout handling
          xhr.timeout = 300000; // 5 minutes for large files
          xhr.ontimeout = () => reject(new Error('Upload timeout'));
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              try {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.error || `Upload failed: ${xhr.status}`));
              } catch {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
          xhr.open('POST', `${this.baseUrl}/api/upload`);
          xhr.send(formData);
        });
      }, { maxRetries: 2 }) // Fewer retries for uploads
    );
  }

  /**
   * Start audio processing job
   */
  async startProcessing(
    fileId: string,
    config: {
      denoiseStrength: number;
      highPrecision: boolean;
      upscaleFactor: number;
      targetSampleRate: number;
      targetChannels?: number;
      noiseProfile?: 'auto' | 'aggressive' | 'gentle';
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
          }),
        }, 10000);

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to start processing');
        }
        return data;
      })
    );
  }

  /**
   * Get job status with retry
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/status/${jobId}`, {}, 5000);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status');
      }
      return data;
    }, { maxRetries: 2 });
  }

  /**
   * Poll job status with resilient connection handling
   */
  async pollJobStatus(
    jobId: string,
    onUpdate: (status: JobStatus) => void,
    intervalMs: number = 500
  ): Promise<JobStatus> {
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          consecutiveErrors = 0; // Reset on success
          onUpdate(status);

          if (status.status === 'complete') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          consecutiveErrors++;
          console.warn(`[VOXIS] Poll error ${consecutiveErrors}/${maxConsecutiveErrors}:`, error);
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            reject(new Error('Lost connection to backend'));
          } else {
            // Exponential backoff on errors
            const backoffMs = Math.min(intervalMs * Math.pow(2, consecutiveErrors), 5000);
            setTimeout(poll, backoffMs);
          }
        }
      };

      poll();
    });
  }

  /**
   * Get download URL for processed file
   */
  getDownloadUrl(jobId: string): string {
    return `${this.baseUrl}/api/download/${jobId}`;
  }

  /**
   * Download processed file with retry
   */
  async downloadFile(jobId: string): Promise<Blob> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(this.getDownloadUrl(jobId), {}, 60000);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Download failed');
      }
      return response.blob();
    });
  }
  
  /**
   * Get connection status
   */
  getConnectionStatus(): { online: boolean; circuitState: string } {
    return {
      online: this.isOnline,
      circuitState: this.circuitBreaker.getState()
    };
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
