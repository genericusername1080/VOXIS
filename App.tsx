import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PipelineStep, AudioMetadata, ProcessingConfig } from './types';
import { AudioService } from './services/audioService';
import { Visualizer } from './components/Visualizer';
import { 
  ArrowUpTrayIcon, 
  CpuChipIcon, 
  SpeakerWaveIcon, 
  SparklesIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  StopIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/solid';

const STEP_LABELS = {
  [PipelineStep.IDLE]: 'Standby',
  [PipelineStep.UPLOAD]: 'Data Upload',
  [PipelineStep.INGEST]: 'Data Ingestion',
  [PipelineStep.ANALYSIS]: 'Spectral Analysis (Yazdi9)',
  [PipelineStep.DENOISE]: 'Denoising (DeepFilterNet)',
  [PipelineStep.UPSCALE]: 'Upscaling (AudioSR)',
  [PipelineStep.COMPLETE]: 'Pipeline Complete'
};

const App: React.FC = () => {
  const [step, setStep] = useState<PipelineStep>(PipelineStep.IDLE);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBypassed, setIsBypassed] = useState(false);
  const [config, setConfig] = useState<ProcessingConfig>({
    denoiseStrength: 75,
    highPrecision: false,
    upscaleFactor: 2,
    targetSampleRate: 48000
  });
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Audio Engine Refs
  const audioService = useRef<AudioService>(new AudioService());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update audio service when config changes
  useEffect(() => {
    audioService.current.setDeepFilterNetConfig(
      config.denoiseStrength / 100,
      config.highPrecision
    );
  }, [config.denoiseStrength, config.highPrecision]);

  // Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep(PipelineStep.UPLOAD);
    
    // Simulate Upload
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        startIngest(file);
      }
    }, 50);
  };

  const startIngest = async (file: File) => {
    setStep(PipelineStep.INGEST);
    setProgress(0);
    
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioService.current.decodeAudio(arrayBuffer);

    setMetadata({
      name: file.name,
      size: file.size,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels
    });

    setStep(PipelineStep.ANALYSIS);
  };

  const runAnalysis = useCallback(() => {
    setStep(PipelineStep.ANALYSIS);
    setProgress(0);
    // Play audio snippet for analysis effect
    audioService.current.play(() => setIsPlaying(false));
    setIsPlaying(true);

    // Simulate analysis time
    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        audioService.current.stop();
        setIsPlaying(false);
        setStep(PipelineStep.DENOISE);
      }
    }, 100); 
  }, []);

  const runDenoise = useCallback(() => {
    setStep(PipelineStep.DENOISE);
    setProgress(0);
    
    // Play with settings
    audioService.current.play(() => setIsPlaying(false));
    setIsPlaying(true);
    
    // Apply initial settings
    audioService.current.setDeepFilterNetConfig(
      config.denoiseStrength / 100,
      config.highPrecision
    );

    // Slower simulation for "DeepFilterNet" processing feeling
    let p = 0;
    const interval = setInterval(() => {
      p += 0.5; // Slower progress
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        audioService.current.stop();
        setIsPlaying(false);
        setStep(PipelineStep.UPSCALE);
      }
    }, 50); 
  }, [config.denoiseStrength, config.highPrecision]);

  const runUpscale = useCallback(async () => {
    setStep(PipelineStep.UPSCALE);
    setProgress(0);

    // This step is pure simulation + offline render preparation
    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        finishPipeline();
      }
    }, 100);
  }, [config]); // Dependency on config to ensure finishPipeline uses latest

  const finishPipeline = async () => {
    // Generate the blob
    const blob = await audioService.current.renderProcessedAudio(
      config.denoiseStrength / 100,
      config.highPrecision
    );
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
    setStep(PipelineStep.COMPLETE);
    setProgress(100);
  };

  const toggleBypass = () => {
    const newState = !isBypassed;
    setIsBypassed(newState);
    audioService.current.toggleBypass(newState);
  };

  // Auto-advance pipeline effect
  useEffect(() => {
    if (step === PipelineStep.ANALYSIS && progress === 0) {
      runAnalysis();
    } else if (step === PipelineStep.DENOISE && progress === 0) {
      runDenoise();
    } else if (step === PipelineStep.UPSCALE && progress === 0) {
      runUpscale();
    }
  }, [step, progress, runAnalysis, runDenoise, runUpscale]);


  return (
    <div className="min-h-screen grid-bg flex flex-col font-sans">
      {/* --- HEADER --- */}
      <header className="w-full bg-white border-b-2 border-black p-6 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">Voxis</h1>
          <div className="flex gap-4 mt-1">
            <span className="text-xs font-bold bg-black text-white px-2 py-0.5">POWERED BY TRINITY</span>
            <span className="text-xs font-bold border border-black px-2 py-0.5">GLASS STONE BUILD</span>
          </div>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-mono">SWISS AUDIO ARCHITECTURE</p>
          <p className="text-xs font-mono">V 1.0.5</p>
        </div>
      </header>

      {/* --- MAIN GRID --- */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: CONTROLS & INFO */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          
          {/* Status Box */}
          <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <CpuChipIcon className="w-5 h-5" />
              Pipeline Status
            </h2>
            <div className="font-mono text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">CURRENT STEP</span>
                <span className="font-bold">{STEP_LABELS[step]}</span>
              </div>
              <div className="w-full bg-gray-200 h-4 border border-black mt-2">
                <div 
                  className="bg-[#ff3333] h-full transition-all duration-100 ease-linear" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-right text-xs mt-1">{progress}% PROCESSED</div>
            </div>
          </div>

          {/* Config Box */}
          <div className="bg-white border-2 border-black p-6">
            <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" />
              Trinity Config
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold uppercase block mb-2">DeepFilterNet Strength</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={config.denoiseStrength}
                    onChange={(e) => setConfig({...config, denoiseStrength: Number(e.target.value)})}
                    disabled={step !== PipelineStep.IDLE && step !== PipelineStep.COMPLETE}
                  />
                  <span className="font-mono text-sm w-12 text-right">{config.denoiseStrength}%</span>
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold uppercase">High Precision Mode</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={config.highPrecision}
                      onChange={(e) => setConfig({...config, highPrecision: e.target.checked})}
                      disabled={step !== PipelineStep.IDLE && step !== PipelineStep.COMPLETE}
                    />
                    <div className={`w-10 h-5 border-2 border-black rounded-full transition-colors ${config.highPrecision ? 'bg-[#ff3333]' : 'bg-gray-200'}`}></div>
                    <div className={`absolute left-0.5 top-0.5 w-3 h-3 bg-white border border-black rounded-full transition-transform ${config.highPrecision ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                </label>
                <p className="text-[10px] text-gray-500 mt-1">
                  Enables advanced masking logic from Rikorose/DeepFilterNet. Increases processing latency.
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="text-xs font-bold uppercase block mb-2">Upscale Factor (AudioSR)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 4].map((factor) => (
                    <button
                      key={factor}
                      onClick={() => setConfig({...config, upscaleFactor: factor})}
                      disabled={step !== PipelineStep.IDLE && step !== PipelineStep.COMPLETE}
                      className={`border border-black py-2 text-xs font-bold uppercase ${config.upscaleFactor === factor ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
                    >
                      {factor}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Box */}
          {metadata && (
             <div className="bg-white border-2 border-black p-6">
               <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 mb-4">Input Metadata</h2>
               <ul className="text-xs font-mono space-y-2">
                 <li className="flex justify-between border-b border-gray-200 pb-1">
                   <span>FILENAME</span>
                   <span className="truncate max-w-[150px]">{metadata.name}</span>
                 </li>
                 <li className="flex justify-between border-b border-gray-200 pb-1">
                   <span>DURATION</span>
                   <span>{metadata.duration.toFixed(2)}s</span>
                 </li>
                 <li className="flex justify-between border-b border-gray-200 pb-1">
                   <span>CHANNELS</span>
                   <span>{metadata.channels}</span>
                 </li>
                 <li className="flex justify-between border-b border-gray-200 pb-1">
                   <span>SAMPLE RATE</span>
                   <span>{metadata.sampleRate} Hz</span>
                 </li>
               </ul>
             </div>
          )}

        </div>

        {/* RIGHT COLUMN: VISUALIZATION & ACTIONS */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* Main Visualizer Area */}
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[500px]">
             <div className="border-b-2 border-black p-4 flex justify-between items-center bg-gray-50">
               <div className="flex items-center gap-2">
                 <div className={`w-3 h-3 rounded-full ${step === PipelineStep.IDLE ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`}></div>
                 <span className="text-xs font-bold uppercase tracking-widest">
                   {step === PipelineStep.COMPLETE ? 'Ready for Export' : 'Live Monitor'}
                 </span>
               </div>
               
               <div className="flex gap-2">
                 {(step === PipelineStep.COMPLETE || step === PipelineStep.DENOISE) && (
                   <button 
                     onClick={toggleBypass}
                     className={`border border-black px-3 py-1 text-xs font-bold uppercase flex items-center gap-1 transition-colors ${isBypassed ? 'bg-yellow-100 text-yellow-800' : 'bg-white hover:bg-gray-100'}`}
                   >
                     {isBypassed ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                     {isBypassed ? 'Effect Bypassed' : 'Visualize Effect'}
                   </button>
                 )}
                 {step === PipelineStep.COMPLETE && (
                    <button 
                      onClick={() => {
                        if (isPlaying) { audioService.current.stop(); setIsPlaying(false); }
                        else { audioService.current.play(() => setIsPlaying(false)); setIsPlaying(true); }
                      }}
                      className="border border-black hover:bg-black hover:text-white px-3 py-1 text-xs font-bold uppercase flex items-center gap-1"
                    >
                      {isPlaying ? <StopIcon className="w-4 h-4"/> : <PlayIcon className="w-4 h-4"/>}
                      {isPlaying ? 'Stop Preview' : 'Preview Result'}
                    </button>
                 )}
               </div>
             </div>

             {/* Spectrum Visualizer */}
             <div className="flex-1 bg-gray-100 flex flex-col justify-center relative">
               <Visualizer 
                  analyser={audioService.current.getAnalyser()} 
                  mode="SPECTRUM" 
                  isPlaying={isPlaying} 
                  color={isBypassed ? "#999" : "#ff3333"}
                />
               <Visualizer 
                  analyser={audioService.current.getAnalyser()} 
                  mode="WAVEFORM" 
                  isPlaying={isPlaying} 
                  color="#000"
                />
                
                {/* Overlay label for Bypass */}
                {isBypassed && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-100 border border-black px-4 py-2 font-mono text-xs font-bold text-yellow-800 pointer-events-none">
                    BYPASS ACTIVE - ORIGINAL SIGNAL
                  </div>
                )}
             </div>
             
             {/* Log Output Simulation */}
             <div className="h-32 bg-black text-green-500 font-mono text-xs p-4 overflow-y-auto border-t-2 border-black">
               <p>{'>'} System initialized. Trinity Engine v4.0.5</p>
               {step !== PipelineStep.IDLE && <p>{'>'} Loading source file...</p>}
               {metadata && <p>{'>'} Detected: {metadata.name} [{metadata.sampleRate}Hz]</p>}
               {step === PipelineStep.ANALYSIS && <p className="animate-pulse">{'>'} Running GitHub:Yazdi9/Audio-Noise-Reduction/spectrum_analysis.py...</p>}
               {step === PipelineStep.DENOISE && (
                 <>
                   <p className="animate-pulse">{'>'} Initializing GitHub:Rikorose/DeepFilterNet...</p>
                   {config.highPrecision && <p className="text-blue-400">{'>'} [DeepFilterNet] High Precision Masking Enabled (latency increased)</p>}
                   <p>{'>'} [DeepFilterNet] Strength: {config.denoiseStrength}% | Denoise Factor: {(config.denoiseStrength/100).toFixed(2)}</p>
                 </>
               )}
               {step === PipelineStep.UPSCALE && <p className="animate-pulse">{'>'} Upscaling via GitHub:ORI-Muchim/AudioSR-Upsampling ({config.upscaleFactor}x)...</p>}
               {step === PipelineStep.COMPLETE && <p>{'>'} Processing complete. Output generated.</p>}
             </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input 
               type="file" 
               accept="audio/*" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleFileSelect}
             />
             
             {step === PipelineStep.IDLE || step === PipelineStep.COMPLETE ? (
               <button 
                 onClick={() => {
                   setStep(PipelineStep.IDLE);
                   setMetadata(null);
                   setDownloadUrl(null);
                   fileInputRef.current?.click();
                 }}
                 className="h-16 border-2 border-black bg-white hover:bg-[#ff3333] hover:text-white transition-colors flex items-center justify-center gap-2 text-lg font-black uppercase tracking-tight"
               >
                 <ArrowUpTrayIcon className="w-6 h-6" />
                 {step === PipelineStep.COMPLETE ? 'Process New File' : 'Upload Source Audio'}
               </button>
             ) : (
                <button disabled className="h-16 border-2 border-gray-400 bg-gray-100 text-gray-400 flex items-center justify-center gap-2 text-lg font-black uppercase tracking-tight cursor-not-allowed">
                  Processing...
                </button>
             )}

             {step === PipelineStep.COMPLETE && downloadUrl ? (
                <a 
                  href={downloadUrl} 
                  download={`voxis_restored_${metadata?.name || 'audio'}.wav`}
                  className="h-16 border-2 border-black bg-black text-white hover:bg-[#ff3333] transition-colors flex items-center justify-center gap-2 text-lg font-black uppercase tracking-tight"
                >
                  <ArrowDownTrayIcon className="w-6 h-6" />
                  Export to Device
                </a>
             ) : (
                <div className="h-16 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold uppercase text-sm">
                  Waiting for output...
                </div>
             )}
          </div>

        </div>

      </main>
    </div>
  );
};

export default App;