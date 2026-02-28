import React, { useEffect, useRef, useState } from 'react';
import { AudioMetadata } from '../types';

interface BauhausPlayerProps {
    metadata: AudioMetadata;
    audioSrc?: string;
}

export const BauhausPlayer: React.FC<BauhausPlayerProps> = ({ metadata, audioSrc }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(metadata.duration || 0);

    useEffect(() => {
        if (!metadata.duration) return;
        setDuration(metadata.duration);
    }, [metadata.duration]);

    // Initialize Audio Context & Analyzer
    useEffect(() => {
        if (!audioRef.current || !canvasRef.current) return;

        const audio = audioRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let source: MediaElementAudioSourceNode | null = null;
        let animationId: number;

        const initAudio = () => {
            if (!audioContext) {
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 64; // Low resolution for Bauhaus blocky look

                try {
                    source = audioContext.createMediaElementSource(audio);
                    source.connect(analyser);
                    analyser.connect(audioContext.destination);
                } catch (e) {
                    console.warn("MediaElementSource already connected", e);
                }
            }
        };

        const draw = () => {
            if (!analyser || !ctx) return;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            const width = canvas.width;
            const height = canvas.height;
            const barWidth = (width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * height;

                // Bauhaus Colors based on frequency
                if (i < bufferLength / 3) {
                    ctx.fillStyle = 'var(--primary-blue)';
                } else if (i < (bufferLength / 3) * 2) {
                    ctx.fillStyle = 'var(--primary-red)';
                } else {
                    ctx.fillStyle = 'var(--primary-yellow)';
                }

                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }

            animationId = requestAnimationFrame(draw);
        };

        const handlePlay = () => {
            setIsPlaying(true);
            if (!audioContext) initAudio();
            if (audioContext?.state === 'suspended') audioContext.resume();
            draw();
        };

        const handlePause = () => {
            setIsPlaying(false);
            cancelAnimationFrame(animationId);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            cancelAnimationFrame(animationId);
            // Don't close AudioContext to avoid cutting off audio if component remounts quickly
        };
    }, []);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    return (
        <div className="w-full bg-white border-b-3 border-black p-4 flex items-center justify-between shadow-[0px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-4">
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 bg-[var(--primary-yellow)] border-2 border-black flex items-center justify-center hover:bg-[var(--primary-red)] hover:text-white transition-colors cursor-pointer"
                >
                    {isPlaying ? (
                        <div className="flex gap-1">
                            <div className="w-1 h-4 bg-black"></div>
                            <div className="w-1 h-4 bg-black"></div>
                        </div>
                    ) : (
                        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-black border-b-[6px] border-b-transparent ml-1"></div>
                    )}
                </button>

                <div className="overflow-hidden">
                    <div className="font-bold text-sm uppercase tracking-wider truncate max-w-[200px]">{metadata.name}</div>
                    <div className="font-mono text-xs text-gray-500 flex gap-2">
                        <span>{metadata.format?.toUpperCase()}</span>
                        <span>|</span>
                        <span>{(metadata.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                </div>
            </div>

            {/* Visualizer Canvas */}
            <div className="flex-1 mx-8 h-12 flex items-end justify-center bg-[var(--bg-cream)] border border-gray-200 relative">
                <canvas
                    ref={canvasRef}
                    width={300}
                    height={48}
                    className="w-full h-full"
                />
            </div>

            <div className="font-mono text-xs font-bold w-24 text-right">
                {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {duration > 0 ? new Date(duration * 1000).toISOString().substr(14, 5) : "--:--"}
            </div>

            {/* Hidden Audio Element - Source will need to be injected or passed */}
            {/* Note: Since we don't have the URL prop yet, we will put a placeholder or expect it to be passed.
                 To avoid breaking the build, I'll add `src` to the interface now.
             */}
            <audio ref={audioRef} crossOrigin="anonymous" src={audioSrc} />
        </div>
    );
};
