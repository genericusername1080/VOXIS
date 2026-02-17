/**
 * VOXIS 4 Dense — Bauhaus Footer
 * Powered by Trinity 8.1 | Built by Glass Stone
 */
import React from 'react';

interface BauhausFooterProps {
    logs?: string[];
    leftText?: string;
    rightText?: string;
}

export const BauhausFooter: React.FC<BauhausFooterProps> = ({
    leftText = "VOXIS 4 DENSE // TRINITY 8.1",
    rightText = "© 2026 GLASS STONE"
}) => {
    return (
        <footer className="bg-[var(--primary-red)] border-t-3 border-black p-4 flex justify-between items-center">
            <div className="text-white font-bold uppercase text-xs tracking-widest">
                {leftText}
            </div>
            <div className="text-black font-mono text-[10px] font-bold">
                {rightText}
            </div>
        </footer>
    );
};
