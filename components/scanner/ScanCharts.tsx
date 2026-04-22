'use client';

import { useState } from 'react';
import type { ScanResult, Severity } from '@/lib/types';

const SEV_COLOR: Record<Severity, string> = {
  critical: '#ff4444',
  high:     '#ff7700',
  medium:   '#ffaa00',
  clean:    '#22ff88',
  unsupported: '#555',
};

// ─── Severity Donut ──────────────────────────────────────────────────────────

function SeverityDonut({ results }: { results: ScanResult[] }) {
  const total = results.length;
  if (total === 0) return null;

  const segments = ([
    { key: 'critical'    as Severity, label: 'CRITICAL', color: '#ff4444', count: results.filter(r => r.severity === 'critical').length },
    { key: 'high'        as Severity, label: 'HIGH',     color: '#ff7700', count: results.filter(r => r.severity === 'high').length },
    { key: 'medium'      as Severity, label: 'MEDIUM',   color: '#ffaa00', count: results.filter(r => r.severity === 'medium').length },
    { key: 'clean'       as Severity, label: 'CLEAN',    color: '#22ff88', count: results.filter(r => r.severity === 'clean').length },
    { key: 'unsupported' as Severity, label: 'N/A',      color: '#444',    count: results.filter(r => r.severity === 'unsupported').length },
  ]).filter(s => s.count > 0);

  const R  = 42;
  const SW = 13;
  const SZ = 110;
  const cx = SZ / 2;
  const cy = SZ / 2;
  const C  = 2 * Math.PI * R;

  let cumulative = 0;
  const arcs = segments.map(seg => {
    const dash   = (seg.count / total) * C;
    const offset = C * 0.25 - cumulative;
    cumulative  += dash;
    return { ...seg, dash, offset };
  });

  return (
    <div>
      <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>RISK BREAKDOWN</p>
      <div className="flex items-center gap-5 flex-wrap">
        <svg width={SZ} height={SZ} style={{ flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1c1c1c" strokeWidth={SW} />
          {arcs.map(a => (
            <circle
              key={a.key}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={SW}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
          <text x={cx} y={cy - 6}  textAnchor="middle" fontSize={18} fontWeight="bold" fill="var(--fg)">{total}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8}  fill="#555" letterSpacing="1">PKGS</text>
        </svg>

        <div className="flex flex-col gap-2">
          {arcs.map(a => (
            <div key={a.key} className="flex items-center gap-2 text-xs">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#666', letterSpacing: '0.08em' }}>
                {a.label}
              </span>
              <span style={{ color: a.color, fontWeight: 'bold' }}>{a.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Risk Scatter ─────────────────────────────────────────────────────────────

interface ScatterPoint {
  name: string;
  ageDays: number;
  downloads: number;
  severity: Severity;
  hasCve: boolean;
}

function fmtAge(days: number): string {
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function fmtDl(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function RiskScatter({ results }: { results: ScanResult[] }) {
  const [tip, setTip] = useState<{ p: ScatterPoint; x: number; y: number } | null>(null);

  const points: ScatterPoint[] = results
    .filter(r => r.meta.exists && r.meta.createdAt && r.meta.monthlyDownloads !== undefined)
    .map(r => ({
      name:     r.package.name,
      ageDays:  Math.floor((Date.now() - new Date(r.meta.createdAt!).getTime()) / 86_400_000),
      downloads: r.meta.monthlyDownloads!,
      severity:  r.severity,
      hasCve:   (r.cves?.length ?? 0) > 0,
    }));

  if (points.length < 2) return null;

  const W   = 460;
  const H   = 180;
  const PAD = { top: 12, right: 16, bottom: 32, left: 48 };
  const pw  = W - PAD.left - PAD.right;
  const ph  = H - PAD.top  - PAD.bottom;

  const maxAge = Math.max(...points.map(p => p.ageDays), 365);
  const maxLog = Math.log10(Math.max(...points.map(p => p.downloads + 1), 100));

  const xPos = (d: number) => PAD.left + (Math.min(d, maxAge) / maxAge) * pw;
  const yPos = (d: number) => PAD.top  + ph - (Math.log10(d + 1) / maxLog) * ph;

  const yTicks = [1, 100, 1_000, 10_000, 100_000, 1_000_000].filter(v => Math.log10(v + 1) <= maxLog + 0.1);
  const xTicks = [0, 90, 180, 365, 730, 1_825, 3_650].filter(v => v <= maxAge);

  return (
    <div className="scatter-container" style={{ position: 'relative' }}>
      <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
        RISK SCATTER <span style={{ color: '#444', letterSpacing: 0 }}> age vs downloads</span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setTip(null)}
      >
        {/* Grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={yPos(v)} x2={PAD.left + pw} y2={yPos(v)} stroke="#181818" strokeWidth={1} />
            <text x={PAD.left - 5} y={yPos(v) + 3} textAnchor="end" fontSize={8} fill="#444">{fmtDl(v)}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={v}>
            <line x1={xPos(v)} y1={PAD.top} x2={xPos(v)} y2={PAD.top + ph} stroke="#181818" strokeWidth={1} />
            <text x={xPos(v)} y={PAD.top + ph + 13} textAnchor="middle" fontSize={8} fill="#444">{fmtAge(v)}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke="#2a2a2a" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke="#2a2a2a" strokeWidth={1} />

        {/* Axis labels */}
        <text x={PAD.left + pw / 2} y={H - 4} textAnchor="middle" fontSize={8} fill="#555" letterSpacing="1">PACKAGE AGE</text>
        <text
          x={9} y={PAD.top + ph / 2}
          textAnchor="middle" fontSize={8} fill="#555" letterSpacing="1"
          transform={`rotate(-90,9,${PAD.top + ph / 2})`}
        >DL/MO</text>

        {/* Points */}
        {points.map(p => {
          const px = xPos(p.ageDays);
          const py = yPos(p.downloads);
          const color = SEV_COLOR[p.severity];
          return (
            <g key={p.name}>
              {p.hasCve && (
                <circle cx={px} cy={py} r={9} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
              )}
              <circle
                cx={px} cy={py} r={5}
                fill={color} fillOpacity={0.82}
                stroke={color} strokeWidth={0.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => {
                  const svg  = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTip({ p, x: rect.left - svg.left + 10, y: rect.top - svg.top - 48 });
                }}
              />
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          style={{
            position: 'absolute',
            left: tip.x,
            top: tip.y,
            background: '#111',
            border: '1px solid #2a2a2a',
            padding: '5px 9px',
            pointerEvents: 'none',
            zIndex: 20,
            whiteSpace: 'nowrap',
          }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--fg)' }}>{tip.p.name}</p>
          <p className="text-xs" style={{ color: SEV_COLOR[tip.p.severity] }}>{tip.p.severity.toUpperCase()}{tip.p.hasCve ? ' · CVEs' : ''}</p>
          <p className="text-xs" style={{ color: '#666' }}>{fmtAge(tip.p.ageDays)} old · {fmtDl(tip.p.downloads)}/mo</p>
        </div>
      )}

      <p className="text-xs mt-1" style={{ color: '#333' }}>
        ring = has CVEs · position = age + downloads · color = severity
      </p>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function ScanCharts({ results, scanning }: { results: ScanResult[]; scanning: boolean }) {
  if (results.length === 0 || scanning) return null;
  return (
    <div
      className="mt-6 mb-2 grid grid-cols-1 md:grid-cols-2 gap-8 px-4 py-5"
      style={{ border: '1px solid var(--border)', background: '#080808' }}
    >
      <SeverityDonut results={results} />
      <RiskScatter   results={results} />
    </div>
  );
}
