import React from 'react';

interface OfflineBannerProps {
  isOnline: boolean;
  isBackendReachable: boolean;
  reconnectAttempts: number;
  onRetry: () => void;
  queueLength: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ 
  isOnline, 
  isBackendReachable, 
  reconnectAttempts,
  onRetry,
  queueLength
}) => {
  // Fully online - don't show banner
  if (isOnline && isBackendReachable) {
    return null;
  }
  
  const getMessage = () => {
    if (!isOnline) {
      return 'No internet connection';
    }
    if (!isBackendReachable) {
      return reconnectAttempts > 3 
        ? 'Backend unreachable - check if server is running'
        : 'Connecting to backend...';
    }
    return 'Connection issue';
  };
  
  return (
    <div className="offline-banner">
      <div className="offline-content">
        <span className="offline-icon">⚠</span>
        <span className="offline-message">{getMessage()}</span>
        {queueLength > 0 && (
          <span className="offline-queue">{queueLength} pending</span>
        )}
        <button className="offline-retry" onClick={onRetry}>
          Retry
        </button>
      </div>
      
      <style>{`
        .offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: ${!isOnline ? '#ff3300' : '#ffaa00'};
          color: ${!isOnline ? '#fff' : '#000'};
          padding: 12px 24px;
          animation: slideDown 0.3s ease-out;
        }
        
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        
        .offline-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
        }
        
        .offline-icon {
          font-size: 16px;
        }
        
        .offline-message {
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .offline-queue {
          background: rgba(0,0,0,0.2);
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .offline-retry {
          background: ${!isOnline ? '#fff' : '#000'};
          color: ${!isOnline ? '#ff3300' : '#fff'};
          border: 2px solid #000;
          padding: 6px 16px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.1s;
        }
        
        .offline-retry:hover {
          opacity: 0.8;
        }
        
        @media (max-width: 768px) {
          .offline-content {
            flex-wrap: wrap;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
};
