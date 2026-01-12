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

  // Reusable control content
  const controls = (
    <>
      <div className="sidebar-section">
        <div className="sidebar-title">TRINITY ENGINE</div>
        
        {/* Denoise */}
        <div className="control-group">
          <div className="control-label">
            <span>DENOISE</span>
            <span className="control-value">{config.denoiseStrength}%</span>
          </div>
          <div className="control-bio">
            AI-powered noise reduction using DeepFilterNet. Higher values remove more background noise but may affect audio clarity.
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

        {/* Noise Profile */}
        <div className="control-group">
          <div className="control-label">
            <span>NOISE PROFILE</span>
            <span className="control-value">{(config.noiseProfile || 'AUTO').toUpperCase()}</span>
          </div>
          <div className="control-bio">
            Adaptive profile selection. Auto for general use, Aggressive for speech isolation, Gentle for ambience.
          </div>
          <div className="btn-group">
            {['auto', 'aggressive', 'gentle'].map((mode) => (
              <button
                key={mode}
                className={`btn-option ${config.noiseProfile === mode ? 'active' : ''}`}
                onClick={() => setConfig({...config, noiseProfile: mode as any})}
                disabled={isDisabled}
              >
                {mode === 'auto' ? 'AUTO' : mode === 'aggressive' ? 'AGGR' : 'GENTLE'}
              </button>
            ))}
          </div>
        </div>

        {/* Upscale */}
        <div className="control-group">
          <div className="control-label">
            <span>UPSCALE</span>
          </div>
          <div className="control-bio">
            AudioSR neural upsampling. 1× bypasses, 2× doubles quality, 4× maximum enhancement for low-bitrate sources.
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
          <div className="control-bio">
            Output sample rate. 44.1k for CD quality, 48k for video/broadcast, 96k for studio masters.
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
          <div className="toggle-info">
            <span className="toggle-label">HIGH PRECISION</span>
            <div className="toggle-bio">Enhanced DeepFilterNet mode. Slower but better isolation of voice from noise.</div>
          </div>
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
          <div className="toggle-info">
            <span className="toggle-label">STEREO OUTPUT</span>
            <div className="toggle-bio">Output as 2-channel stereo. Disable for mono speech recordings.</div>
          </div>
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
        VER 1.0.5
      </div>
    </>
  );

  return (
    <>
      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'CLOSE SETTINGS' : 'TRINITY SETTINGS'}
      </button>

      <aside className={`swiss-sidebar ${isOpen ? 'open' : ''}`}>
        {controls}
      </aside>

      <style>{`
        .swiss-sidebar {
          border-right: 4px solid #000;
          display: flex;
          flex-direction: column;
          background: #fff;
          width: 280px;
          height: 100%;
          overflow-y: auto;
        }

        .mobile-menu-btn {
          display: none;
          width: 100%;
          padding: 16px;
          background: #000;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          border: none;
          cursor: pointer;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        @media (max-width: 768px) {
          .swiss-sidebar {
            position: fixed;
            top: 0;
            left: -280px;
            z-index: 10;
            transition: left 0.3s ease;
            height: 100vh;
            border-right: 4px solid #000;
            box-shadow: 4px 0 16px rgba(0,0,0,0.2);
          }
          
          .swiss-sidebar.open {
            left: 0;
          }
          
          .mobile-menu-btn {
            display: block;
          }
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
          font-weight: 500; margin-bottom: 4px;
        }
        .control-value { color: #ff3300; font-weight: 700; }
        .control-bio {
          font-size: 9px;
          color: #888;
          line-height: 1.4;
          margin-bottom: 10px;
        }
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
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 12px 0; border-bottom: 1px solid #eee;
        }
        .toggle-info { flex: 1; }
        .toggle-label { font-size: 12px; font-weight: 500; display: block; }
        .toggle-bio {
          font-size: 9px;
          color: #888;
          line-height: 1.4;
          margin-top: 4px;
        }
        .toggle-btn {
          width: 48px; height: 24px; border: 2px solid #000;
          cursor: pointer; position: relative; transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle-btn span {
          position: absolute; top: 2px; width: 16px; height: 16px;
          background: #fff; border: 2px solid #000; transition: left 0.2s;
        }
        .log-line { font-family: 'JetBrains Mono'; font-size: 10px; margin-bottom: 4px; color: #666; }
        .sidebar-footer { padding: 24px; font-size: 10px; color: #999; background: #f5f5f5; }
      `}</style>
    </>
  );
};
