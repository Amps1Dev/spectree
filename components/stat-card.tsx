'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Zap, FileText, MessageCircle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: 'activity' | 'zap' | 'file' | 'message';
  loading?: boolean;
}

const iconMap = {
  activity: Activity,
  zap: Zap,
  file: FileText,
  message: MessageCircle,
};

// Count from 0 up to `target` on mount / whenever it changes, so the figures
// animate in. Honours prefers-reduced-motion by snapping straight to the value.
function useCountUp(target: number, duration = 700): number {
  const [n, setN] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target === 0) {
      setN(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setN(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return n;
}

export default function StatCard({ title, value, icon, loading }: StatCardProps) {
  const Icon = iconMap[icon];
  const display = useCountUp(value);

  return (
    <div className="spectre-card spectre-card-interactive p-6 group animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-spectre-muted text-sm font-medium mb-2">{title}</p>
          {loading ? <div aria-label="Loading count" className="h-10 w-20 rounded bg-spectre-border animate-pulse" /> : <p className="text-4xl font-bold text-spectre-accent tabular-nums">
            {display}
          </p>}
        </div>
        <div className="p-2 bg-spectre-accent/10 rounded-lg transition-transform duration-200 group-hover:scale-110">
          <Icon size={24} className="text-spectre-accent" />
        </div>
      </div>
    </div>
  );
}
