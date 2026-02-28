import React from 'react';
import { ProcessingConfig } from '../types';

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

            {/* Engine Info */}
            <div className="p-6 border-b-3 border-black">
                <label className="block text-sm font-bold uppercase mb-1">Engine</label>
                <p className="text-[10px] text-[var(--grey-600)] mb-3 leading-tight">
                    Trinity v8.1 — All models always active. Transformer + Diffusion unified restoration for maximum audio quality.
                </p>
                <div className="p-3 font-bold uppercase border-3 border-black bg-[var(--primary-red)] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-1 -translate-y-1 text-center">
                    ALWAYS ON — MAX QUALITY
                </div>
            </div>

            {/* Upscale Factor */}
            <div className="p-6 border-b-3 border-black">
                <label className="block text-sm font-bold uppercase mb-1">Upscale Factor</label>
                <p className="text-[10px] text-[var(--grey-600)] mb-3 leading-tight">
                    Neural super-resolution multiplier. 1x = no upscale,  2x = double sample rate, 4x = maximum fidelity.
                </p>
                <div className="flex gap-2">
                    {[1, 2, 4].map((f) => (
                        <button
                            key={f}
                            className={`flex-1 p-2 font-bold border-2 border-black transition-all ${config.upscaleFactor === f
                                ? 'bg-[var(--primary-blue)] text-white'
                                : 'bg-white hover:bg-[var(--grey-200)]'
                                }`}
                            onClick={() => setConfig({ ...config, upscaleFactor: f })}
                            disabled={isDisabled}
                        >
                            {f}x
                        </button>
                    ))}
                </div>
            </div>


            {/* Output Format */}
            <div className="p-6 border-b-3 border-black">
                <label className="block text-sm font-bold uppercase mb-1">Output Format</label>
                <p className="text-[10px] text-[var(--grey-600)] mb-3 leading-tight">
                    WAV: uncompressed, highest quality. FLAC: lossless compression. MP3: smaller file, lossy.
                </p>
                <div className="flex gap-2">
                    {['wav', 'flac', 'mp3'].map((fmt) => (
                        <button
                            key={fmt}
                            className={`flex-1 p-2 font-bold uppercase border-2 border-black transition-all ${config.outputFormat === fmt
                                ? 'bg-[var(--primary-yellow)] text-black'
                                : 'bg-white hover:bg-[var(--grey-200)]'
                                }`}
                            onClick={() => setConfig({ ...config, outputFormat: fmt as any })}
                            disabled={isDisabled}
                        >
                            {fmt}
                        </button>
                    ))}
                </div>
            </div>

            {/* Denoise Strength & Profile */}
            <div className="p-6 border-b-3 border-black">
                <div className="flex justify-between mb-1">
                    <label className="text-sm font-bold uppercase">Denoise Strength</label>
                    <span className="font-mono font-bold text-[var(--primary-red)]">{config.denoiseStrength}%</span>
                </div>
                <p className="text-[10px] text-[var(--grey-600)] mb-2 leading-tight">
                    How aggressively noise is removed. Higher values clean more but may affect audio detail.
                </p>
                <input
                    type="range" min="0" max="100"
                    value={config.denoiseStrength}
                    onChange={e => setConfig({ ...config, denoiseStrength: Number(e.target.value) })}
                    disabled={isDisabled}
                    className="w-full h-4 bg-white border-2 border-black rounded-none appearance-none cursor-pointer mb-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-[var(--primary-yellow)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                />

                <label className="block text-sm font-bold uppercase mb-1">Noise Profile</label>
                <p className="text-[10px] text-[var(--grey-600)] mb-2 leading-tight">
                    Auto detects noise type automatically. Gentle preserves more detail. Aggressive removes maximum noise.
                </p>
                <select
                    value={config.noiseProfile}
                    onChange={(e) => setConfig({ ...config, noiseProfile: e.target.value as any })}
                    disabled={isDisabled}
                    className="w-full p-2 border-2 border-black font-bold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-yellow)]"
                >
                    <option value="auto">Auto (Smart)</option>
                    <option value="gentle">Gentle</option>
                    <option value="aggressive">Aggressive</option>
                </select>
            </div>

            {/* Trinity Restore Controls — Always visible */}
            <div className="p-6 border-b-3 border-black bg-[var(--grey-100)]">
                <div className="mb-5">
                    <div className="flex justify-between mb-1">
                        <label className="text-xs font-bold uppercase text-[var(--primary-red)]">Restoration Steps</label>
                        <span className="font-mono font-bold">{config.voicerestoreSteps}</span>
                    </div>
                    <p className="text-[10px] text-[var(--grey-600)] mb-2 leading-tight">
                        Number of diffusion iterations for neural reconstruction. Higher values produce more detailed restoration but take longer to process.
                    </p>
                    <input
                        type="range" min="4" max="64" step="4"
                        value={config.voicerestoreSteps || 32}
                        onChange={e => setConfig({ ...config, voicerestoreSteps: Number(e.target.value) })}
                        disabled={isDisabled}
                        className="w-full h-4 bg-white border-2 border-black rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--primary-red)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                    />
                    <div className="flex justify-between mt-1">
                        <span className="text-[9px] font-mono text-[var(--grey-500)]">4 — Fast</span>
                        <span className="text-[9px] font-mono text-[var(--grey-500)]">64 — Maximum</span>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between mb-1">
                        <label className="text-xs font-bold uppercase text-[var(--primary-red)]">Generation Guidance</label>
                        <span className="font-mono font-bold">{config.voicerestoreCfg?.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-[var(--grey-600)] mb-2 leading-tight">
                        Controls how closely the AI follows the original signal. Lower values allow more creative reconstruction; higher values stay faithful to the source.
                    </p>
                    <input
                        type="range" min="0.1" max="2.0" step="0.1"
                        value={config.voicerestoreCfg || 0.5}
                        onChange={e => setConfig({ ...config, voicerestoreCfg: Number(e.target.value) })}
                        disabled={isDisabled}
                        className="w-full h-4 bg-white border-2 border-black rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--primary-red)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                    />
                    <div className="flex justify-between mt-1">
                        <span className="text-[9px] font-mono text-[var(--grey-500)]">0.1 — Creative</span>
                        <span className="text-[9px] font-mono text-[var(--grey-500)]">2.0 — Faithful</span>
                    </div>
                </div>
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
        </aside >
    );
};
