import React from 'react';

interface SwissFooterProps {
  logs: string[];
}

export const SwissFooter: React.FC<SwissFooterProps> = ({ logs }) => {
  return (
    <footer className="swiss-footer">
      <div className="log">
        {logs.slice(-4).map((log, i) => (
          <span key={i} className="log-entry">{log}</span>
        ))}
      </div>
      <div className="footer-brand">
        VOXIS v2.0 • DeepFilterNet • AudioSR • Yazdi9
      </div>
      
      <style>{`
        .swiss-footer {
          grid-column: 1 / -1;
          background: #000;
          color: #fff;
          padding: 16px 32px;
          border-top: 4px solid #000;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .log {
          display: flex; gap: 24px;
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
        }
        .log-entry { color: #ff3300; }
        .footer-brand { font-size: 10px; opacity: 0.5; }
      `}</style>
    </footer>
  );
};
