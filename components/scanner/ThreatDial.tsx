'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScanResult } from '@/lib/types';

const R = 80;
const CX = 100;
const CY = 100;
const CIRCUM = Math.PI * R; // ≈ 251.3

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

  const offset = CIRCUM * (1 - displayed / 100);
  const color = scoreColor(displayed);
  const label = scoreLabel(displayed);

  return (
    <div className="flex flex-col items-center py-4 md:py-6">
      <svg
        viewBox="0 0 200 118"
        className="w-44 md:w-64"
        aria-label={`Threat score: ${displayed} — ${label}`}
      >
        <defs>
          <linearGradient
            id="threatGradient"
            gradientUnits="userSpaceOnUse"
            x1={CX - R} y1={CY}
            x2={CX + R} y2={CY}
          >
            <stop offset="0%" style={{ stopColor: 'var(--clean)' }} />
            <stop offset="45%" style={{ stopColor: 'var(--warning)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--critical)' }} />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 0 ${CX + R} ${CY}`}
          fill="none"
          style={{ stroke: 'var(--track)' }}
          strokeWidth={13}
          strokeLinecap="round"
        />

        {/* Fill arc — gradient, trimmed by dashoffset */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 0 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#threatGradient)"
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUM}`}
          strokeDashoffset={`${offset}`}
        />

        {/* Score number */}
        <text
          x={CX}
          y={CY - 28}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={44}
          fontWeight="bold"
          fill={color}
          fontFamily="var(--font-mono)"
          style={{ transition: 'fill 0.3s ease' }}
        >
          {displayed}
        </text>

        {/* Risk label */}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill={color}
          fontFamily="var(--font-mono)"
          letterSpacing="4"
          style={{ transition: 'fill 0.3s ease' }}
        >
          {label}
        </text>

      </svg>

      <p className="text-xs tracking-widest -mt-1" style={{ color: 'var(--muted)' }}>THREAT SCORE</p>
    </div>
  );
}
