/**
 * VOXIS 4 Dense — Bauhaus Sidebar
 * Powered by Trinity 8.1 | Built by Glass Stone
 */
import React from 'react';
import { ProcessingConfig, ProcessingMode } from '../types';

interface BauhausSidebarProps {
    config: ProcessingConfig;
    setConfig: (config: ProcessingConfig) => void;
    logs: string[];
    isDisabled: boolean;
}

export const BauhausSidebar: React.FC<BauhausSidebarProps> = ({ config, setConfig, logs, isDisabled }) => {
    return (
        <aside className="w-full h-full bg-[var(--bg-cream)] border-r-3 border-black flex flex-col overflow-y-auto">
            <div className="p-6 border-b-3 border-black bg-[var(--primary-blue)]">
                <h2 className="text-white text-xl font-black uppercase tracking-widest">Controls</h2>
            </div>

            {/* Mode Selection */}
            <div className="p-6 border-b-3 border-black">
                <label className="block text-sm font-bold uppercase mb-4">Processing Mode</label>
                <div className="flex flex-col gap-3">
                    {(['quick', 'standard', 'extreme'] as ProcessingMode[]).map((m) => (
                        <button
                            key={m}
                            className={`p-3 font-bold uppercase border-3 border-black transition-all ${config.mode === m
                                    ? 'bg-[var(--primary-red)] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-1 -translate-y-1'
                                    : 'bg-white hover:bg-[var(--grey-200)]'
                                }`}
                            onClick={() => setConfig({ ...config, mode: m })}
                            disabled={isDisabled}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* Denoise Strength */}
            <div className="p-6 border-b-3 border-black">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold uppercase">Denoise Strength</label>
                    <span className="font-mono font-bold text-[var(--primary-red)]">{config.denoiseStrength}%</span>
                </div>
                <input
                    type="range" min="0" max="100"
                    value={config.denoiseStrength}
                    onChange={e => setConfig({ ...config, denoiseStrength: Number(e.target.value) })}
                    disabled={isDisabled}
                    className="w-full h-4 bg-white border-2 border-black rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-[var(--primary-yellow)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                />
            </div>

            {/* Toggles */}
            <div className="p-6 border-b-3 border-black space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase">High Precision</label>
                    <button
                        className={`w-12 h-6 border-2 border-black flex items-center p-1 transition-colors ${config.highPrecision ? 'bg-[var(--primary-green)]' : 'bg-white'}`}
                        style={{ backgroundColor: config.highPrecision ? '#00A651' : 'white' }}
                        onClick={() => setConfig({ ...config, highPrecision: !config.highPrecision })}
                        disabled={isDisabled}
                    >
                        <div className={`w-4 h-4 bg-black transform transition-transform ${config.highPrecision ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase">Stereo Output</label>
                    <button
                        className={`w-12 h-6 border-2 border-black flex items-center p-1 transition-colors ${config.targetChannels === 2 ? 'bg-[var(--primary-blue)]' : 'bg-white'}`}
                        onClick={() => setConfig({ ...config, targetChannels: config.targetChannels === 2 ? 1 : 2 })}
                        disabled={isDisabled}
                    >
                        <div className={`w-4 h-4 bg-black transform transition-transform ${config.targetChannels === 2 ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            {/* Logs */}
            <div className="flex-1 p-6 bg-black text-[var(--primary-yellow)] font-mono text-xs overflow-y-auto min-h-[200px]">
                <div className="mb-2 uppercase font-bold tracking-widest border-b border-[var(--primary-yellow)] pb-1">System Log</div>
                {logs.map((log, i) => (
                    <div key={i} className="mb-1">{`> ${log}`}</div>
                ))}
            </div>
        </aside>
    );
};
