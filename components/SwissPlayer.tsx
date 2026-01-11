import React from 'react';
import { AudioMetadata } from '../types';

interface SwissPlayerProps {
  isPlaying: boolean;
  togglePlay: () => void;
  metadata: AudioMetadata | null;
  currentTime: number;
  duration: number;
}

export const SwissPlayer: React.FC<SwissPlayerProps> = ({ 
  isPlaying, togglePlay, metadata, currentTime, duration 
}) => {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="player">
      <button className="play-btn" onClick={togglePlay}>
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div className="player-info">
        <div style={{ marginBottom: 4 }}>{metadata?.name || 'Audio'}</div>
        <div className="player-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <style>{`
        .player {
          padding: 16px 24px; background: #000; color: #fff;
          display: flex; align-items: center; gap: 16px;
          margin: 0 24px 24px; border: 4px solid #000;
        }
        .play-btn {
          width: 48px; height: 48px; background: #ff3300;
          border: none; color: #fff; font-size: 20px;
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
        }
        .play-btn:hover { background: #fff; color: #000; }
        .player-info {
          flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 11px;
        }
        .player-time { font-weight: 700; }
      `}</style>
    </div>
  );
};
