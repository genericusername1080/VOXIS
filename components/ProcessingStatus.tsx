import React from 'react';
import { PipelineStep } from '../types';

interface ProcessingStatusProps {
  step: PipelineStep;
  stepName: string;
  progress: number;
}

const STEP_INFO: Record<string, { title: string; description: string; icon: string }> = {
  [PipelineStep.UPLOAD]: {
    title: 'Uploading',
    description: 'Securely transferring your audio file to our processing server. Large files may take a moment.',
    icon: '↑'
  },
  [PipelineStep.INGEST]: {
    title: 'Ingesting',
    description: 'Reading audio format, extracting sample rate, bit depth, and channel configuration.',
    icon: '◉'
  },
  [PipelineStep.ANALYSIS]: {
    title: 'Spectrum Analysis',
    description: 'Mapping frequency response and identifying noise patterns using FFT analysis.',
    icon: '≋'
  },
  [PipelineStep.DENOISE]: {
    title: 'Neural Denoising',
    description: 'Applying DeepFilterNet AI to isolate voice and remove background interference.',
    icon: '◐'
  },
  [PipelineStep.UPSCALE]: {
    title: 'Audio Upscaling',
    description: 'Enhancing resolution with AudioSR neural network to restore high-frequency detail.',
    icon: '◆'
  },
};

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step, stepName, progress }) => {
  const info = STEP_INFO[step] || { 
    title: 'Processing', 
    description: 'Working on your audio...', 
    icon: '⟳' 
  };

  return (
    <div className="processing-zone">
      <div className="processing-visual">
        <div className="processing-ring">
          <svg viewBox="0 0 100 100">
            <circle className="ring-bg" cx="50" cy="50" r="45" />
            <circle 
              className="ring-progress" 
              cx="50" 
              cy="50" 
              r="45"
              strokeDasharray={`${progress * 2.83} 283`}
            />
          </svg>
          <div className="ring-icon">{info.icon}</div>
        </div>
        
        <div className="processing-bars">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="processing-bar"
              style={{ 
                animationDelay: `${i * 0.1}s`,
                opacity: 0.3 + (i / 8) * 0.7
              }}
            />
          ))}
        </div>
      </div>
      
      <div className="processing-content">
        <div className="processing-stage">{info.title}</div>
        <div className="processing-desc">{info.description}</div>
        
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">Progress</span>
            <span className="progress-value">{progress}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            <div className="progress-bar-glow" style={{ left: `${progress}%` }} />
          </div>
        </div>
        
        <div className="processing-tip">
          <span className="tip-label">TIP:</span>
          <span className="tip-text">
            {step === PipelineStep.DENOISE 
              ? 'Higher denoise settings work best for speech recordings.'
              : step === PipelineStep.UPSCALE
              ? 'Upscaling adds clarity but increases processing time.'
              : 'Processing time depends on file length and settings.'}
          </span>
        </div>
      </div>

      <style>{`
        .processing-zone {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: linear-gradient(180deg, #fff 0%, #f8f8f8 100%);
          margin: 24px;
          border: 4px solid #000;
        }
        
        .processing-visual {
          display: flex;
          align-items: center;
          gap: 48px;
          margin-bottom: 40px;
        }
        
        .processing-ring {
          position: relative;
          width: 120px;
          height: 120px;
        }
        
        .processing-ring svg {
          transform: rotate(-90deg);
          width: 100%;
          height: 100%;
        }
        
        .ring-bg {
          fill: none;
          stroke: #eee;
          stroke-width: 8;
        }
        
        .ring-progress {
          fill: none;
          stroke: #ff3300;
          stroke-width: 8;
          stroke-linecap: round;
          transition: stroke-dasharray 0.3s ease;
        }
        
        .ring-icon {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .processing-bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 80px;
        }
        
        .processing-bar {
          width: 10px;
          background: linear-gradient(180deg, #ff3300 0%, #000 100%);
          animation: barPulse 0.8s ease-in-out infinite alternate;
        }
        
        @keyframes barPulse {
          0% { height: 20px; }
          100% { height: 80px; }
        }
        
        .processing-content {
          text-align: center;
          max-width: 480px;
        }
        
        .processing-stage {
          font-size: 24px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 4px;
          color: #ff3300;
          margin-bottom: 12px;
        }
        
        .processing-desc {
          font-size: 14px;
          line-height: 1.6;
          color: #666;
          margin-bottom: 32px;
        }
        
        .progress-container {
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
        }
        
        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }
        
        .progress-label {
          color: #666;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .progress-value {
          font-weight: 700;
          color: #000;
        }
        
        .progress-bar-container {
          position: relative;
          width: 100%;
          height: 16px;
          background: #eee;
          border: 3px solid #000;
          overflow: hidden;
        }
        
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #000 0%, #ff3300 100%);
          transition: width 0.3s ease;
        }
        
        .progress-bar-glow {
          position: absolute;
          top: 0;
          width: 20px;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
          animation: glow 1.5s infinite;
        }
        
        @keyframes glow {
          0% { opacity: 0; transform: translateX(-20px); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateX(20px); }
        }
        
        .processing-tip {
          margin-top: 24px;
          padding: 12px 16px;
          background: #f0f0f0;
          border-left: 4px solid #ff3300;
          text-align: left;
          font-size: 12px;
        }
        
        .tip-label {
          font-weight: 700;
          color: #ff3300;
          margin-right: 8px;
        }
        
        .tip-text {
          color: #666;
        }
        
        @media (max-width: 768px) {
          .processing-visual {
            flex-direction: column;
            gap: 24px;
          }
          
          .processing-zone {
            margin: 12px;
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
};
