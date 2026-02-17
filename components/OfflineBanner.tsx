import React from 'react';

interface OfflineBannerProps {
  show: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="px-8 py-2 bg-[var(--primary-red)] text-white font-mono text-xs font-bold text-center tracking-wider uppercase">
      Backend offline — reconnecting...
    </div>
  );
};
