import React from 'react';

interface BauhausCardProps {
    children: React.ReactNode;
    title?: string;
    className?: string;
    color?: 'cream' | 'white' | 'blue' | 'yellow';
}

export const BauhausCard: React.FC<BauhausCardProps> = ({
    children,
    title,
    className = '',
    color = 'white'
}) => {
    const bgColors = {
        cream: 'var(--bg-cream)',
        white: 'var(--white)',
        blue: 'var(--primary-blue)',
        yellow: 'var(--primary-yellow)'
    };

    return (
        <div
            className={`relative p-6 border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-300 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] ${className}`}
            style={{
                backgroundColor: bgColors[color],
                border: '3px solid var(--charcoal)'
            }}
        >
            {title && (
                <div className="absolute -top-4 left-4 bg-black text-white px-3 py-1 text-sm font-bold uppercase tracking-widest transform -rotate-1">
                    {title}
                </div>
            )}
            {children}
        </div>
    );
};
