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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      className={`drop-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="drop-icon">↑</div>
      <div className="drop-title">Drop Audio File</div>
      <div className="drop-subtitle">WAV • MP3 • FLAC • OGG • M4A</div>
      <button className="upload-btn">Select File</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <style>{`
        .drop-zone {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: #fff;
          border: 4px dashed #ccc;
          margin: 24px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .drop-zone.dragging {
          background: #ffeeee;
          border-color: #ff3300;
        }
        .drop-icon { font-size: 64px; margin-bottom: 24px; }
        .drop-title {
          font-size: 24px; font-weight: 900;
          text-transform: uppercase; letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .drop-subtitle {
          font-size: 12px; color: #666;
          font-family: 'JetBrains Mono', monospace;
        }
        .upload-btn {
          margin-top: 24px; padding: 16px 48px;
          background: #000; color: #fff;
          border: 4px solid #000; font-size: 14px;
          font-weight: 900; text-transform: uppercase;
          letter-spacing: 2px; cursor: pointer;
          transition: all 0.1s;
        }
        .upload-btn:hover { background: #ff3300; }
      `}</style>
    </div>
  );
};
