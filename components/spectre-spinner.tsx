'use client';

import { CSSProperties } from 'react';

interface SpectreSpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

const DURATION = 1;

export default function SpectreSpinner({
  size = 32,
  label = 'Loading',
  className = '',
}: SpectreSpinnerProps) {
  return (
    <span
      className={`spectre-spinner inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={!label || undefined}
    >
      <svg viewBox="0 0 40 40" width="100%" height="100%" fill="none" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 45} 20 20)`}>
            <path
              className="spectre-chevron"
              d="M16.5 8.5 20 4.5 23.5 8.5"
              stroke="var(--accent)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                '--tick-delay': `${i * (DURATION / 8)}s`,
                '--tick-opacity': 1 - i * 0.115,
              } as CSSProperties}
            />
          </g>
        ))}
      </svg>
      <style jsx>{`
        .spectre-chevron {
          opacity: var(--tick-opacity);
          animation: spectre-chevron-fade ${DURATION}s linear infinite;
          animation-delay: var(--tick-delay);
        }
        @keyframes spectre-chevron-fade {
          0%, 100% { opacity: 1; }
          12.5% { opacity: 0.8; }
          87.5% { opacity: 0.08; }
        }
        @media (prefers-reduced-motion: reduce) {
          .spectre-chevron { animation: none; }
        }
      `}</style>
    </span>
  );
}
