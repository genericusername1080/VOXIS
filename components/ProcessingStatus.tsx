import React from 'react';
import { PipelineStep } from '../types';
import { BauhausCard } from './BauhausCard';

interface ProcessingStatusProps {
  step: PipelineStep;
  stepName: string;
  progress: number;
}

const STEP_INFO: Record<string, { title: string; desc: string }> = {
  [PipelineStep.UPLOAD]: { title: 'Uploading', desc: 'Transferring file to processing server' },
  [PipelineStep.INGEST]: { title: 'Ingesting', desc: 'Decoding audio format and extracting metadata' },
  [PipelineStep.ANALYSIS]: { title: 'Spectrum Analysis', desc: 'FFT profiling and noise floor detection' },
  [PipelineStep.DENOISE]: { title: 'Denoising', desc: 'DeepFilterNet HIGH — removing background noise' },
  [PipelineStep.DENSE]: { title: 'Dense Separation', desc: 'VOXIS 4 Dense — vocal/instrument isolation via UVR5' },
  [PipelineStep.RESTORE]: { title: 'Restoring', desc: 'VoiceRestore transformer reconstruction' },
  [PipelineStep.UPSCALE]: { title: 'Upscaling', desc: 'AudioSR neural super-resolution to stereo' },
  [PipelineStep.EXPORT]: { title: 'Exporting', desc: 'Encoding final high-quality output' },
};

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step, stepName, progress }) => {
  const info = STEP_INFO[step] || { title: 'Processing', desc: 'Working...' };

  return (
    <BauhausCard className="w-full max-w-2xl bg-white flex flex-col items-center text-center p-12">
      <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-[var(--bg-cream)] border-4 border-black rotate-3"></div>
        <div className="absolute inset-0 bg-[var(--primary-blue)] border-4 border-black -rotate-2 opacity-20"></div>
        <div
          className="absolute bottom-0 left-0 bg-[var(--primary-red)] transition-all duration-300 border-t-4 border-black w-full"
          style={{ height: `${progress}%` }}
        ></div>
        <div className="absolute inset-0 border-4 border-black flex items-center justify-center z-10 bg-transparent">
          <span className="text-4xl font-black">{progress}%</span>
        </div>
      </div>

      <h2 className="text-3xl font-black uppercase tracking-tight text-[var(--primary-blue)] mb-2">
        {info.title}
      </h2>
      <p className="font-mono text-sm text-[var(--grey-700)] max-w-md">
        {info.desc}
      </p>
    </BauhausCard>
  );
};
