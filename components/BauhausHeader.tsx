/**
 * VOXIS 4 Dense — Bauhaus Header
 * Powered by Trinity 8.1 | Built by Glass Stone
 */
import React from 'react';

interface BauhausHeaderProps {
    status: 'online' | 'offline';
}

export const BauhausHeader: React.FC<BauhausHeaderProps> = ({ status }) => {
    return (
        <header className="flex items-center justify-between px-8 py-6 bg-[var(--bg-cream)] border-b-3 border-black">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black flex items-center justify-center transform hover:rotate-12 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" fill="white" />
                        <circle cx="12" cy="12" r="6" fill="black" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter leading-none m-0">
                        VOXIS <span className="text-[var(--primary-red)]">DENSE</span>
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--primary-blue)]">
                        Audio Restoration v4.0 // Trinity 8.1
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white">
                    <div className={`w-3 h-3 rounded-full ${status === 'online' ? 'bg-[var(--primary-green)]' : 'bg-[var(--primary-red)]'}`}
                        style={{ backgroundColor: status === 'online' ? '#00A651' : 'var(--primary-red)' }}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">{status}</span>
                </div>
            </div>
        </header>
    );
};
