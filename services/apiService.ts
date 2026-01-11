/**
 * VOXIS API Service
 * Powered by Trinity | Built by Glass Stone
 * 
 * Client-side service for communicating with the Python backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

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

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check backend health
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error('Backend health check failed');
    }
    return response.json();
  }

  /**
   * Upload an audio file
   */
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.open('POST', `${this.baseUrl}/api/upload`);
      xhr.send(formData);
    });
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
    }
  ): Promise<ProcessResponse> {
    const response = await fetch(`${this.baseUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        denoise_strength: config.denoiseStrength,
        high_precision: config.highPrecision,
        upscale_factor: config.upscaleFactor,
        target_sample_rate: config.targetSampleRate,
        target_channels: config.targetChannels || 2,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to start processing');
    }
    return data;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${this.baseUrl}/api/status/${jobId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get job status');
    }
    return data;
  }

  /**
   * Poll job status until complete or error
   */
  async pollJobStatus(
    jobId: string,
    onUpdate: (status: JobStatus) => void,
    intervalMs: number = 500
  ): Promise<JobStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          onUpdate(status);

          if (status.status === 'complete') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
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
   * Download processed file
   */
  async downloadFile(jobId: string): Promise<Blob> {
    const response = await fetch(this.getDownloadUrl(jobId));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Download failed');
    }
    return response.blob();
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
