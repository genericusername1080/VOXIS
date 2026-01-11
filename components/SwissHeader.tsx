import React from 'react';

interface SwissHeaderProps {
  status: 'online' | 'offline' | 'checking';
}

export const SwissHeader: React.FC<SwissHeaderProps> = ({ status }) => (
  <header className="swiss-header">
    <div className="swiss-logo">
      VOXIS<span>.</span>
    </div>
    <div className="swiss-status">
      <div className={`status-dot ${status}`} />
      <span>{status === 'online' ? 'SYSTEM ONLINE' : status === 'offline' ? 'OFFLINE' : 'CONNECTING...'}</span>
    </div>
    
    <style>{`
      .swiss-header {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 32px;
        border-bottom: 4px solid #000;
        background: #000;
        color: #fff;
      }
      .swiss-logo {
        font-size: 48px;
        font-weight: 900;
        letter-spacing: -3px;
        line-height: 1;
      }
      .swiss-logo span { color: #ff3300; }
      .swiss-status {
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
      }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ff3300;
      }
      .status-dot.online { background: #00ff00; }
    `}</style>
  </header>
);
