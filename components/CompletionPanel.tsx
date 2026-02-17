import React from 'react';
import { ProcessingConfig } from '../types';
import { BauhausCard } from './BauhausCard';
import { BauhausButton } from './BauhausButton';

interface CompletionPanelProps {
  config: ProcessingConfig;
  downloadUrl: string | null;
  onReset: () => void;
}

export const CompletionPanel: React.FC<CompletionPanelProps> = ({ config, downloadUrl, onReset }) => {
  return (
    <BauhausCard className="w-full max-w-2xl text-center flex flex-col items-center p-12 bg-white">
      <div className="w-16 h-16 rounded-full bg-[var(--primary-green)] border-3 border-black flex items-center justify-center mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: '#00A651' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div className="text-3xl font-black uppercase tracking-tight mb-2">Restoration Complete</div>
      <div className="font-mono text-sm text-[var(--grey-600)] mb-10">
        {config.targetSampleRate / 1000}kHz / {config.targetChannels === 2 ? 'Stereo' : 'Mono'}
      </div>

      <div className="w-full max-w-md mb-10">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--grey-500)] mb-2">Export Format</div>
        <div className="flex border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {['wav', 'flac', 'mp3'].map((fmt, i) => (
            <a
              key={fmt}
              href={downloadUrl?.replace('/download/', '/export/') + `?format=${fmt}&quality=high`}
              download
              className={`flex-1 py-3 text-center font-bold uppercase text-sm hover:bg-black hover:text-[var(--primary-yellow)] transition-colors ${i < 2 ? 'border-r-2 border-black' : ''} ${fmt === 'wav' ? 'bg-[var(--primary-yellow)]' : 'bg-white'}`}
            >
              {fmt}
            </a>
          ))}
        </div>
        <div className="text-[10px] font-mono text-[var(--grey-400)] mt-2">
          High Quality Stream Ready
        </div>
      </div>

      <BauhausButton onClick={onReset} variant="secondary" className="w-full max-w-xs">
        Process Another File
      </BauhausButton>
    </BauhausCard>
  );
};
