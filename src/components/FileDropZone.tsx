import React, { useRef } from 'react';
import { BauhausCard } from './BauhausCard';
import { BauhausButton } from './BauhausButton';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileSelect, isDragging, onDragOver, onDragLeave, onDrop
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center p-8"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <BauhausCard
        className={`w-full max-w-2xl min-h-[400px] flex flex-col items-center justify-center text-center animate-scale-in transition-all duration-300 ${isDragging ? 'scale-105 rotate-1 animate-glow' : ''}`}
        color={isDragging ? 'yellow' : 'white'}
      >
        <div className={`w-24 h-24 mb-8 border-4 border-black rounded-full flex items-center justify-center animate-float ${isDragging ? 'bg-[var(--primary-red)]' : 'bg-[var(--primary-blue)]'}`}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <h2 className="text-4xl font-black uppercase tracking-tight mb-4">
          Drop Audio
        </h2>
        <p className="font-mono text-sm text-[var(--grey-700)] mb-8 max-w-md">
          Drag and drop your audio or video files here to begin the dense restoration process.
        </p>

        <div className="flex gap-2 mb-10 flex-wrap justify-center stagger-children">
          {['WAV', 'MP3', 'FLAC', 'M4A', 'MP4', 'MOV'].map(fmt => (
            <span key={fmt} className="px-2 py-1 border border-black font-mono text-xs font-bold bg-[var(--bg-cream)]">
              {fmt}
            </span>
          ))}
        </div>

        <BauhausButton
          onClick={() => fileInputRef.current?.click()}
          variant="primary"
          icon={<span>+</span>}
        >
          Select File
        </BauhausButton>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,video/quicktime,audio/mp4,audio/x-m4a"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </BauhausCard>
    </div>
  );
};
