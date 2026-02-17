import React from 'react';
import { ProcessingConfig } from '../types';

interface CompletionPanelProps {
  config: ProcessingConfig;
  downloadUrl: string | null;
  onReset: () => void;
}

export const CompletionPanel: React.FC<CompletionPanelProps> = ({ config, downloadUrl, onReset }) => (
  <div className="complete-zone">
    <div className="complete-check">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff3300" strokeWidth="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div className="complete-title">Complete</div>
    <div className="complete-sub">
      {config.targetSampleRate/1000}kHz &middot; {config.targetChannels===2?'Stereo':'Mono'} &middot; 24-bit
    </div>
    <div className="export-group">
      {['wav','flac','mp3'].map(f => (
        <a key={f} href={downloadUrl?.replace('/download/','/export/')+`?format=${f}&quality=high`}
           download className={`export-btn ${f==='wav'?'primary':''}`}>{f.toUpperCase()}</a>
      ))}
    </div>
    <button className="reset-btn" onClick={onReset}>Process Another</button>
    <style>{`
      .complete-zone { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; background: #fff; margin: 20px; border: 3px solid #000; }
      .complete-check { margin-bottom: 16px; }
      .complete-title { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px; }
      .complete-sub { font-size: 11px; color: #666; font-family: 'JetBrains Mono', monospace; margin-bottom: 28px; }
      .export-group { display: flex; border: 2px solid #000; margin-bottom: 20px; }
      .export-btn { padding: 12px 24px; text-decoration: none; background: #fff; color: #000; border-right: 2px solid #000; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 12px; transition: all 0.1s; text-align: center; }
      .export-btn:last-child { border-right: none; }
      .export-btn:hover { background: #000; color: #fff; }
      .export-btn.primary { background: #ff3300; color: #fff; }
      .reset-btn { background: none; border: none; font-size: 11px; text-decoration: underline; cursor: pointer; color: #666; }
    `}</style>
  </div>
);
