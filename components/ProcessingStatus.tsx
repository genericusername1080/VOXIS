import React from 'react';
import { PipelineStep } from '../types';

interface ProcessingStatusProps {
  step: PipelineStep;
  stepName: string;
  progress: number;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step, stepName, progress }) => {
  const getDescription = () => {
    switch(step) {
      case PipelineStep.ANALYSIS: return 'Analyzing noise profile...';
      case PipelineStep.DENOISE: return 'Applying DeepFilterNet...';
      case PipelineStep.UPSCALE: return 'Upscaling with AudioSR...';
      case PipelineStep.UPLOAD: return 'Uploading source file...';
      case PipelineStep.INGEST: return 'Ingesting audio stream...';
      default: return 'Processing audio...';
    }
  };

  return (
    <div className="processing-zone">
      <div className="processing-bars">
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="processing-bar"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
      <div className="processing-stage">{stepName}</div>
      <div className="processing-desc">{getDescription()}</div>
      
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-text">{progress}%</div>

      <style>{`
        .processing-zone {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 48px; background: #fff;
          margin: 24px; border: 4px solid #000;
        }
        .processing-bars {
          display: flex; align-items: flex-end; gap: 4px;
          height: 100px; margin-bottom: 32px;
        }
        .processing-bar {
          width: 8px; background: #000;
          animation: barPulse 0.6s ease-in-out infinite alternate;
        }
        .processing-stage {
          font-size: 14px; font-weight: 900;
          text-transform: uppercase; letter-spacing: 4px;
          color: #ff3300; margin-bottom: 8px;
        }
        .processing-desc {
          font-size: 12px; color: #666;
          font-family: 'JetBrains Mono', monospace;
        }
        .progress-bar-container {
          width: 100%; max-width: 400px; height: 32px;
          background: #eee; border: 3px solid #000; margin-top: 32px;
        }
        .progress-bar-fill {
          height: 100%; background: #000; transition: width 0.3s;
        }
        .progress-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px; font-weight: 700; margin-top: 8px;
        }
      `}</style>
    </div>
  );
};
