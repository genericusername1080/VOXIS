import React from 'react';

interface BauhausHeaderProps {
    status: 'online' | 'offline';
    onToggleSidebar?: () => void;
}

export const BauhausHeader: React.FC<BauhausHeaderProps> = ({ status, onToggleSidebar }) => {
    return (
        <header className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 bg-[var(--bg-cream)] border-b-3 border-black">
            <div className="flex items-center gap-3 sm:gap-4">
                {/* Mobile Menu Toggle */}
                <button
                    onClick={onToggleSidebar}
                    className="lg:hidden w-10 h-10 bg-black flex items-center justify-center hover:bg-[var(--primary-blue)] transition-colors"
                    aria-label="Toggle controls"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect y="3" width="20" height="2.5" fill="white" />
                        <rect y="9" width="20" height="2.5" fill="white" />
                        <rect y="15" width="20" height="2.5" fill="white" />
                    </svg>
                </button>

                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black flex items-center justify-center transform hover:rotate-12 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" fill="white" />
                        <circle cx="12" cy="12" r="6" fill="black" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tighter leading-none m-0">
                        VOXIS <span className="text-[var(--primary-red)]">DENSE</span>
                    </h1>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[var(--primary-blue)]">
                        Audio Restoration v4.0.0 | by Glass Stone
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-black bg-white">
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${status === 'online' ? 'bg-[var(--primary-green)]' : 'bg-[var(--primary-red)]'}`}
                        style={{ backgroundColor: status === 'online' ? '#00A651' : 'var(--primary-red)' }}
                    />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{status}</span>
                </div>
            </div>
        </header>
    );
};
