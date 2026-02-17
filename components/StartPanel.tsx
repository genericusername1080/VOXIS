import React from 'react';
import { AudioMetadata, ProcessingConfig } from '../types';

interface StartPanelProps {
  metadata: AudioMetadata | null;
  config: ProcessingConfig;
  onStart: () => void;
  onCancel: () => void;
}

export const StartPanel: React.FC<StartPanelProps> = ({ metadata, config, onStart, onCancel }) => {
  const fmt = (b: number) => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
  return (
    <div className="start-panel">
      <div className="start-title">Ready</div>
      {metadata && (
        <div className="file-info">
          <div className="file-name">{metadata.name}</div>
          <div className="file-meta">{fmt(metadata.size)}</div>
        </div>
      )}
      <div className="config-summary">
        <div className="ci"><span className="cl">MODE</span><span className="cv">{config.mode.toUpperCase()}</span></div>
        <div className="ci"><span className="cl">DENOISE</span><span className="cv">{config.denoiseStrength}%</span></div>
        <div className="ci"><span className="cl">UPSCALE</span><span className="cv">{config.upscaleFactor}x</span></div>
        <div className="ci"><span className="cl">OUTPUT</span><span className="cv">{config.targetSampleRate/1000}k {config.targetChannels===2?'ST':'MO'}</span></div>
      </div>
      <button className="start-btn" onClick={onStart}>START PROCESSING</button>
      <button className="cancel-btn" onClick={onCancel}>Cancel</button>
      <style>{`
        .start-panel { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; background: #fff; margin: 20px; border: 3px solid #000; }
        .start-title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 20px; }
        .file-info { text-align: center; margin-bottom: 24px; padding: 12px 24px; background: #f7f7f7; border: 2px solid #000; }
        .file-name { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; word-break: break-all; }
        .file-meta { font-size: 11px; color: #666; margin-top: 2px; }
        .config-summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; justify-content: center; }
        .ci { display: flex; flex-direction: column; align-items: center; padding: 8px 16px; border: 2px solid #000; }
        .cl { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #666; }
        .cv { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: #ff3300; }
        .start-btn { padding: 16px 48px; background: #ff3300; color: #fff; border: 3px solid #000; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; transition: all 0.1s; }
        .start-btn:hover { background: #000; }
        .cancel-btn { margin-top: 12px; background: none; border: none; font-size: 11px; text-decoration: underline; cursor: pointer; color: #666; }
        @media (max-width: 768px) { .config-summary { flex-direction: column; gap: 8px; } .start-btn { padding: 14px 32px; font-size: 12px; } }
      `}</style>
    </div>
  );
};
