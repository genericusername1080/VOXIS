export enum PipelineStep {
  IDLE = 'IDLE',
  STAGED = 'STAGED',
  UPLOAD = 'UPLOAD',
  INGEST = 'INGEST',
  ANALYSIS = 'ANALYSIS',
  DENOISE = 'DENOISE',
  DENSE = 'DENSE',
  RESTORE = 'RESTORE',
  UPSCALE = 'UPSCALE',
  EXPORT = 'EXPORT',
  COMPLETE = 'COMPLETE'
}

export interface AudioMetadata {
  name: string;
  size: number;
  duration: number;
  sampleRate: number;
  channels: number;
  format?: string;
}

export interface ProcessingConfig {
  denoiseStrength: number; // 0-100, default HIGH (92)
  highPrecision: boolean;
  upscaleFactor: number; // 1x, 2x, 4x — adjustable
  targetSampleRate: number; // 44100, 48000, 96000
  targetChannels: number; // 1 or 2 (default 2 — stereo)
  noiseProfile: 'auto' | 'aggressive' | 'gentle';
  outputFormat: ExportFormat; // wav, flac, mp3, aac
  voicerestoreSteps?: number; // 4-64
  voicerestoreCfg?: number; // 0.0-2.0
}

export type ExportFormat = 'wav' | 'flac' | 'mp3' | 'aac';

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

// Input source types for v4.0
export type InputSource = 'file' | 'recording' | 'video';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  level: number;
}
