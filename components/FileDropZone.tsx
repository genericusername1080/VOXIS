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
      <div className="drop-icon">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      
      <div className="drop-content">
        <h2 className="drop-title">Upload Your Audio</h2>
        <p className="drop-description">
          Drop your audio file here to begin the restoration process. 
          VOXIS will analyze, denoise, and enhance your audio using 
          advanced AI processing.
        </p>
        
        <div className="format-grid">
          <div className="format-item">
            <span className="format-ext">WAV</span>
            <span className="format-desc">Lossless</span>
          </div>
          <div className="format-item">
            <span className="format-ext">MP3</span>
            <span className="format-desc">Compressed</span>
          </div>
          <div className="format-item">
            <span className="format-ext">FLAC</span>
            <span className="format-desc">Hi-Res</span>
          </div>
          <div className="format-item">
            <span className="format-ext">M4A</span>
            <span className="format-desc">Apple</span>
          </div>
          <div className="format-item">
            <span className="format-ext">OGG</span>
            <span className="format-desc">Open</span>
          </div>
          <div className="format-item">
            <span className="format-ext">AIFF</span>
            <span className="format-desc">Pro</span>
          </div>
        </div>

        <button className="upload-btn">
          <span className="btn-icon">+</span>
          Select File
        </button>
        
        <p className="drop-hint">or drag and drop anywhere on this area</p>
      </div>
      
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
          background: linear-gradient(135deg, #fff 0%, #f8f8f8 100%);
          border: 4px dashed #ccc;
          margin: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(0,0,0,0.02) 10px,
            rgba(0,0,0,0.02) 20px
          );
          pointer-events: none;
        }
        
        .drop-zone:hover {
          border-color: #000;
          background: linear-gradient(135deg, #fff 0%, #f0f0f0 100%);
        }
        
        .drop-zone.dragging {
          background: linear-gradient(135deg, #fff5f3 0%, #ffeeee 100%);
          border-color: #ff3300;
          border-style: solid;
          transform: scale(1.01);
        }
        
        .drop-icon {
          color: #ccc;
          margin-bottom: 32px;
          transition: all 0.3s ease;
        }
        
        .drop-zone:hover .drop-icon,
        .drop-zone.dragging .drop-icon {
          color: #ff3300;
          transform: translateY(-8px);
        }
        
        .drop-content {
          text-align: center;
          max-width: 480px;
          position: relative;
          z-index: 1;
        }
        
        .drop-title {
          font-size: 32px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0 0 16px 0;
          color: #000;
        }
        
        .drop-description {
          font-size: 14px;
          line-height: 1.7;
          color: #666;
          margin: 0 0 32px 0;
        }
        
        .format-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-bottom: 32px;
        }
        
        .format-item {
          background: #fff;
          border: 2px solid #eee;
          padding: 12px 8px;
          text-align: center;
          transition: all 0.2s;
        }
        
        .format-item:hover {
          border-color: #ff3300;
          transform: translateY(-2px);
        }
        
        .format-ext {
          display: block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          color: #000;
        }
        
        .format-desc {
          display: block;
          font-size: 9px;
          color: #999;
          margin-top: 4px;
        }
        
        .upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 20px 48px;
          background: #000;
          color: #fff;
          border: 4px solid #000;
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .upload-btn:hover {
          background: #ff3300;
          border-color: #ff3300;
        }
        
        .btn-icon {
          font-size: 20px;
          font-weight: 400;
        }
        
        .drop-hint {
          margin-top: 16px;
          font-size: 12px;
          color: #999;
        }
        
        @media (max-width: 768px) {
          .format-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          
          .drop-title {
            font-size: 24px;
          }
          
          .drop-zone {
            margin: 12px;
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
};
