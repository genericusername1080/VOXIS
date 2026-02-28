import React from 'react';
import { AudioMetadata, ProcessingConfig } from '../types';
import { BauhausCard } from './BauhausCard';
import { BauhausButton } from './BauhausButton';

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
    <BauhausCard className="w-full max-w-2xl text-center bg-white p-12 animate-slide-up">
      <h2 className="text-3xl font-black uppercase tracking-widest mb-8">Ready to Process</h2>

      {metadata && (
        <div className="bg-[var(--bg-cream)] border-2 border-black p-4 mb-8 inline-block min-w-[300px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="font-bold text-lg mb-1">{metadata.name}</div>
          <div className="font-mono text-xs text-[var(--grey-600)]">{formatSize(metadata.size)} • {metadata.format?.toUpperCase()}</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 stagger-children">
        <ConfigItem label="ENGINE" value="TRINITY v8.1" />
        <ConfigItem label="DENOISE" value={`${config.denoiseStrength}%`} color="text-[var(--primary-red)]" />
        <ConfigItem label="UPSCALE" value={`${config.upscaleFactor}x`} />
        <ConfigItem label="OUTPUT" value={`${config.targetSampleRate / 1000}kHz`} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <BauhausButton onClick={onStart} variant="primary" className="w-64 text-lg">
          Start Processing
        </BauhausButton>

        <button
          className="text-xs font-bold uppercase tracking-widest text-[var(--grey-500)] hover:text-black hover:underline"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </BauhausCard>
  );
};

const ConfigItem = ({ label, value, color = "text-black" }: { label: string, value: string, color?: string }) => (
  <div className="border border-black p-3 bg-white">
    <div className="text-[9px] font-bold uppercase text-[var(--grey-500)] mb-1">{label}</div>
    <div className={`font-black uppercase text-sm ${color}`}>{value}</div>
  </div>
);
