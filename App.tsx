import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PipelineStep, AudioMetadata, ProcessingConfig } from './types';
import { apiService, JobStatus } from './services/apiService';

// Components
import { SwissHeader } from './components/SwissHeader';
import { SwissSidebar } from './components/SwissSidebar';
import { PipelineDisplay } from './components/PipelineDisplay';
import { FileDropZone } from './components/FileDropZone';
import { ProcessingStatus } from './components/ProcessingStatus';
import { CompletionPanel } from './components/CompletionPanel';
import { SwissPlayer } from './components/SwissPlayer';
import { SwissFooter } from './components/SwissFooter';

const PIPELINE_STEPS = [
  { id: PipelineStep.UPLOAD, label: '01', name: 'UPLOAD' },
  { id: PipelineStep.INGEST, label: '02', name: 'INGEST' },
  { id: PipelineStep.ANALYSIS, label: '03', name: 'SPECTRUM' },
  { id: PipelineStep.DENOISE, label: '04', name: 'DENOISE' },
  { id: PipelineStep.UPSCALE, label: '05', name: 'UPSCALE' },
  { id: PipelineStep.COMPLETE, label: '06', name: 'EXPORT' },
];

const App: React.FC = () => {
  // State
  const [step, setStep] = useState<PipelineStep>(PipelineStep.IDLE);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(['SYS.INIT', 'TRINITY.READY']);
  
  // Config
  const [config, setConfig] = useState<ProcessingConfig>({
    denoiseStrength: 75,
    highPrecision: true,
    upscaleFactor: 2,
    targetSampleRate: 48000,
    targetChannels: 2,
  });

  // Audio
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Helpers
  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-6), msg]);
  }, []);

  // Effects
  useEffect(() => {
    apiService.healthCheck()
      .then(() => { setBackendStatus('online'); addLog('BACKEND.OK'); })
      .catch(() => { setBackendStatus('offline'); addLog('BACKEND.ERR'); });
  }, [addLog]);

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

  // Handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('audio/')) processFile(file);
  };

  const processFile = async (file: File) => {
    if (backendStatus !== 'online') {
      setError('BACKEND OFFLINE');
      return;
    }
    setError(null);
    setStep(PipelineStep.UPLOAD);
    setProgress(0);
    setDownloadUrl(null);
    setAudioUrl(URL.createObjectURL(file));
    setMetadata({ name: file.name, size: file.size, duration: 0, sampleRate: 0, channels: 0 });
    addLog(`FILE: ${file.name.slice(0, 20).toUpperCase()}`);

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
          denoise: PipelineStep.DENOISE,
          upscale: PipelineStep.UPSCALE,
          export: PipelineStep.COMPLETE,
        };
        if (stageMap[status.current_stage]) setStep(stageMap[status.current_stage]);
        if (status.status === 'complete') {
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

  const isProcessing = step !== PipelineStep.IDLE && step !== PipelineStep.COMPLETE;
  const isComplete = step === PipelineStep.COMPLETE;
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === step);

  return (
    <div className="swiss-app">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}
      
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
              onFileSelect={processFile}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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

          {audioUrl && !isComplete && (
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
          grid-template-columns: 280px 1fr;
          grid-template-rows: auto 1fr auto;
          min-height: 100vh; border: 4px solid #000;
        }
        .swiss-main {
          display: flex; flex-direction: column; background: #f5f5f5;
        }
        .error-banner {
          background: #ff3300; color: #fff; padding: 12px 24px;
          font-weight: 700; text-align: center;
          text-transform: uppercase; letter-spacing: 2px;
        }
      `}</style>
    </div>
  );
};

export default App;