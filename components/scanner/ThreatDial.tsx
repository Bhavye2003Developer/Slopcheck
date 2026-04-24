'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScanResult } from '@/lib/types';

function computeScore(results: ScanResult[]): number {
  const criticals = results.filter(r => r.severity === 'critical').length;
  const highs = results.filter(r => r.severity === 'high').length;
  const mediums = results.filter(r => r.severity === 'medium').length;
  return Math.min(100, criticals * 25 + highs * 8 + mediums * 2);
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--critical)';
  if (score >= 50) return 'var(--orange)';
  if (score >= 25) return 'var(--warning)';
  if (score > 0) return 'var(--warning)';
  return 'var(--clean)';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH RISK';
  if (score >= 25) return 'CAUTION';
  if (score > 0) return 'LOW RISK';
  return 'ALL CLEAR';
}

export default function ThreatDial({ results }: { results: ScanResult[] }) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = computeScore(results);
    let start: number | null = null;
    const duration = 1500;

    function step(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const color = scoreColor(displayed);
  const label = scoreLabel(displayed);

  return (
    <div className="flex flex-col items-center py-4 md:py-6">
      <p
        className="font-bold leading-none"
        style={{ fontSize: 72, color, fontFamily: 'var(--font-mono)', transition: 'color 0.3s ease' }}
      >
        {displayed}
      </p>
      <p
        className="text-xs tracking-widest mt-1"
        style={{ color, fontFamily: 'var(--font-mono)', transition: 'color 0.3s ease', letterSpacing: '0.25em' }}
      >
        {label}
      </p>
      <p className="text-xs tracking-widest mt-2" style={{ color: 'var(--muted)' }}>THREAT SCORE</p>
    </div>
  );
}
