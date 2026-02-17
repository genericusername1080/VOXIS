import React from 'react';
import { PipelineStep } from '../types';

interface PipelineDisplayProps {
  currentStep: PipelineStep;
  steps: { id: PipelineStep; label: string; name: string }[];
}

const STEP_DESCRIPTIONS: Record<string, string> = {
  'UPLOAD': 'Transferring audio to processing server',
  'INGEST': 'Analyzing format, sample rate, and characteristics',
  'SPECTRUM': 'Dense Spectrum Analyzer — frequency mapping',
  'DENSE': 'Dense Source Separator — vocal isolation',
  'DENOISE': 'Dense Neural Filter — AI noise removal',
  'UPSCALE': 'Dense Diffusion Upscaler — neural super-resolution',
  'EXPORT': 'Dense Audio Encoder — final output',
};

export const PipelineDisplay: React.FC<PipelineDisplayProps> = ({ currentStep, steps }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const activeStep = steps.find(s => s.id === currentStep);

  return (
    <div className="pipeline-wrapper">
      <div className="pipeline">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`pipeline-step ${
              currentStep === s.id ? 'active' :
              currentIndex > i ? 'complete' :
              currentStep !== PipelineStep.IDLE && currentStep !== PipelineStep.STAGED && currentIndex < i ? 'inactive' : ''
            }`}
          >
            <div className="step-indicator">
              {currentIndex > i ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <span className="step-number">{s.label}</span>
              )}
            </div>
            <div className="step-name">{s.name}</div>
          </div>
        ))}
      </div>

      {activeStep && STEP_DESCRIPTIONS[activeStep.name] && (
        <div className="pipeline-description">
          <span className="desc-label">Active:</span>
          <span className="desc-text">{STEP_DESCRIPTIONS[activeStep.name]}</span>
        </div>
      )}

      <style>{`
        .pipeline-wrapper { background: #fff; border-bottom: 3px solid #000; }
        .pipeline { display: flex; overflow-x: auto; }
        .pipeline-step {
          flex: 1; padding: 14px 10px; text-align: center;
          border-right: 2px solid #000;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.2s; min-width: 60px;
        }
        .pipeline-step:last-child { border-right: none; }
        .pipeline-step.active { background: #ff3300; color: #fff; }
        .pipeline-step.complete { background: #000; color: #fff; }
        .pipeline-step.inactive { color: #ccc; background: #fafafa; }
        .step-indicator {
          display: flex; align-items: center; justify-content: center; height: 24px;
        }
        .step-number { font-size: 18px; font-weight: 900; }
        .step-name { font-size: 9px; letter-spacing: 0.5px; margin-top: 2px; font-weight: 600; }
        .pipeline-description {
          padding: 8px 20px; background: #f7f7f7;
          border-top: 1px solid #eee; font-size: 11px;
          display: flex; align-items: center; gap: 8px;
        }
        .desc-label {
          font-weight: 700; color: #ff3300;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 1px; font-size: 9px;
        }
        .desc-text { color: #888; }
        @media (max-width: 768px) {
          .step-name { display: none; }
          .step-number { font-size: 14px; }
          .pipeline-step { padding: 10px 6px; }
        }
      `}</style>
    </div>
  );
};
