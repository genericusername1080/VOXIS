/**
 * VOXIS 4 Dense — Bauhaus Player
 * Powered by Trinity 8.1 | Built by Glass Stone
 */
import React from 'react';
import { AudioMetadata } from '../types';

interface BauhausPlayerProps {
    metadata: AudioMetadata;
}

export const BauhausPlayer: React.FC<BauhausPlayerProps> = ({ metadata }) => {
    return (
        <div className="w-full bg-white border-b-3 border-black p-4 flex items-center justify-between shadow-[0px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[var(--primary-yellow)] border-2 border-black flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-black border-b-[6px] border-b-transparent ml-1"></div>
                </div>
                <div>
                    <div className="font-bold text-sm uppercase tracking-wider truncate max-w-[300px]">{metadata.name}</div>
                    <div className="font-mono text-xs text-gray-500">
                        {metadata.format?.toUpperCase()} | {(metadata.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                </div>
            </div>

            {/* Visualizer Placeholder */}
            <div className="flex-1 mx-8 h-8 flex items-end gap-1 opacity-50">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="w-full bg-[var(--primary-blue)]"
                        style={{ height: `${Math.random() * 100}%` }}
                    />
                ))}
            </div>

            <div className="font-mono text-xs font-bold">
                {metadata.duration > 0 ? new Date(metadata.duration * 1000).toISOString().substr(14, 5) : "--:--"}
            </div>
        </div>
    );
};
