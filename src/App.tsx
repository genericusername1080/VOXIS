/**
 * VOXIS — Main Application Controller
 * Powered by Trinity v8.1 | Built by Glass Stone
 */

import React, { useState, useCallback } from 'react';
import { PipelineStep, ProcessingConfig, AudioMetadata } from './types';
import { BauhausHeader } from './components/BauhausHeader';
import { BauhausSidebar } from './components/BauhausSidebar';
import { BauhausFooter } from './components/BauhausFooter';
import { BauhausPlayer } from './components/BauhausPlayer';
import { PipelineDisplay } from './components/PipelineDisplay';
import { FileDropZone } from './components/FileDropZone';
import { ProcessingStatus } from './components/ProcessingStatus';
import { StartPanel } from './components/StartPanel';
import { CompletionPanel } from './components/CompletionPanel';
import { OfflineBanner } from './components/OfflineBanner';
import apiService from './services/apiService';
import { useNetworkStatus } from './services/networkResilience';

const PIPELINE_STEPS = [
  { id: PipelineStep.UPLOAD, label: '1', name: 'RECEPTION' },
  { id: PipelineStep.INGEST, label: '2', name: 'OPAQUE' },
  { id: PipelineStep.ANALYSIS, label: '3', name: 'PRISM' },
  { id: PipelineStep.DENOISE, label: '4', name: 'POLISH' },
  { id: PipelineStep.DENSE, label: '5', name: 'SHARDING' },
  { id: PipelineStep.UPSCALE, label: '6', name: 'MAGNIFY' },
  { id: PipelineStep.EXPORT, label: '7', name: 'ARTIFACT' },
];

const DEFAULT_CONFIG: ProcessingConfig = {
  denoiseStrength: 92,
  highPrecision: true,
  upscaleFactor: 2,
  targetSampleRate: 48000,
  targetChannels: 2,
  noiseProfile: 'auto',
  outputFormat: 'wav',
  voicerestoreSteps: 32,
  voicerestoreCfg: 0.5,
};

export default function App() {
  const [step, setStep] = useState<PipelineStep>(PipelineStep.IDLE);
  const [config, setConfig] = useState<ProcessingConfig>(DEFAULT_CONFIG);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(['VOXIS 4.0.0 initialized', 'Trinity v8.1 engine ready']);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { backendOnline } = useNetworkStatus();
  const backendStatus = backendOnline ? 'online' : 'offline';
  const isProcessing = step !== PipelineStep.IDLE && step !== PipelineStep.STAGED && step !== PipelineStep.COMPLETE;

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const valid = ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'aiff', 'mp4', 'mov'];
    if (!valid.includes(ext)) {
      addLog(`Rejected: unsupported format .${ext}`);
      return;
    }
    setSelectedFile(file);
    setMetadata({ name: file.name, size: file.size, duration: 0, sampleRate: 0, channels: 0, format: ext });
    setStep(PipelineStep.STAGED);
    addLog(`Staged: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }, [addLog]);

  const handleStart = useCallback(async () => {
    if (!selectedFile) return;
    try {
      setStep(PipelineStep.UPLOAD);
      setProgress(0);
      addLog('Uploading file...');
      const uploadResult = await apiService.uploadFile(selectedFile, (pct) => setProgress(pct));
      setMetadata(prev => prev ? { ...prev, duration: uploadResult.duration || 0, sampleRate: uploadResult.samplerate || 0, channels: uploadResult.channels || 0 } : prev);
      addLog(`Uploaded: ${uploadResult.filename}`);

      setStep(PipelineStep.INGEST);
      setProgress(0);
      addLog(`Processing: Trinity v8.1 always-on, denoise=${config.denoiseStrength}%`);
      const processResult = await apiService.startProcessing(uploadResult.file_id, {
        denoiseStrength: config.denoiseStrength,
        highPrecision: config.highPrecision,
        upscaleFactor: config.upscaleFactor,
        targetSampleRate: config.targetSampleRate,
        targetChannels: config.targetChannels,
        noiseProfile: config.noiseProfile,
      });
      addLog(`Job started: ${processResult.job_id.slice(0, 8)}`);

      const STAGE_MAP: Record<string, PipelineStep> = {
        ingest: PipelineStep.INGEST,
        analysis: PipelineStep.ANALYSIS,
        filter: PipelineStep.ANALYSIS,
        denoise: PipelineStep.DENOISE,
        sharding: PipelineStep.DENSE,
        dense: PipelineStep.DENSE,
        amplify: PipelineStep.DENSE,
        hybrid_restore: PipelineStep.RESTORE,
        restore: PipelineStep.RESTORE,
        upscale: PipelineStep.UPSCALE,
        phaselimiter: PipelineStep.UPSCALE,
        export: PipelineStep.EXPORT,
      };

      await apiService.pollJobStatus(processResult.job_id, (status) => {
        const stage = status.current_stage?.toLowerCase();
        if (stage && STAGE_MAP[stage]) setStep(STAGE_MAP[stage]);
        setProgress(status.progress || 0);
      });

      setStep(PipelineStep.COMPLETE);
      setProgress(100);
      setDownloadUrl(apiService.getExportUrl(processResult.job_id, config.outputFormat));
      addLog('Restoration complete');
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
      setStep(PipelineStep.IDLE);
      setProgress(0);
    }
  }, [selectedFile, config, addLog]);

  const handleReset = useCallback(() => {
    setStep(PipelineStep.IDLE);
    setProgress(0);
    setMetadata(null);
    setDownloadUrl(null);
    setSelectedFile(null);
    addLog('Reset — ready for new file');
  }, [addLog]);

  const handleCancel = useCallback(() => {
    setStep(PipelineStep.IDLE);
    setMetadata(null);
    setSelectedFile(null);
    addLog('Cancelled');
  }, [addLog]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const currentStepName = PIPELINE_STEPS.find(s => s.id === step)?.name || '';

  const renderContent = () => {
    switch (step) {
      case PipelineStep.IDLE:
        return <FileDropZone onFileSelect={handleFileSelect} isDragging={isDragging} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} />;
      case PipelineStep.STAGED:
        return <StartPanel metadata={metadata} config={config} onStart={handleStart} onCancel={handleCancel} />;
      case PipelineStep.COMPLETE:
        return <CompletionPanel config={config} downloadUrl={downloadUrl} onReset={handleReset} originalName={metadata?.name} />;
      default:
        return <ProcessingStatus step={step} stepName={currentStepName} progress={progress} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-cream)] text-[var(--charcoal)] font-sans overflow-hidden">
      <BauhausHeader status={backendStatus} onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
      <OfflineBanner show={!backendOnline} />

      {/* Main Layout Grid */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — fixed overlay on mobile, static on desktop */}
        <div
          className={`
            fixed top-0 left-0 h-full z-40
            transform transition-transform duration-200 ease-out
            lg:relative lg:translate-x-0 lg:z-0 lg:flex-shrink-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{ width: 'var(--sidebar-width)' }}
        >
          <BauhausSidebar config={config} setConfig={setConfig} logs={logs} isDisabled={isProcessing} />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
          {/* Top Bar with Player */}
          {metadata && step !== PipelineStep.IDLE && (
            <BauhausPlayer
              metadata={metadata}
              audioSrc={downloadUrl || undefined} // Only play if we have a result, otherwise it's just metadata
            />
          )}

          {/* Pipeline Steps (only show when active) */}
          {step !== PipelineStep.IDLE && step !== PipelineStep.COMPLETE && (
            <div className="p-4 border-b-3 border-black bg-white">
              <PipelineDisplay currentStep={step} steps={PIPELINE_STEPS} />
            </div>
          )}

          {/* Dynamic Content */}
          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {renderContent()}
          </div>
        </main>
      </div>

      <BauhausFooter leftText="VOXIS 4.0.0 // TRINITY v8.1 // by Glass Stone 2026 / Closed License" />
    </div>
  );
}
