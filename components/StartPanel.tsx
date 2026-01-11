import React from 'react';
import { AudioMetadata, ProcessingConfig } from '../types';

interface StartPanelProps {
  metadata: AudioMetadata | null;
  config: ProcessingConfig;
  onStart: () => void;
  onCancel: () => void;
}

export const StartPanel: React.FC<StartPanelProps> = ({ metadata, config, onStart, onCancel }) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="start-panel">
      <div className="start-icon">▶</div>
      <div className="start-title">Ready to Process</div>
      
      {metadata && (
        <div className="file-info">
          <div className="file-name">{metadata.name}</div>
          <div className="file-meta">{formatSize(metadata.size)}</div>
        </div>
      )}
      
      <div className="config-summary">
        <div className="config-item">
          <span className="config-label">DENOISE</span>
          <span className="config-value">{config.denoiseStrength}%</span>
        </div>
        <div className="config-item">
          <span className="config-label">UPSCALE</span>
          <span className="config-value">{config.upscaleFactor}×</span>
        </div>
        <div className="config-item">
          <span className="config-label">OUTPUT</span>
          <span className="config-value">{config.targetSampleRate / 1000}kHz {config.targetChannels === 2 ? 'Stereo' : 'Mono'}</span>
        </div>
      </div>
      
      <button className="start-btn" onClick={onStart}>
        START PROCESSING
      </button>
      
      <button className="cancel-btn" onClick={onCancel}>
        Cancel
      </button>

      <style>{`
        .start-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: #fff;
          margin: 24px;
          border: 4px solid #000;
        }
        
        .start-icon {
          font-size: 64px;
          color: #ff3300;
          margin-bottom: 16px;
        }
        
        .start-title {
          font-size: 28px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 3px;
          margin-bottom: 24px;
        }
        
        .file-info {
          text-align: center;
          margin-bottom: 32px;
          padding: 16px 32px;
          background: #f5f5f5;
          border: 2px solid #000;
        }
        
        .file-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 4px;
          word-break: break-all;
        }
        
        .file-meta {
          font-size: 12px;
          color: #666;
        }
        
        .config-summary {
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
        }
        
        .config-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 24px;
          border: 2px solid #000;
        }
        
        .config-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #666;
          margin-bottom: 4px;
        }
        
        .config-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          font-weight: 700;
          color: #ff3300;
        }
        
        .start-btn {
          padding: 20px 64px;
          background: #ff3300;
          color: #fff;
          border: 4px solid #000;
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 3px;
          cursor: pointer;
          transition: all 0.1s;
        }
        
        .start-btn:hover {
          background: #000;
          color: #fff;
        }
        
        .cancel-btn {
          margin-top: 16px;
          background: none;
          border: none;
          font-size: 12px;
          text-decoration: underline;
          cursor: pointer;
          color: #666;
        }
        
        .cancel-btn:hover {
          color: #000;
        }
        
        @media (max-width: 768px) {
          .config-summary {
            flex-direction: column;
            gap: 12px;
          }
          
          .start-btn {
            padding: 16px 32px;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};
