export enum PipelineStep {
  IDLE = 'IDLE',
  UPLOAD = 'UPLOAD',
  INGEST = 'INGEST',
  ANALYSIS = 'ANALYSIS',
  DENOISE = 'DENOISE',
  UPSCALE = 'UPSCALE',
  COMPLETE = 'COMPLETE'
}

export interface AudioMetadata {
  name: string;
  size: number;
  duration: number;
  sampleRate: number;
  channels: number;
}

export interface ProcessingConfig {
  denoiseStrength: number; // 0-100
  highPrecision: boolean; // DeepFilterNet High Precision Mode
  upscaleFactor: number; // 1x, 2x, 4x mapped to 1-3
  targetSampleRate: number;
}

export type VisualizerMode = 'WAVEFORM' | 'SPECTRUM';