import React, { useState } from 'react';
import { ProcessingConfig } from '../types';

interface SwissSidebarProps {
  config: ProcessingConfig;
  setConfig: (config: ProcessingConfig) => void;
  logs: string[];
  isDisabled: boolean;
}

export const SwissSidebar: React.FC<SwissSidebarProps> = ({ config, setConfig, logs, isDisabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const year = new Date().getFullYear();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const controls = (
    <>
      <div className="sidebar-section">
        <div className="sidebar-title">PROCESSING MODE</div>
        <div className="btn-group mode-group">
          {(['standard', 'extreme'] as const).map(m => (
            <button
              key={m}
              className={`btn-option ${config.mode === m ? 'active' : ''} ${m === 'extreme' ? 'extreme-btn' : ''}`}
              onClick={() => setConfig({...config, mode: m})}
              disabled={isDisabled}
            >
              {m === 'standard' ? 'STANDARD' : 'EXTREME'}
            </button>
          ))}
        </div>
        <div className="control-bio" style={{ marginTop: 6 }}>
          {config.mode === 'standard'
            ? 'Diffusion-based pipeline with DeepFilterNet + AudioSR. Best balance of speed and quality.'
            : 'Maximum restoration with UVR5 separation, VoiceRestore, and full neural upscale.'}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">DENOISE</div>

        <div className="control-group">
          <div className="control-label">
            <span>STRENGTH</span>
            <span className="control-value">{config.denoiseStrength}%</span>
          </div>
          <input
            type="range" min="0" max="100"
            value={config.denoiseStrength}
            onChange={e => setConfig({...config, denoiseStrength: Number(e.target.value)})}
            disabled={isDisabled}
          />
        </div>

        <div className="control-group">
          <div className="control-label"><span>PROFILE</span></div>
          <div className="btn-group">
            {(['auto', 'aggressive', 'gentle'] as const).map(mode => (
              <button
                key={mode}
                className={`btn-option ${config.noiseProfile === mode ? 'active' : ''}`}
                onClick={() => setConfig({...config, noiseProfile: mode})}
                disabled={isDisabled}
              >
                {mode === 'auto' ? 'AUTO' : mode === 'aggressive' ? 'AGGR' : 'GENTLE'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">OUTPUT</div>

        <div className="control-group">
          <div className="control-label"><span>UPSCALE</span></div>
          <div className="btn-group">
            {[1, 2, 4].map(f => (
              <button
                key={f}
                className={`btn-option ${config.upscaleFactor === f ? 'active' : ''}`}
                onClick={() => setConfig({...config, upscaleFactor: f})}
                disabled={isDisabled}
              >
                {f}x
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <div className="control-label"><span>SAMPLE RATE</span></div>
          <div className="btn-group">
            {[44100, 48000, 96000].map(sr => (
              <button
                key={sr}
                className={`btn-option ${config.targetSampleRate === sr ? 'active' : ''}`}
                onClick={() => setConfig({...config, targetSampleRate: sr})}
                disabled={isDisabled}
              >
                {sr / 1000}k
              </button>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">HIGH PRECISION</span>
          <button
            className="toggle-btn"
            style={{ background: config.highPrecision ? '#ff3300' : '#ccc' }}
            onClick={() => setConfig({...config, highPrecision: !config.highPrecision})}
            disabled={isDisabled}
          >
            <span style={{ left: config.highPrecision ? '22px' : '2px' }} />
          </button>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">STEREO</span>
          <button
            className="toggle-btn"
            style={{ background: config.targetChannels === 2 ? '#ff3300' : '#ccc' }}
            onClick={() => setConfig({...config, targetChannels: config.targetChannels === 2 ? 1 : 2})}
            disabled={isDisabled}
          >
            <span style={{ left: config.targetChannels === 2 ? '22px' : '2px' }} />
          </button>
        </div>
      </div>

      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-title">LOG</div>
        {logs.map((log, i) => (
          <div key={i} className="log-line">&gt; {log}</div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div>VOXIS 3.2 DENSE</div>
        <div>Built by Glass Stone</div>
        <div>Powered by Trinity v7</div>
        <div className="footer-meta">{dateStr} {timeStr}</div>
        <div className="footer-meta">&copy; {year} Glass Stone. All rights reserved.</div>
      </div>
    </>
  );

  return (
    <>
      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'CLOSE' : 'SETTINGS'}
      </button>
      <aside className={`swiss-sidebar ${isOpen ? 'open' : ''}`}>
        {controls}
      </aside>

      <style>{`
        .swiss-sidebar {
          border-right: 3px solid #000;
          display: flex; flex-direction: column;
          background: #fff; width: 260px;
          overflow-y: auto;
        }
        .mobile-menu-btn {
          display: none; width: 100%; padding: 12px;
          background: #000; color: #fff;
          font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 11px;
          letter-spacing: 2px;
          border: none; cursor: pointer; position: sticky; top: 0; z-index: 20;
        }
        @media (max-width: 768px) {
          .swiss-sidebar {
            position: fixed; top: 0; left: -260px; z-index: 10;
            transition: left 0.3s ease; height: 100vh;
            border-right: 3px solid #000;
          }
          .swiss-sidebar.open { left: 0; }
          .mobile-menu-btn { display: block; }
        }
        .sidebar-section { padding: 16px 20px; border-bottom: 2px solid #000; }
        .sidebar-title {
          font-size: 9px; font-weight: 700; letter-spacing: 2px;
          margin-bottom: 12px; color: #999;
        }
        .control-group { margin-bottom: 16px; }
        .control-label {
          display: flex; justify-content: space-between;
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          font-weight: 600; margin-bottom: 6px;
        }
        .control-value { color: #ff3300; font-weight: 700; }
        .control-bio { font-size: 9px; color: #999; line-height: 1.4; }
        input[type="range"] {
          -webkit-appearance: none; width: 100%; height: 24px;
          background: #000; border: none; cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 24px;
          background: #ff3300; cursor: pointer;
        }
        .btn-group { display: flex; border: 2px solid #000; }
        .btn-option {
          flex: 1; padding: 8px;
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          font-weight: 700; background: #fff; border: none;
          border-right: 2px solid #000; cursor: pointer; transition: all 0.1s;
        }
        .btn-option:last-child { border-right: none; }
        .btn-option.active { background: #000; color: #fff; }
        .btn-option:hover:not(.active):not(:disabled) { background: #f0f0f0; }
        .btn-option.extreme-btn.active { background: #ff3300; color: #fff; }
        .mode-group .btn-option { padding: 10px; font-size: 11px; letter-spacing: 1px; }
        .toggle-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0; border-bottom: 1px solid #eee;
        }
        .toggle-label { font-size: 10px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
        .toggle-btn {
          width: 42px; height: 22px; border: 2px solid #000;
          cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-btn span {
          position: absolute; top: 2px; width: 14px; height: 14px;
          background: #fff; border: 2px solid #000; transition: left 0.2s;
        }
        .log-line {
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
          margin-bottom: 3px; color: #888;
        }
        .sidebar-footer {
          padding: 16px 20px; font-size: 9px; color: #999;
          background: #fafafa; line-height: 1.6;
          font-family: 'JetBrains Mono', monospace;
          border-top: 2px solid #eee;
        }
        .footer-meta { color: #bbb; margin-top: 2px; }
      `}</style>
    </>
  );
};
