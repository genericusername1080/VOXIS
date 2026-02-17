import React from 'react';

interface SwissFooterProps {
  logs: string[];
}

export const SwissFooter: React.FC<SwissFooterProps> = ({ logs }) => {
  const year = new Date().getFullYear();
  return (
    <footer className="swiss-footer">
      <div className="log">
        {logs.slice(-4).map((log, i) => (
          <span key={i} className="log-entry">{log}</span>
        ))}
      </div>
      <div className="footer-brand">
        VOXIS 4 Dense &copy; {year} Glass Stone
      </div>

      <style>{`
        .swiss-footer {
          grid-column: 1 / -1;
          background: #000; color: #fff;
          padding: 10px 28px;
          border-top: 3px solid #000;
          display: flex; justify-content: space-between; align-items: center;
        }
        .log {
          display: flex; gap: 16px;
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
        }
        .log-entry { color: #ff3300; }
        .footer-brand {
          font-size: 9px; opacity: 0.4;
          font-family: 'JetBrains Mono', monospace;
        }
        @media (max-width: 768px) {
          .swiss-footer {
            flex-direction: column; gap: 8px; text-align: center;
            padding: 12px 16px;
          }
        }
      `}</style>
    </footer>
  );
};
