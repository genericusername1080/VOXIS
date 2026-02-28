import React from 'react';
import { PipelineStep } from '../types';
import { BauhausCard } from './BauhausCard';

interface ProcessingStatusProps {
  step: PipelineStep;
  stepName: string;
  progress: number;
}

const STEP_INFO: Record<string, { title: string; desc: string }> = {
  [PipelineStep.UPLOAD]: { title: 'Asset Reception', desc: 'Secure uplink to Trinity Core // Ingest Protocol' },
  [PipelineStep.INGEST]: { title: 'Opaque Analysis', desc: ' decoding bitstream // spectral extraction ' },
  [PipelineStep.ANALYSIS]: { title: 'Prism Audit', desc: 'Trinity Audit v8.1 // Noise Floor Profiling' },
  [PipelineStep.DENOISE]: { title: 'Polish Module', desc: 'Trinity Denoise // Surgical Subtraction Protocol' },
  [PipelineStep.DENSE]: { title: 'Fracture Engine', desc: 'Trinity Spectral Isolation // Vocal Extraction' },
  [PipelineStep.RESTORE]: { title: 'Neural Reconstruction', desc: 'Trinity Generative Synthesis // Packet Recovery' },
  [PipelineStep.UPSCALE]: { title: 'Spatial Magnify', desc: 'Trinity Super-Resolution // Stereo Expansion' },
  [PipelineStep.EXPORT]: { title: 'Mastering Artifact', desc: 'Finalizing Output Container // High Fidelity' },
};

// Ordered stages for the progress track
const STAGE_ORDER = [
  PipelineStep.UPLOAD,
  PipelineStep.INGEST,
  PipelineStep.ANALYSIS,
  PipelineStep.DENOISE,
  PipelineStep.DENSE,
  PipelineStep.RESTORE,
  PipelineStep.UPSCALE,
  PipelineStep.EXPORT,
];

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step, stepName, progress }) => {
  const info = STEP_INFO[step] || { title: 'Processing', desc: 'Working...' };
  const currentIdx = STAGE_ORDER.indexOf(step);

  return (
    <BauhausCard className="w-full max-w-2xl bg-white flex flex-col items-center text-center p-10 animate-scale-in">
      {/* Geometric Spinner + Percentage */}
      <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
        <div className="absolute inset-0 bg-[var(--bg-cream)] border-4 border-black animate-[spin_10s_linear_infinite]"></div>
        <div className="absolute inset-0 bg-[var(--primary-blue)] border-4 border-black opacity-20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
        <div
          className="absolute bottom-0 left-0 bg-[var(--primary-red)] transition-all duration-500 border-t-4 border-black w-full"
          style={{ height: `${progress}%` }}
        ></div>
        <div className="absolute inset-0 border-4 border-black flex items-center justify-center z-10">
          <span className="text-3xl font-black">{progress}%</span>
        </div>
      </div>

      {/* Current Stage Title */}
      <h2 className="text-2xl font-black uppercase tracking-tight text-[var(--primary-blue)] mb-1">
        {info.title}
      </h2>
      <p className="font-mono text-xs text-[var(--grey-700)] mb-8 max-w-md">
        {info.desc}
      </p>

      {/* Linear Progress Bar */}
      <div className="w-full max-w-lg mb-3">
        <div className="w-full h-3 bg-[var(--bg-cream)] border-2 border-black overflow-hidden">
          <div
            className="h-full bg-[var(--primary-red)] animate-progress-stripes transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage Track */}
      <div className="w-full max-w-lg flex justify-between stagger-children">
        {STAGE_ORDER.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const stepInfo = STEP_INFO[s];
          const label = stepInfo?.title?.split(' ')[0] || '';
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 border-2 border-black transition-colors duration-300 ${done ? 'bg-[#00A651]' : active ? 'bg-[var(--primary-red)] animate-pulse' : 'bg-white'
                  }`}
              />
              <span className={`text-[8px] font-bold uppercase tracking-wider ${active ? 'text-[var(--primary-red)]' : done ? 'text-[#00A651]' : 'text-[var(--grey-400)]'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </BauhausCard>
  );
};
