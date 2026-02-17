import React from 'react';

interface BauhausButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'accent';
    icon?: React.ReactNode;
}

export const BauhausButton: React.FC<BauhausButtonProps> = ({
    children,
    variant = 'primary',
    icon,
    className = '',
    ...props
}) => {
    const baseStyle = "font-bold uppercase tracking-wider px-6 py-3 border-3 border-black transition-all transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-[var(--primary-red)] text-white hover:bg-[var(--primary-red)]",
        secondary: "bg-[var(--primary-blue)] text-white hover:bg-[var(--primary-blue)]",
        accent: "bg-[var(--primary-yellow)] text-black hover:bg-[var(--primary-yellow)]",
    };

    return (
        <button
            className={`${baseStyle} ${variants[variant]} ${className}`}
            style={{ border: '3px solid var(--charcoal)' }}
            {...props}
        >
            {icon && <span className="text-lg">{icon}</span>}
            {children}
        </button>
    );
};
