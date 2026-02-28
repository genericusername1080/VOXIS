import React, { useRef, useState, useEffect } from 'react';
import { ProcessingConfig } from '../types';
import { BauhausCard } from './BauhausCard';
import { BauhausButton } from './BauhausButton';

interface CompletionPanelProps {
  config: ProcessingConfig;
  downloadUrl: string | null;
  onReset: () => void;
  originalName?: string;
}

export const CompletionPanel: React.FC<CompletionPanelProps> = ({ config, downloadUrl, onReset, originalName }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState(false);

  const getDownloadName = (fmt: string) => {
    if (!originalName) return `audio-voxis.${fmt}`;
    const key = originalName.replace(/\.[^/.]+$/, "");
    return `${key}-voxis.${fmt}`;
  };

  const playbackUrl = downloadUrl
    ? `${downloadUrl.split('?')[0]}?format=${config.outputFormat}&quality=high`
    : undefined;

  // Audio visualizer
  useEffect(() => {
    if (!audioRef.current || !canvasRef.current) return;
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let animationId: number;

    const initAudio = () => {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        try {
          const source = audioContext.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
        } catch (e) { /* already connected */ }
      }
    };

    const draw = () => {
      if (!analyser || !ctx) return;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      const w = canvas.width, h = canvas.height;
      const barW = (w / bufferLength) * 2.5;
      let x = 0;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < bufferLength; i++) {
        const barH = (dataArray[i] / 255) * h;
        ctx.fillStyle = i < bufferLength / 3 ? '#003DA6' : i < (bufferLength / 3) * 2 ? '#E3342F' : '#FFD500';
        ctx.fillRect(x, h - barH, barW, barH);
        x += barW + 2;
      }
      animationId = requestAnimationFrame(draw);
    };

    const onPlay = () => { setIsPlaying(true); if (!audioContext) initAudio(); audioContext?.state === 'suspended' && audioContext.resume(); draw(); };
    const onPause = () => { setIsPlaying(false); cancelAnimationFrame(animationId); };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (!playbackUrl) return;
    const a = document.createElement('a');
    a.href = playbackUrl;
    a.download = getDownloadName(config.outputFormat);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <BauhausCard className="w-full max-w-2xl flex flex-col items-center p-10 bg-white animate-slide-up">
      {/* Success Badge */}
      <div className="w-14 h-14 rounded-full bg-[#00A651] border-3 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div className="text-2xl font-black uppercase tracking-tight mb-1">Restoration Complete</div>
      <div className="font-mono text-xs text-[var(--grey-600)] mb-6">
        {config.targetSampleRate / 1000}kHz / {config.targetChannels === 2 ? 'Stereo' : 'Mono'} / {config.outputFormat.toUpperCase()}
      </div>

      {/* Inline Audio Player */}
      <div className="w-full bg-[var(--bg-cream)] border-3 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={togglePlay}
            disabled={!playbackUrl}
            className="w-10 h-10 bg-[var(--primary-yellow)] border-2 border-black flex items-center justify-center hover:bg-[var(--primary-red)] hover:text-white transition-colors cursor-pointer flex-shrink-0 disabled:opacity-40"
          >
            {isPlaying ? (
              <div className="flex gap-1">
                <div className="w-1.5 h-4 bg-black"></div>
                <div className="w-1.5 h-4 bg-black"></div>
              </div>
            ) : (
              <div className="w-0 h-0 border-t-[7px] border-t-transparent border-l-[11px] border-l-black border-b-[7px] border-b-transparent ml-1"></div>
            )}
          </button>

          <div className="flex-1 flex flex-col gap-1.5">
            <div className="font-bold text-xs uppercase tracking-wider truncate">
              {originalName || 'VOXIS Output'} — REMASTERED
            </div>
            {/* Seekable progress bar */}
            <div className="w-full h-2 bg-white border border-black cursor-pointer relative" onClick={seek}>
              <div
                className="h-full bg-[var(--primary-blue)] transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="font-mono text-[10px] font-bold text-[var(--grey-600)] w-20 text-right flex-shrink-0">
            {fmt(currentTime)} / {duration > 0 ? fmt(duration) : '--:--'}
          </div>
        </div>

        {/* Visualizer */}
        <div className="w-full h-10 bg-white border border-gray-200">
          <canvas ref={canvasRef} width={400} height={40} className="w-full h-full" />
        </div>
      </div>

      {/* FORMAT SELECTOR */}
      <div className="w-full mb-6">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--grey-500)] mb-2 text-center">Export Format</div>
        <div className="flex border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {['wav', 'flac', 'mp3'].map((f, i) => {
            const url = downloadUrl ? `${downloadUrl.split('?')[0]}?format=${f}&quality=high` : '#';
            return (
              <a
                key={f}
                href={url}
                download={getDownloadName(f)}
                className={`flex-1 py-2.5 text-center font-bold uppercase text-sm hover:bg-black hover:text-[var(--primary-yellow)] transition-colors ${i < 2 ? 'border-r-2 border-black' : ''} ${f === config.outputFormat ? 'bg-[var(--primary-yellow)]' : 'bg-white'}`}
              >
                {f}
              </a>
            );
          })}
        </div>
      </div>

      {/* SAVE & RESET BUTTONS */}
      <div className="flex w-full gap-3 mb-4">
        <button
          onClick={handleSave}
          disabled={!playbackUrl}
          className={`flex-1 py-3 font-black uppercase text-sm border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none ${saved ? 'bg-[#00A651] text-white' : 'bg-[var(--primary-red)] text-white'}`}
        >
          {saved ? '✓ SAVED' : `SAVE ${config.outputFormat.toUpperCase()}`}
        </button>
        <button
          onClick={onReset}
          className="flex-1 py-3 font-bold uppercase text-sm border-3 border-black bg-white hover:bg-[var(--bg-cream)] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          New File
        </button>
      </div>

      <audio ref={audioRef} crossOrigin="anonymous" src={playbackUrl} />
    </BauhausCard>
  );
};
