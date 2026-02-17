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
  DENSE = 'DENSE',
  DENOISE = 'DENOISE',
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

