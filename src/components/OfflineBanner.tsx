import React from 'react';

interface OfflineBannerProps {
  show: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="offline-banner">
      Backend offline — reconnecting...
      <style>{`
        .offline-banner {
          padding: 8px var(--space-xl);
          background: var(--red); color: var(--white);
          font-family: var(--font-mono); font-size: 11px;
          font-weight: 700; text-align: center;
          letter-spacing: 1px;
        }
      `}</style>
    </div>
  );
};
