import React from 'react';
import { PipelineStep } from '../types';

interface PipelineDisplayProps {
  currentStep: PipelineStep;
  steps: { id: PipelineStep; label: string; name: string }[];
}

const STEP_DESCRIPTIONS: Record<string, string> = {
  'UPLOAD': 'Transferring your audio file to the processing server',
  'INGEST': 'Analyzing format, sample rate, and audio characteristics',
  'SPECTRUM': 'Mapping frequency distribution and noise patterns',
  'DENOISE': 'Removing background noise with DeepFilterNet AI',
  'UPSCALE': 'Enhancing quality using AudioSR neural network',
  'EXPORT': 'Encoding final high-quality audio file',
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
              currentStep !== PipelineStep.IDLE && currentIndex < i ? 'inactive' : ''
            }`}
          >
            <div className="step-indicator">
              {currentIndex > i ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <span className="step-number">{s.label}</span>
              )}
            </div>
            <div className="step-name">{s.name}</div>
            {currentStep === s.id && (
              <div className="step-progress">
                <div className="progress-dot" />
                <div className="progress-dot" />
                <div className="progress-dot" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {activeStep && STEP_DESCRIPTIONS[activeStep.name] && (
        <div className="pipeline-description">
          <span className="desc-label">Current:</span>
          <span className="desc-text">{STEP_DESCRIPTIONS[activeStep.name]}</span>
        </div>
      )}

      <style>{`
        .pipeline-wrapper {
          background: #fff;
          border-bottom: 4px solid #000;
        }
        
        .pipeline {
          display: flex;
          overflow-x: auto;
        }
        
        .pipeline-step {
          flex: 1;
          padding: 20px 16px;
          text-align: center;
          border-right: 3px solid #000;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.3s ease;
          min-width: 80px;
          position: relative;
        }
        
        .pipeline-step:last-child { border-right: none; }
        
        .pipeline-step.active {
          background: linear-gradient(180deg, #ff3300 0%, #cc2900 100%);
          color: #fff;
        }
        
        .pipeline-step.complete { 
          background: #000; 
          color: #fff;
        }
        
        .pipeline-step.inactive { 
          color: #ccc;
          background: #fafafa;
        }
        
        .step-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 32px;
        }
        
        .step-number {
          font-size: 24px;
          font-weight: 900;
        }
        
        .step-name {
          font-size: 11px;
          letter-spacing: 1px;
          margin-top: 4px;
          font-weight: 500;
        }
        
        .step-progress {
          display: flex;
          justify-content: center;
          gap: 4px;
          margin-top: 8px;
        }
        
        .progress-dot {
          width: 6px;
          height: 6px;
          background: rgba(255,255,255,0.5);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }
        
        .progress-dot:nth-child(1) { animation-delay: 0s; }
        .progress-dot:nth-child(2) { animation-delay: 0.2s; }
        .progress-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        
        .pipeline-description {
          padding: 12px 24px;
          background: #f5f5f5;
          border-top: 2px solid #eee;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .desc-label {
          font-weight: 700;
          color: #ff3300;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .desc-text {
          color: #666;
        }
        
        @media (max-width: 768px) {
          .step-name { display: none; }
          .step-number { font-size: 18px; }
          .pipeline-step { padding: 12px 8px; }
          .pipeline-description { 
            font-size: 11px;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};
