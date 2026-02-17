/**
 * VOXIS 4 Dense
 * Powered by Trinity 8.1 | Built by Glass Stone
 * Copyright (c) 2026 Glass Stone. All rights reserved.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PipelineStep, AudioMetadata, ProcessingConfig } from './types';
import { apiService, JobStatus } from './services/apiService';
import { useNetworkStatus, useOperationQueue } from './services/networkResilience';

import { SwissHeader } from './components/SwissHeader';
import { SwissSidebar } from './components/SwissSidebar';
import { PipelineDisplay } from './components/PipelineDisplay';
import { FileDropZone } from './components/FileDropZone';
import { ProcessingStatus } from './components/ProcessingStatus';
import { CompletionPanel } from './components/CompletionPanel';
import { SwissPlayer } from './components/SwissPlayer';
import { SwissFooter } from './components/SwissFooter';
import { OfflineBanner } from './components/OfflineBanner';
import { StartPanel } from './components/StartPanel';

const PIPELINE_STEPS = [
  { id: PipelineStep.UPLOAD, label: '01', name: 'UPLOAD' },
  { id: PipelineStep.INGEST, label: '02', name: 'INGEST' },
  { id: PipelineStep.ANALYSIS, label: '03', name: 'SPECTRUM' },
  { id: PipelineStep.DENSE, label: '04', name: 'DENSE' },
  { id: PipelineStep.DENOISE, label: '05', name: 'DENOISE' },
  { id: PipelineStep.UPSCALE, label: '06', name: 'UPSCALE' },
  { id: PipelineStep.EXPORT, label: '07', name: 'EXPORT' },
];

const App: React.FC = () => {
  const networkStatus = useNetworkStatus('http://localhost:5001/api/health', 5000);
  const { queueLength } = useOperationQueue();

  const [step, setStep] = useState<PipelineStep>(PipelineStep.IDLE);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>(['SYS.INIT', 'TRINITY.8.1.READY']);

  const [config, setConfig] = useState<ProcessingConfig>({
    mode: 'standard',
    denoiseStrength: 85,
    highPrecision: true,
    upscaleFactor: 2,
    targetSampleRate: 48000,
    targetChannels: 2,
    noiseProfile: 'auto',
  });

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-6), msg]);
  }, []);

  const backendStatus = networkStatus.isBackendReachable ? 'online' :
                        networkStatus.isOnline ? 'checking' : 'offline';

  useEffect(() => {
    if (networkStatus.isBackendReachable) {
      addLog('BACKEND.OK');
    } else if (!networkStatus.isOnline) {
      addLog('NETWORK.OFFLINE');
    }
  }, [networkStatus.isBackendReachable, networkStatus.isOnline, addLog]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, [audioUrl]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) stageFile(file);
  };

  const stageFile = (file: File) => {
    setStagedFile(file);
    setStep(PipelineStep.STAGED);
    setAudioUrl(URL.createObjectURL(file));
    setMetadata({ name: file.name, size: file.size, duration: 0, sampleRate: 0, channels: 0 });
    addLog(`STAGED: ${file.name.slice(0, 16).toUpperCase()}`);
  };

  const startProcessing = async () => {
    if (!stagedFile) return;
    if (backendStatus !== 'online') {
      setError('BACKEND OFFLINE');
      return;
    }

    const file = stagedFile;
    setError(null);
    setStep(PipelineStep.UPLOAD);
    setProgress(0);
    setDownloadUrl(null);
    addLog(`MODE: ${config.mode.toUpperCase()}`);

    try {
      const upload = await apiService.uploadFile(file, setProgress);
      if (!upload.success) throw new Error(upload.error);
      addLog('UPLOAD.OK');

      setStep(PipelineStep.INGEST);
      setProgress(0);

      const proc = await apiService.startProcessing(upload.file_id, config);
      if (!proc.success) throw new Error(proc.error);
      addLog(`JOB: ${proc.job_id.slice(0, 8)}`);

      await apiService.pollJobStatus(proc.job_id, (status: JobStatus) => {
        setProgress(status.progress);
        const stageMap: Record<string, PipelineStep> = {
          upload: PipelineStep.UPLOAD,
          ingest: PipelineStep.INGEST,
          analysis: PipelineStep.ANALYSIS,
          dense: PipelineStep.DENSE,
          denoise: PipelineStep.DENOISE,
          upscale: PipelineStep.UPSCALE,
          export: PipelineStep.EXPORT,
        };
        if (stageMap[status.current_stage]) setStep(stageMap[status.current_stage]);
        if (status.status === 'complete') {
          setStep(PipelineStep.COMPLETE);
          setDownloadUrl(apiService.getDownloadUrl(status.job_id));
          addLog('COMPLETE');
        }
        if (status.status === 'error') {
          setError(status.error || 'PROCESS ERROR');
        }
      });
    } catch (err: any) {
      setError(err.message);
      setStep(PipelineStep.IDLE);
      addLog(`ERR: ${err.message.slice(0, 20)}`);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const reset = () => {
    setStep(PipelineStep.IDLE);
    setMetadata(null);
    setDownloadUrl(null);
    setAudioUrl(null);
    setProgress(0);
    setError(null);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    addLog('RESET');
  };

  const isProcessing = step !== PipelineStep.IDLE && step !== PipelineStep.STAGED && step !== PipelineStep.COMPLETE;
  const isComplete = step === PipelineStep.COMPLETE;
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === step);

  return (
    <div className="swiss-app">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      <OfflineBanner
        isOnline={networkStatus.isOnline}
        isBackendReachable={networkStatus.isBackendReachable}
        reconnectAttempts={networkStatus.reconnectAttempts}
        onRetry={networkStatus.forceReconnect}
        queueLength={queueLength}
      />

      <div className="swiss-grid">
        <SwissHeader status={backendStatus} />

        <SwissSidebar
          config={config}
          setConfig={setConfig}
          logs={logs}
          isDisabled={isProcessing}
        />

        <main className="swiss-main">
          {error && <div className="error-banner">ERROR: {error}</div>}

          <PipelineDisplay currentStep={step} steps={PIPELINE_STEPS} />

          {step === PipelineStep.IDLE && (
            <FileDropZone
              onFileSelect={stageFile}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          )}

          {step === PipelineStep.STAGED && (
            <StartPanel
              metadata={metadata}
              config={config}
              onStart={startProcessing}
              onCancel={reset}
            />
          )}

          {isProcessing && (
            <ProcessingStatus
              step={step}
              stepName={PIPELINE_STEPS[stepIndex]?.name || 'PROCESSING'}
              progress={progress}
            />
          )}

          {isComplete && (
            <CompletionPanel
              config={config}
              downloadUrl={downloadUrl}
              onReset={reset}
            />
          )}

          {audioUrl && !isComplete && step === PipelineStep.STAGED && (
            <SwissPlayer
              isPlaying={isPlaying}
              togglePlay={togglePlay}
              metadata={metadata}
              currentTime={currentTime}
              duration={duration}
            />
          )}
        </main>

        <SwissFooter logs={logs} />
      </div>

      <style>{`
        .swiss-app {
          font-family: 'Inter', system-ui, sans-serif;
          background: #fff; min-height: 100vh;
          color: #000;
        }
        .swiss-grid {
          display: grid;
          grid-template-columns: 260px 1fr;
          grid-template-rows: auto 1fr auto;
          min-height: 100vh;
          border: 3px solid #000;
        }
        @media (max-width: 768px) {
          .swiss-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto 1fr auto;
            border-width: 0;
          }
          .swiss-app { overflow-x: hidden; }
        }
        .swiss-main {
          display: flex; flex-direction: column; background: #f7f7f7;
          position: relative; z-index: 1;
        }
        .error-banner {
          background: #ff3300; color: #fff; padding: 10px 24px;
          font-weight: 700; text-align: center;
          text-transform: uppercase; letter-spacing: 2px; font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default App;
