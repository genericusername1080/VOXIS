/**
 * VOXIS 4 Dense - Type Definitions
 * Powered by Trinity 8.1 | Built by Glass Stone
 * Copyright (c) 2026 Glass Stone. All rights reserved.
 */

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

export type ProcessingMode = 'quick' | 'standard' | 'extreme';

export interface AudioMetadata {
  name: string;
  size: number;
  duration: number;
  sampleRate: number;
  channels: number;
  format?: string;
}

export interface ProcessingConfig {
  mode: ProcessingMode;
  denoiseStrength: number;
  highPrecision: boolean;
  upscaleFactor: number;
  targetSampleRate: number;
  targetChannels: number;
  noiseProfile: 'auto' | 'aggressive' | 'gentle';
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

export type InputSource = 'file' | 'recording' | 'video';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  level: number;
}
