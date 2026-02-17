import React, { useRef } from 'react';

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
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`drop-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      onClick={() => ref.current?.click()}
    >
      <div className="drop-icon">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <h2 className="drop-title">Upload Audio</h2>
      <div className="format-grid">
        {['WAV','MP3','FLAC','M4A','OGG','MP4'].map(f => <span key={f} className="format-tag">{f}</span>)}
      </div>
      <button className="upload-btn">Select File</button>
      <p className="drop-hint">or drag and drop</p>
      <input ref={ref} type="file" accept="audio/*,video/mp4,video/quicktime"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
        style={{ display: 'none' }} />

      <style>{`
        .drop-zone { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; background: #fff; border: 3px dashed #ccc; margin: 20px; cursor: pointer; transition: all 0.2s; }
        .drop-zone:hover { border-color: #000; }
        .drop-zone.dragging { border-color: #ff3300; border-style: solid; background: #fff5f3; }
        .drop-icon { color: #ccc; margin-bottom: 20px; transition: color 0.2s; }
        .drop-zone:hover .drop-icon, .drop-zone.dragging .drop-icon { color: #ff3300; }
        .drop-title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px 0; }
        .format-grid { display: flex; gap: 6px; margin-bottom: 24px; flex-wrap: wrap; justify-content: center; }
        .format-tag { padding: 4px 10px; border: 2px solid #eee; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; }
        .upload-btn { padding: 14px 40px; background: #000; color: #fff; border: 3px solid #000; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; transition: all 0.1s; }
        .upload-btn:hover { background: #ff3300; border-color: #ff3300; }
        .drop-hint { margin-top: 10px; font-size: 11px; color: #999; }
        @media (max-width: 768px) { .drop-zone { margin: 12px; padding: 28px 20px; } .drop-title { font-size: 20px; } }
      `}</style>
    </div>
  );
};
