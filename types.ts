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
  upscaleFactor: number; // 1x, 2x, 4x
  targetSampleRate: number;
  targetChannels: number; // 1 or 2
}

export type VisualizerMode = 'WAVEFORM' | 'SPECTRUM' | 'SPECTROGRAM';

export type ExportFormat = 'wav' | 'flac' | 'mp3';

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  noiseFloor: number;
  peakFrequency: number;
  dynamicRange: number;
}

export interface ProcessingStage {
  name: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  progress: number;
  startTime?: number;
  endTime?: number;
  metadata?: Record<string, string | number>;
}

export interface PipelineState {
  stages: ProcessingStage[];
  currentStageIndex: number;
  totalProgress: number;
  startTime: number | null;
  endTime: number | null;
}

export interface ExportConfig {
  format: ExportFormat;
  quality: 'low' | 'medium' | 'high';
  filename: string;
}