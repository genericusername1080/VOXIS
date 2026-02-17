import React from 'react';
import { PipelineStep } from '../types';

interface ProcessingStatusProps {
  step: PipelineStep;
  stepName: string;
  progress: number;
}

const STEP_INFO: Record<string, { title: string; icon: string }> = {
  [PipelineStep.UPLOAD]: { title: 'Uploading', icon: '\u2191' },
  [PipelineStep.INGEST]: { title: 'Ingesting', icon: '\u25C9' },
  [PipelineStep.ANALYSIS]: { title: 'Dense Spectrum Analyzer', icon: '\u224B' },
  [PipelineStep.DENSE]: { title: 'Dense Source Separator', icon: '\u25A8' },
  [PipelineStep.DENOISE]: { title: 'Dense Neural Filter', icon: '\u25D0' },
  [PipelineStep.UPSCALE]: { title: 'Dense Diffusion Upscaler', icon: '\u25C6' },
  [PipelineStep.EXPORT]: { title: 'Dense Audio Encoder', icon: '\u2193' },
};

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step, stepName, progress }) => {
  const info = STEP_INFO[step] || { title: 'Processing', icon: '\u27F3' };

  return (
    <div className="processing-zone">
      <div className="processing-ring">
        <svg viewBox="0 0 100 100">
          <circle className="ring-bg" cx="50" cy="50" r="42" />
          <circle className="ring-progress" cx="50" cy="50" r="42"
            strokeDasharray={`${progress * 2.64} 264`} />
        </svg>
        <div className="ring-icon">{info.icon}</div>
      </div>

      <div className="processing-content">
        <div className="processing-stage">{info.title}</div>
        <div className="progress-row">
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-value">{progress}%</span>
        </div>
      </div>

      <style>{`
        .processing-zone {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 48px; background: #fff;
          margin: 20px; border: 3px solid #000;
        }
        .processing-ring { position: relative; width: 100px; height: 100px; margin-bottom: 28px; }
        .processing-ring svg { transform: rotate(-90deg); width: 100%; height: 100%; }
        .ring-bg { fill: none; stroke: #eee; stroke-width: 6; }
        .ring-progress { fill: none; stroke: #ff3300; stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray 0.3s; }
        .ring-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .processing-content { text-align: center; width: 100%; max-width: 360px; }
        .processing-stage { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #ff3300; margin-bottom: 16px; }
        .progress-row { display: flex; align-items: center; gap: 12px; }
        .progress-bar-container { flex: 1; height: 12px; background: #eee; border: 2px solid #000; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #000, #ff3300); transition: width 0.3s; }
        .progress-value { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; min-width: 36px; }
        @media (max-width: 768px) { .processing-zone { margin: 12px; padding: 32px 20px; } }
      `}</style>
    </div>
  );
};
