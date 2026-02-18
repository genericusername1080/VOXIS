/**
 * VOXIS 4.0 DENSE Type Definitions
 * Powered by Trinity V8 | Built by Glass Stone LLC
 * Copyright (c) 2026 Glass Stone LLC. All rights reserved.
 * CEO: Gabriel.B.Rodriguez
 */

export enum PipelineStep {
  IDLE = 'IDLE',
  STAGED = 'STAGED',
  UPLOAD = 'UPLOAD',
  INGEST = 'INGEST',
  SEPARATION = 'SEPARATION',
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
  denoiseStrength: number;
  highPrecision: boolean;
  upscaleFactor: number;
  targetSampleRate: number;
  targetChannels: number;
  noiseProfile: 'auto' | 'aggressive' | 'gentle';
  mode: 'quick' | 'standard' | 'extreme';
}

export type VisualizerMode = 'WAVEFORM' | 'SPECTRUM' | 'SPECTROGRAM';

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
