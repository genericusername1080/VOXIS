import React from 'react';

interface SwissHeaderProps {
  status: 'online' | 'offline' | 'checking';
}

export const SwissHeader: React.FC<SwissHeaderProps> = ({ status }) => (
  <header className="swiss-header">
    <div className="header-left">
      <div className="swiss-logo">
        VOXIS<span>.</span>
      </div>
      <div className="tagline">AI Audio Restoration</div>
    </div>
    
    <div className="header-center">
      <div className="feature-badges">
        <span className="badge">DeepFilterNet</span>
        <span className="badge">AudioSR</span>
        <span className="badge">Neural Processing</span>
      </div>
    </div>
    
    <div className="swiss-status">
      <div className={`status-indicator ${status}`}>
        <div className="status-dot" />
        <div className="status-ring" />
      </div>
      <div className="status-text">
        <span className="status-label">
          {status === 'online' ? 'SYSTEM ONLINE' : 
           status === 'offline' ? 'SYSTEM OFFLINE' : 'CONNECTING...'}
        </span>
        <span className="status-detail">
          {status === 'online' ? 'Ready to process' : 
           status === 'offline' ? 'Check connection' : 'Please wait'}
        </span>
      </div>
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
        gap: 24px;
        /* Electron Drag Region */
        -webkit-app-region: drag;
      }
      
      .header-left, .header-center, .swiss-status {
        /* Ensure content is clickable/selectable if needed */
        -webkit-app-region: no-drag;
      }
      
      .header-left {
        display: flex;
        flex-direction: column;
      }
      
      .swiss-logo {
        font-size: 48px;
        font-weight: 900;
        letter-spacing: -3px;
        line-height: 1;
      }
      
      .swiss-logo span { color: #ff3300; }
      
      .tagline {
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #666;
        margin-top: 4px;
      }
      
      .header-center {
        flex: 1;
        display: flex;
        justify-content: center;
      }
      
      .feature-badges {
        display: flex;
        gap: 8px;
      }
      
      .badge {
        padding: 6px 12px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        font-size: 10px;
        font-family: 'JetBrains Mono', monospace;
        letter-spacing: 1px;
        color: #999;
      }
      
      .swiss-status {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .status-indicator {
        position: relative;
        width: 16px;
        height: 16px;
      }
      
      .status-dot {
        position: absolute;
        inset: 4px;
        border-radius: 50%;
        background: #ff3300;
      }
      
      .status-ring {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid rgba(255,51,0,0.3);
      }
      
      .status-indicator.online .status-dot {
        background: #00ff00;
        animation: pulse 2s infinite;
      }
      
      .status-indicator.online .status-ring {
        border-color: rgba(0,255,0,0.3);
      }
      
      .status-indicator.checking .status-dot {
        background: #ffaa00;
        animation: blink 1s infinite;
      }
      
      .status-indicator.checking .status-ring {
        border-color: rgba(255,170,0,0.3);
        animation: spin 2s linear infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .status-text {
        display: flex;
        flex-direction: column;
        font-family: 'JetBrains Mono', monospace;
      }
      
      .status-label {
        font-size: 12px;
        font-weight: 700;
      }
      
      .status-detail {
        font-size: 10px;
        color: #666;
      }
      
      @media (max-width: 768px) {
        .header-center {
          display: none;
        }
        
        .swiss-logo {
          font-size: 32px;
        }
        
        .tagline {
          display: none;
        }
        
        .swiss-header {
          padding: 16px;
        }
      }
    `}</style>
  </header>
);
