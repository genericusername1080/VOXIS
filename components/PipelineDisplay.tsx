import React from 'react';
import { PipelineStep } from '../types';

interface PipelineDisplayProps {
  currentStep: PipelineStep;
  steps: { id: PipelineStep; label: string; name: string }[];
}

export const PipelineDisplay: React.FC<PipelineDisplayProps> = ({ currentStep, steps }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="pipeline">
      {steps.map((s, i) => (
        <div
          key={s.id}
          className={`pipeline-step ${
            currentStep === s.id ? 'active' :
            currentIndex > i ? 'complete' :
            currentStep !== PipelineStep.IDLE && currentIndex < i ? 'inactive' : ''
          }`}
        >
          <div className="step-number">{s.label}</div>
          <div className="step-name">{s.name}</div>
        </div>
      ))}

      <style>{`
        .pipeline {
          display: flex;
          border-bottom: 4px solid #000;
          background: #fff;
        }
        .pipeline-step {
          flex: 1;
          padding: 16px;
          text-align: center;
          border-right: 3px solid #000;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.2s;
        }
        .pipeline-step:last-child { border-right: none; }
        .pipeline-step.active { background: #ff3300; color: #fff; }
        .pipeline-step.complete { background: #000; color: #fff; }
        .pipeline-step.inactive { color: #ccc; }
        .step-number { font-size: 24px; font-weight: 900; }
        .step-name { font-size: 10px; letter-spacing: 1px; margin-top: 4px; }
      `}</style>
    </div>
  );
};
