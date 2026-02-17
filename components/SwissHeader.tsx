import React from 'react';

interface SwissHeaderProps {
  status: 'online' | 'offline' | 'checking';
}

export const SwissHeader: React.FC<SwissHeaderProps> = ({ status }) => (
  <header className="swiss-header">
    <div className="header-left">
      <div className="swiss-logo">
        <span className="logo-v">V</span>
        <span className="logo-text">VOXIS</span>
        <span className="logo-num">4</span>
        <span className="logo-dense">DENSE</span>
      </div>
      <div className="tagline">// TRINITY 8.1</div>
    </div>

    <div className="header-center">
      <div className="feature-badges">
        <span className="badge">Dense Neural Filter</span>
        <span className="badge">Dense Separator</span>
        <span className="badge">Dense Upscaler</span>
      </div>
    </div>

    <div className="swiss-status">
      <div className={`status-indicator ${status}`}>
        <div className="status-dot" />
      </div>
      <div className="status-text">
        <span className="status-label">
          {status === 'online' ? 'ONLINE' :
           status === 'offline' ? 'OFFLINE' : 'CONNECTING'}
        </span>
      </div>
    </div>

    <style>{`
      .swiss-header {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 28px;
        border-bottom: 3px solid #000;
        background: #000;
        color: #fff;
        gap: 20px;
      }
      .header-left { display: flex; flex-direction: column; }
      .swiss-logo {
        display: flex; align-items: baseline; gap: 4px;
        font-weight: 900; line-height: 1;
      }
      .logo-v {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; border-radius: 50%;
        background: #8B0000; color: #fff; font-size: 16px;
        font-weight: 900; margin-right: 6px;
      }
      .logo-text { font-size: 24px; letter-spacing: -1px; }
      .logo-num { font-size: 24px; color: #8B0000; margin-left: 2px; }
      .logo-dense { font-size: 14px; letter-spacing: 3px; color: #888; margin-left: 8px; }
      .tagline {
        font-size: 9px; letter-spacing: 1.5px;
        text-transform: uppercase; color: #555; margin-top: 3px;
        font-family: 'JetBrains Mono', monospace;
      }
      .header-center { flex: 1; display: flex; justify-content: center; }
      .feature-badges { display: flex; gap: 6px; }
      .badge {
        padding: 4px 10px;
        border: 1px solid rgba(255,255,255,0.15);
        font-size: 9px; font-family: 'JetBrains Mono', monospace;
        letter-spacing: 0.5px; color: #777;
      }
      .swiss-status { display: flex; align-items: center; gap: 8px; }
      .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
      .status-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #ff3300;
      }
      .status-indicator.online .status-dot {
        background: #00cc66; animation: pulse 2s infinite;
      }
      .status-indicator.checking .status-dot {
        background: #ffaa00; animation: blink 1s infinite;
      }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
      .status-text { font-family: 'JetBrains Mono', monospace; }
      .status-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; }
      @media (max-width: 768px) {
        .header-center { display: none; }
        .swiss-logo { font-size: 22px; }
        .tagline { display: none; }
        .swiss-header { padding: 12px 16px; }
      }
    `}</style>
  </header>
);
