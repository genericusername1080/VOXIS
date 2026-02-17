/**
 * VOXIS 4 Dense — Model Setup Component
 * Shows model download status and triggers downloads on first launch.
 * Powered by Trinity 8.1 | Built by Glass Stone
 */
import React, { useState, useEffect, useCallback } from 'react';
import { apiService, ModelsStatus, ModelInfo } from '../services/apiService';

interface ModelSetupProps {
  onReady: () => void;
  onSkip: () => void;
}

const MODEL_ICONS: Record<string, string> = {
  deepfilternet: '\u25C6',
  audiosr: '\u25B2',
  uvr5: '\u25CF',
};

export const ModelSetup: React.FC<ModelSetupProps> = ({ onReady, onSkip }) => {
  const [status, setStatus] = useState<ModelsStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Check model status on mount
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const s = await apiService.getModelsStatus();
        if (!mounted) return;
        setStatus(s);
        setChecked(true);

        // If all models are ready, skip this screen entirely
        if (s.all_ready) {
          onReady();
          return;
        }

        // If already downloading (auto-started by backend), poll
        if (s.any_downloading) {
          setIsDownloading(true);
          pollStatus();
        }
      } catch (err) {
        if (!mounted) return;
        setChecked(true);
        // If model API unavailable, skip setup (dev mode or models pre-installed)
        onSkip();
      }
    };
    check();
    return () => { mounted = false; };
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      await apiService.pollModelsStatus((s) => {
        setStatus(s);
        if (s.all_ready) {
          setIsDownloading(false);
          onReady();
        }
      });
    } catch (err) {
      setError('Download interrupted. Retry when online.');
      setIsDownloading(false);
    }
  }, [onReady]);

  const startDownload = async () => {
    setError(null);
    setIsDownloading(true);
    try {
      const res = await apiService.downloadModels();
      if (res.success || res.downloading) {
        pollStatus();
      } else {
        setError('Failed to start download');
        setIsDownloading(false);
      }
    } catch (err) {
      setError('Cannot reach backend');
      setIsDownloading(false);
    }
  };

  if (!checked) return null;

  const models = status?.models || {};
  const modelEntries = Object.entries(models);
  const totalSize = status?.total_size_mb || 0;
  const readyCount = modelEntries.filter(([, m]) => m.status === 'ready').length;
  const allReady = readyCount === modelEntries.length;

  return (
    <div className="model-setup">
      <div className="model-setup-header">
        <div className="model-setup-icon">{'\u25C8'}</div>
        <h2>DENSE ENGINE SETUP</h2>
        <p className="model-setup-desc">
          {allReady
            ? 'All models installed'
            : isDownloading
              ? 'Downloading AI models...'
              : `${modelEntries.length - readyCount} model${modelEntries.length - readyCount > 1 ? 's' : ''} required (${totalSize} MB)`}
        </p>
      </div>

      <div className="model-list">
        {modelEntries.map(([id, model]) => (
          <ModelRow key={id} id={id} model={model} />
        ))}
      </div>

      {error && <div className="model-error">{error}</div>}

      <div className="model-actions">
        {!allReady && !isDownloading && (
          <button className="model-btn model-btn-primary" onClick={startDownload}>
            DOWNLOAD ALL
          </button>
        )}
        {isDownloading && (
          <button className="model-btn model-btn-cancel" onClick={async () => {
            await apiService.cancelModelDownload();
            setIsDownloading(false);
          }}>
            CANCEL
          </button>
        )}
        <button className="model-btn model-btn-skip" onClick={onSkip}>
          {allReady ? 'CONTINUE' : 'SKIP FOR NOW'}
        </button>
      </div>

      <p className="model-note">
        {isDownloading
          ? 'Models download in the background. You can start using VOXIS now.'
          : 'Without models, the pipeline uses fallback processing.'}
      </p>

      <style>{`
        .model-setup {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
          flex: 1;
          text-align: center;
          max-width: 560px;
          margin: 0 auto;
        }
        .model-setup-header {
          margin-bottom: 32px;
        }
        .model-setup-icon {
          font-size: 40px;
          color: #ff3300;
          margin-bottom: 16px;
        }
        .model-setup h2 {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 4px;
          margin-bottom: 8px;
          color: #000;
        }
        .model-setup-desc {
          font-size: 12px;
          color: #666;
          letter-spacing: 1px;
        }
        .model-list {
          width: 100%;
          border: 3px solid #000;
          margin-bottom: 24px;
        }
        .model-row {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #e0e0e0;
          text-align: left;
          gap: 12px;
        }
        .model-row:last-child { border-bottom: none; }
        .model-row-icon {
          font-size: 16px;
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }
        .model-row-icon.ready { color: #000; }
        .model-row-icon.downloading { color: #ff3300; }
        .model-row-icon.pending { color: #ccc; }
        .model-row-icon.error { color: #ff3300; }
        .model-row-info { flex: 1; }
        .model-row-name {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .model-row-engine {
          font-size: 10px;
          color: #999;
          letter-spacing: 0.5px;
        }
        .model-row-status {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .model-row-status.ready { color: #000; }
        .model-row-status.downloading { color: #ff3300; }
        .model-row-status.pending { color: #999; }
        .model-row-status.error { color: #ff3300; }
        .model-row-bar {
          width: 60px;
          height: 3px;
          background: #e0e0e0;
          flex-shrink: 0;
          overflow: hidden;
        }
        .model-row-bar-fill {
          height: 100%;
          background: #ff3300;
          transition: width 0.3s;
        }
        .model-error {
          color: #ff3300;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 16px;
        }
        .model-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }
        .model-btn {
          padding: 10px 24px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          border: 3px solid #000;
          cursor: pointer;
          text-transform: uppercase;
          font-family: inherit;
          transition: all 0.15s;
        }
        .model-btn-primary {
          background: #000;
          color: #fff;
        }
        .model-btn-primary:hover {
          background: #ff3300;
          border-color: #ff3300;
        }
        .model-btn-cancel {
          background: #fff;
          color: #ff3300;
          border-color: #ff3300;
        }
        .model-btn-skip {
          background: #fff;
          color: #000;
        }
        .model-btn-skip:hover {
          background: #f0f0f0;
        }
        .model-note {
          font-size: 10px;
          color: #999;
          letter-spacing: 0.5px;
          max-width: 360px;
        }
      `}</style>
    </div>
  );
};

const ModelRow: React.FC<{ id: string; model: ModelInfo }> = ({ id, model }) => {
  const icon = MODEL_ICONS[id] || '\u25CB';
  const statusClass = model.status === 'ready' ? 'ready'
    : model.status === 'downloading' ? 'downloading'
    : model.status === 'error' ? 'error'
    : 'pending';

  const statusLabel = model.status === 'ready' ? 'READY'
    : model.status === 'downloading' ? `${model.progress}%`
    : model.status === 'error' ? 'ERROR'
    : `${model.size_mb} MB`;

  return (
    <div className="model-row">
      <div className={`model-row-icon ${statusClass}`}>{icon}</div>
      <div className="model-row-info">
        <div className="model-row-name">{model.name}</div>
        <div className="model-row-engine">{model.engine} — {model.description}</div>
      </div>
      {model.status === 'downloading' && (
        <div className="model-row-bar">
          <div className="model-row-bar-fill" style={{ width: `${model.progress}%` }} />
        </div>
      )}
      <div className={`model-row-status ${statusClass}`}>{statusLabel}</div>
    </div>
  );
};
