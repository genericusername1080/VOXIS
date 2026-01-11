import React from 'react';
import { ProcessingConfig } from '../types';

interface SwissSidebarProps {
  config: ProcessingConfig;
  setConfig: (config: ProcessingConfig) => void;
  logs: string[];
  isDisabled: boolean;
}

export const SwissSidebar: React.FC<SwissSidebarProps> = ({ config, setConfig, logs, isDisabled }) => {
  return (
    <aside className="swiss-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">TRINITY ENGINE</div>
        
        {/* Denoise */}
        <div className="control-group">
          <div className="control-label">
            <span>DENOISE</span>
            <span className="control-value">{config.denoiseStrength}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={config.denoiseStrength}
            onChange={e => setConfig({...config, denoiseStrength: Number(e.target.value)})}
            disabled={isDisabled}
          />
        </div>

        {/* Upscale */}
        <div className="control-group">
          <div className="control-label">
            <span>UPSCALE</span>
          </div>
          <div className="btn-group">
            {[1, 2, 4].map(f => (
              <button
                key={f}
                className={`btn-option ${config.upscaleFactor === f ? 'active' : ''}`}
                onClick={() => setConfig({...config, upscaleFactor: f})}
                disabled={isDisabled}
              >
                {f}×
              </button>
            ))}
          </div>
        </div>

        {/* Sample Rate */}
        <div className="control-group">
          <div className="control-label">
            <span>SAMPLE RATE</span>
          </div>
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

        {/* Toggles */}
        <div className="toggle-row">
          <span className="toggle-label">HIGH PRECISION</span>
          <button
            className="toggle-btn"
            style={{ background: config.highPrecision ? '#ff3300' : '#ccc' }}
            onClick={() => setConfig({...config, highPrecision: !config.highPrecision})}
            disabled={isDisabled}
          >
            <span style={{ left: config.highPrecision ? '24px' : '2px' }} />
          </button>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">STEREO OUTPUT</span>
          <button
            className="toggle-btn"
            style={{ background: config.targetChannels === 2 ? '#ff3300' : '#ccc' }}
            onClick={() => setConfig({...config, targetChannels: config.targetChannels === 2 ? 1 : 2})}
            disabled={isDisabled}
          >
            <span style={{ left: config.targetChannels === 2 ? '24px' : '2px' }} />
          </button>
        </div>
      </div>

      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-title">SYSTEM LOG</div>
        {logs.map((log, i) => (
          <div key={i} className="log-line">
            &gt; {log}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        POWERED BY TRINITY<br />
        BUILT BY GLASS STONE<br />
        VER 2.0.0
      </div>

      <style>{`
        .swiss-sidebar {
          border-right: 4px solid #000;
          display: flex;
          flex-direction: column;
        }
        .sidebar-section {
          padding: 24px;
          border-bottom: 4px solid #000;
        }
        .sidebar-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 16px;
          color: #666;
        }
        .control-group { margin-bottom: 24px; }
        .control-label {
          display: flex; justify-content: space-between;
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          font-weight: 500; margin-bottom: 8px;
        }
        .control-value { color: #ff3300; font-weight: 700; }
        input[type="range"] {
          -webkit-appearance: none; width: 100%; height: 32px;
          background: #000; border: none; cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 32px;
          background: #ff3300; cursor: pointer;
        }
        .btn-group { display: flex; border: 3px solid #000; }
        .btn-option {
          flex: 1; padding: 12px;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          font-weight: 700; background: #fff; border: none;
          border-right: 3px solid #000; cursor: pointer; transition: all 0.1s;
        }
        .btn-option:last-child { border-right: none; }
        .btn-option.active { background: #ff3300; color: #fff; }
        .btn-option:hover:not(.active) { background: #000; color: #fff; }
        .toggle-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 0; border-bottom: 1px solid #eee;
        }
        .toggle-label { font-size: 12px; font-weight: 500; }
        .toggle-btn {
          width: 48px; height: 24px; border: 2px solid #000;
          cursor: pointer; position: relative; transition: background 0.2s;
        }
        .toggle-btn span {
          position: absolute; top: 2px; width: 16px; height: 16px;
          background: #fff; border: 2px solid #000; transition: left 0.2s;
        }
        .log-line { font-family: 'JetBrains Mono'; font-size: 10px; margin-bottom: 4px; color: #666; }
        .sidebar-footer { padding: 24px; font-size: 10px; color: #999; background: #f5f5f5; }
      `}</style>
    </aside>
  );
};
