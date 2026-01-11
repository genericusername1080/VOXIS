import React from 'react';
import { ProcessingConfig } from '../types';

interface CompletionPanelProps {
  config: ProcessingConfig;
  downloadUrl: string | null;
  onReset: () => void;
}

export const CompletionPanel: React.FC<CompletionPanelProps> = ({ config, downloadUrl, onReset }) => {
  return (
    <div className="complete-zone">
      <div className="complete-icon">✓</div>
      <div className="complete-title">Restoration Complete</div>
      <div className="complete-subtitle">
        {config.targetSampleRate / 1000}kHz • {config.targetChannels === 2 ? 'Stereo' : 'Mono'} • 24-bit
      </div>
      
      {/* Export Format Selection */}
      <div className="export-section">
        <div className="export-title">EXPORT FORMAT</div>
        <div className="btn-group">
          {['wav', 'flac', 'mp3'].map(fmt => (
            <a
              key={fmt}
              href={downloadUrl?.replace('/download/', '/export/') + `?format=${fmt}&quality=high`}
              download
              className={`btn-option ${fmt === 'wav' ? 'wav-btn' : ''}`}
            >
              {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      </div>
      
      <div className="format-info">
        WAV: Uncompressed • FLAC: Lossless • MP3: 320kbps
      </div>
      
      <button className="reset-btn" onClick={onReset}>
        Process Another File
      </button>

      <style>{`
        .complete-zone {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 48px; background: #fff;
          margin: 24px; border: 4px solid #000;
        }
        .complete-icon { font-size: 80px; margin-bottom: 24px; }
        .complete-title {
          font-size: 32px; font-weight: 900;
          text-transform: uppercase; letter-spacing: 4px;
          margin-bottom: 8px;
        }
        .complete-subtitle {
          font-size: 12px; color: #666;
          font-family: 'JetBrains Mono', monospace; margin-bottom: 32px;
        }
        .export-section { marginBottom: 24; textAlign: 'center'; }
        .export-title {
          fontSize: 10px; fontWeight: 700; letterSpacing: 2;
          marginBottom: 12px; color: #666;
        }
        .btn-group { display: flex; border: 3px solid #000; maxWidth: 300px; margin: 0 auto; }
        .btn-option {
          flex: 1; padding: 14px 20px; text-decoration: none;
          background: #fff; color: #000; border-right: 3px solid #000;
          font-family: 'JetBrains Mono'; font-weight: 700; font-size: 12px;
          transition: all 0.1s; text-align: center;
        }
        .btn-option:last-child { border-right: none; }
        .btn-option:hover { background: #000; color: #fff; }
        .wav-btn { background: #ff3300; color: #fff; }
        .format-info {
          fontSize: 10px; color: #999; margin-bottom: 24px;
          font-family: 'JetBrains Mono'; margin-top: 12px;
        }
        .reset-btn {
          margin-top: 16px; font-size: 12px; text-decoration: underline;
          cursor: pointer; color: #666; border: none; background: none;
        }
        .reset-btn:hover { color: #000; }
      `}</style>
    </div>
  );
};
