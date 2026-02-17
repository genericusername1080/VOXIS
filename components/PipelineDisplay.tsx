import React from 'react';
import { PipelineStep } from '../types';

interface PipelineDisplayProps {
  currentStep: PipelineStep;
  steps: { id: PipelineStep; label: string; name: string }[];
}

export const PipelineDisplay: React.FC<PipelineDisplayProps> = ({ currentStep, steps }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex w-full border-2 border-black bg-white">
      {steps.map((s, i) => {
        const isActive = currentStep === s.id;
        const isDone = currentIndex > i;
        const isPending = currentStep !== PipelineStep.IDLE && currentIndex < i;

        let bgClass = 'bg-white';
        let textClass = 'text-[var(--grey-400)]';
        let borderClass = 'border-r-2 border-black';

        if (isActive) {
          bgClass = 'bg-[var(--primary-red)]';
          textClass = 'text-white';
        } else if (isDone) {
          bgClass = 'bg-black';
          textClass = 'text-[var(--primary-yellow)]';
        } else if (isPending) {
          bgClass = 'bg-[var(--bg-cream)]';
          textClass = 'text-[var(--grey-300)]';
        }

        if (i === steps.length - 1) borderClass = '';

        return (
          <div
            key={s.id}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-1 transition-all duration-200 ${bgClass} ${borderClass}`}
          >
            <span className={`text-xl font-black leading-none ${textClass}`}>{s.label}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 hidden md:block ${textClass} ${isActive ? 'opacity-90' : 'opacity-60'}`}>
              {s.name}
            </span>
          </div>
        );
      })}
    </div>
  );
};
