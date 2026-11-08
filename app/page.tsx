'use client';

import { CSSProperties, PointerEvent, useRef, useState } from 'react';
import { useOfflineMode } from '@/hooks/useOfflineMode';

function EyebrowWord({ word, last = false }: { word: string; last?: boolean }) {
  const boundsRef = useRef<HTMLSpanElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  const trackCursor = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = boundsRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTilt({
      x: -((event.clientY - bounds.top) / bounds.height - 0.5) * 24,
      y: ((event.clientX - bounds.left) / bounds.width - 0.5) * 28,
      active: true,
    });
  };

  return (
    <span className={`hero-eyebrow-group ${tilt.active ? 'is-active' : ''}`}>
      <span
        ref={boundsRef}
        className="hero-word-hitbox"
        onPointerEnter={trackCursor}
        onPointerMove={trackCursor}
        onPointerLeave={() => setTilt({ x: 0, y: 0, active: false })}
      >
        <span
          className="hero-eyebrow-word"
          style={{
            transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${tilt.active ? -4 : 0}px)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {word}<span className={last ? 'hero-last-dot' : undefined}>.</span>
        </span>
      </span>
      {!last && <span className="hero-eyebrow-dot" aria-hidden="true">•</span>}
    </span>
  );
}

export default function HomePage() {
  const { offline } = useOfflineMode();
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const flipped = hovered || revealed;

  return (
    <section className="spectre-home" aria-label="Welcome to SPECTRE">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-composition">
        <p className="hero-eyebrow" aria-label="Scan. Reason. Report.">
          <EyebrowWord word="SCAN" />
          <EyebrowWord word="REASON" />
          <EyebrowWord word="REPORT" last />
        </p>

        <h1 className="hero-heading">
          <span className="sr-only">SPECTRE</span>
          <button
            type="button"
            className="hero-flip-card"
            aria-label="SPECTRE. Created & maintained by Sir Amps. Toggle credits"
            aria-pressed={flipped}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setHovered(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') {
                setHovered(false);
                setRevealed(false);
              }
            }}
            onClick={() => setRevealed((current) => !current)}
            onBlur={() => setRevealed(false)}
          >
            <span
              className="hero-flip-inner"
              style={{
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transformStyle: 'preserve-3d',
              }}
              aria-hidden="true"
            >
              <span className="hero-face hero-front">SPECTRE</span>
              <span className="hero-face hero-back">
                <span>Created &amp; maintained by</span>
                <span className="hero-creator">Sir Amps.</span>
              </span>
            </span>
          </button>
        </h1>

        <div className="hero-rule" />
        <p className="hero-subtitle">Penetration testing, in one workspace.</p>
      </div>

      <footer className="hero-footer">
        <p>LLM-POWERED PENTEST DASHBOARD</p>
        <span
          className="hero-status"
          style={offline ? { '--status-color': 'var(--text-muted)', '--status-rgb': 'var(--text-muted-rgb)' } as CSSProperties : undefined}
          role="status"
        >
          <span className="hero-status-dot" aria-hidden="true" />
          {offline ? 'OFFLINE' : 'ONLINE'}
        </span>
      </footer>

      <style jsx>{`
        .hero-flip-inner {
          display: block;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
        }
        .hero-face {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          color: var(--accent);
          font-family: var(--font-display);
          font-weight: 400;
        }
        .hero-back {
          flex-direction: column;
          gap: 0.12em;
          transform: rotateY(180deg);
          font-size: 0.22em;
          letter-spacing: 0.015em;
          line-height: 1.15;
        }
        .hero-creator {
          font-size: 2.8em;
          line-height: 1.12;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-flip-inner { transition: none; }
        }
      `}</style>
    </section>
  );
}
