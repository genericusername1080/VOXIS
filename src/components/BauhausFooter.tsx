import React from 'react';

interface BauhausFooterProps {
    logs?: string[];
    leftText?: string;
    rightText?: string;
}

export const BauhausFooter: React.FC<BauhausFooterProps> = ({
    leftText = "VOXIS 4.0.0 // TRINITY v8.1",
    rightText = "© 2026 GLASS STONE"
}) => {
    return (
        <footer className="bg-[var(--primary-red)] border-t-3 border-black px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 flex justify-between items-center animate-fade-in">
            <div className="text-white font-bold uppercase text-[10px] sm:text-xs tracking-widest">
                {leftText}
            </div>
            <div className="text-black font-mono text-[9px] sm:text-[10px] font-bold">
                {rightText}
            </div>
        </footer>
    );
};
