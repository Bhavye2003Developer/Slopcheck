'use client';

import { useState } from 'react';
import type { ScanResult, Severity } from '@/lib/types';

const SEV_COLOR: Record<Severity, string> = {
  critical:    '#ff4444',
  high:        '#ff7700',
  medium:      '#ffaa00',
  clean:       '#22ff88',
  unsupported: '#444',
};

// ─── shared chart card ────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4" style={{ border: '1px solid #1a1a1a', background: '#060606' }}>
      <p className="text-xs tracking-widest" style={{ color: '#444' }}>{title}</p>
      {children}
    </div>
  );
}

// ─── ring helper ──────────────────────────────────────────────────────────────

interface RingSeg { label: string; color: string; count: number }

function Ring({ segs, total, center }: { segs: RingSeg[]; total: number; center: string }) {
  const R = 38, SW = 11, SZ = 100, cx = 50, cy = 50;
  const C = 2 * Math.PI * R;
  const active = segs.filter(s => s.count > 0);
  let cum = 0;
  const arcs = active.map(s => {
    const dash = (s.count / total) * C;
    const off  = C * 0.25 - cum;
    cum += dash;
    return { ...s, dash, off };
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={SZ} height={SZ} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#181818" strokeWidth={SW} />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={R}
            fill="none" stroke={a.color} strokeWidth={SW}
            strokeDasharray={`${a.dash} ${C - a.dash}`}
            strokeDashoffset={a.off} strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy - 4}  textAnchor="middle" fontSize={16} fontWeight="bold" fill="#e0e0e0">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={7}  fill="#444" letterSpacing="1">{center}</text>
      </svg>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0, display: 'inline-block' }} />
              <span className="truncate" style={{ color: '#555', letterSpacing: '0.06em' }}>{a.label}</span>
            </div>
            <span style={{ color: a.color, fontWeight: 'bold', flexShrink: 0 }}>{a.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 1. severity donut ────────────────────────────────────────────────────────

function SeverityDonut({ results }: { results: ScanResult[] }) {
  const segs: RingSeg[] = [
    { label: 'CRITICAL',    color: '#ff4444', count: results.filter(r => r.severity === 'critical').length },
    { label: 'HIGH',        color: '#ff7700', count: results.filter(r => r.severity === 'high').length },
    { label: 'MEDIUM',      color: '#ffaa00', count: results.filter(r => r.severity === 'medium').length },
    { label: 'CLEAN',       color: '#22ff88', count: results.filter(r => r.severity === 'clean').length },
    { label: 'UNSUPPORTED', color: '#444',    count: results.filter(r => r.severity === 'unsupported').length },
  ];
  return (
    <Card title="RISK BREAKDOWN">
      <Ring segs={segs} total={results.length} center="PKGS" />
    </Card>
  );
}

// ─── 2. CVE exposure donut ────────────────────────────────────────────────────

function CveDonut({ results }: { results: ScanResult[] }) {
  const scanned = results.filter(r => r.cveSeverity !== undefined);
  if (scanned.length === 0) return (
    <Card title="CVE EXPOSURE">
      <p className="text-xs" style={{ color: '#333' }}>OSV scan in progress...</p>
    </Card>
  );
  const segs: RingSeg[] = [
    { label: 'CRITICAL', color: '#ff4444', count: scanned.filter(r => r.cveSeverity === 'CRITICAL').length },
    { label: 'HIGH',     color: '#ff7700', count: scanned.filter(r => r.cveSeverity === 'HIGH').length },
    { label: 'MEDIUM',   color: '#ffaa00', count: scanned.filter(r => r.cveSeverity === 'MEDIUM').length },
    { label: 'LOW',      color: '#6688ff', count: scanned.filter(r => r.cveSeverity === 'LOW').length },
    { label: 'CLEAN',    color: '#22ff88', count: scanned.filter(r => r.cveSeverity === 'CLEAN').length },
  ];
  const totalCves = results.reduce((s, r) => s + (r.cves?.length ?? 0), 0);
  return (
    <Card title="CVE EXPOSURE">
      <Ring segs={segs} total={scanned.length} center="PKGS" />
      {totalCves > 0 && (
        <p className="text-xs" style={{ color: '#555' }}>
          <span style={{ color: '#ff4444', fontWeight: 'bold' }}>{totalCves}</span> total CVEs across all packages
        </p>
      )}
    </Card>
  );
}

// ─── 3. age distribution bars ─────────────────────────────────────────────────

function AgeHistogram({ results }: { results: ScanResult[] }) {
  const pkgs = results.filter(r => r.meta.exists && r.meta.createdAt);
  if (pkgs.length === 0) return (
    <Card title="AGE DISTRIBUTION">
      <p className="text-xs" style={{ color: '#333' }}>No age data available.</p>
    </Card>
  );

  const ages = pkgs.map(r =>
    Math.floor((Date.now() - new Date(r.meta.createdAt!).getTime()) / 86_400_000)
  );

  const buckets = [
    { label: '< 30d',   color: '#ff4444', count: ages.filter(d => d < 30).length,                  tip: 'Very new — high risk' },
    { label: '1–6mo',   color: '#ff7700', count: ages.filter(d => d >= 30   && d < 180).length,     tip: 'New' },
    { label: '6mo–2yr', color: '#ffaa00', count: ages.filter(d => d >= 180  && d < 730).length,     tip: 'Established' },
    { label: '2yr+',    color: '#22ff88', count: ages.filter(d => d >= 730).length,                 tip: 'Mature' },
  ];

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const W = 240, H = 110;
  const PAD = { top: 18, bottom: 22, left: 8, right: 8 };
  const slotW = (W - PAD.left - PAD.right) / buckets.length;
  const barW  = slotW * 0.55;
  const plotH = H - PAD.top - PAD.bottom;

  return (
    <Card title="AGE DISTRIBUTION">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* baseline */}
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} stroke="#1a1a1a" strokeWidth={1} />

        {buckets.map((b, i) => {
          const barH = Math.max((b.count / maxCount) * plotH, b.count > 0 ? 2 : 0);
          const x    = PAD.left + i * slotW + (slotW - barW) / 2;
          const y    = PAD.top + plotH - barH;
          return (
            <g key={b.label}>
              {/* subtle track */}
              <rect x={x} y={PAD.top} width={barW} height={plotH} fill="#0e0e0e" rx={2} />
              {/* bar */}
              <rect x={x} y={y} width={barW} height={barH} fill={b.color} fillOpacity={0.85} rx={2} />
              {/* count above bar */}
              {b.count > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight="bold" fill={b.color}>{b.count}</text>
              )}
              {/* x label */}
              <text x={x + barW / 2} y={H - 5} textAnchor="middle" fontSize={8} fill="#444">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

// ─── 4. risk scatter (full width) ────────────────────────────────────────────

interface ScatterPoint {
  name: string;
  ageDays: number;
  downloads: number;
  severity: Severity;
  hasCve: boolean;
}

function fmtAge(d: number) {
  if (d < 30)  return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}
function fmtDl(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function RiskScatter({ results }: { results: ScanResult[] }) {
  const [tip, setTip] = useState<{ p: ScatterPoint; x: number; y: number } | null>(null);

  const points: ScatterPoint[] = results
    .filter(r => r.meta.exists && r.meta.createdAt && r.meta.monthlyDownloads !== undefined)
    .map(r => ({
      name:      r.package.name,
      ageDays:   Math.floor((Date.now() - new Date(r.meta.createdAt!).getTime()) / 86_400_000),
      downloads: r.meta.monthlyDownloads!,
      severity:  r.severity,
      hasCve:    (r.cves?.length ?? 0) > 0,
    }));

  if (points.length < 2) return null;

  const W   = 900;
  const H   = 200;
  const PAD = { top: 14, right: 20, bottom: 34, left: 52 };
  const pw  = W - PAD.left - PAD.right;
  const ph  = H - PAD.top - PAD.bottom;

  const maxAge = Math.max(...points.map(p => p.ageDays), 365);
  const maxLog = Math.log10(Math.max(...points.map(p => p.downloads + 1), 100));

  const xPos = (d: number) => PAD.left + (Math.min(d, maxAge) / maxAge) * pw;
  const yPos = (d: number) => PAD.top  + ph - (Math.log10(d + 1) / maxLog) * ph;

  const yTicks = [1, 50, 500, 5_000, 50_000, 500_000].filter(v => Math.log10(v + 1) <= maxLog + 0.1);
  const xTicks = [0, 90, 180, 365, 730, 1_825, 3_650].filter(v => v <= maxAge);

  // danger zone: packages < 180 days old AND < 500 downloads
  const dzX2 = xPos(180);
  const dzY1 = yPos(500);

  return (
    <Card title="RISK SCATTER  ·  age vs downloads  ·  dot = package  ·  ring = has CVEs">
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setTip(null)}
        >
          {/* danger zone shading */}
          <rect
            x={PAD.left} y={dzY1}
            width={dzX2 - PAD.left} height={PAD.top + ph - dzY1}
            fill="#ff4444" fillOpacity={0.04}
          />
          <text x={PAD.left + 4} y={dzY1 + 11} fontSize={7} fill="#ff4444" fillOpacity={0.35} letterSpacing="1">DANGER ZONE</text>

          {/* grid lines */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yPos(v)} x2={PAD.left + pw} y2={yPos(v)} stroke="#111" strokeWidth={1} />
              <text x={PAD.left - 5} y={yPos(v) + 3} textAnchor="end" fontSize={8} fill="#383838">{fmtDl(v)}</text>
            </g>
          ))}
          {xTicks.map(v => (
            <g key={v}>
              <line x1={xPos(v)} y1={PAD.top} x2={xPos(v)} y2={PAD.top + ph} stroke="#111" strokeWidth={1} />
              <text x={xPos(v)} y={PAD.top + ph + 13} textAnchor="middle" fontSize={8} fill="#383838">{fmtAge(v)}</text>
            </g>
          ))}

          {/* axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke="#222" strokeWidth={1} />
          <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke="#222" strokeWidth={1} />

          {/* axis labels */}
          <text x={PAD.left + pw / 2} y={H - 3} textAnchor="middle" fontSize={8} fill="#444" letterSpacing="1">PACKAGE AGE</text>
          <text x={10} y={PAD.top + ph / 2} textAnchor="middle" fontSize={8} fill="#444" letterSpacing="1"
            transform={`rotate(-90,10,${PAD.top + ph / 2})`}>DL/MO</text>

          {/* points */}
          {points.map(p => {
            const px    = xPos(p.ageDays);
            const py    = yPos(p.downloads);
            const color = SEV_COLOR[p.severity];
            return (
              <g key={p.name}>
                {p.hasCve && (
                  <circle cx={px} cy={py} r={10} fill="none" stroke={color} strokeWidth={1} opacity={0.35} />
                )}
                <circle
                  cx={px} cy={py} r={5}
                  fill={color} fillOpacity={0.8}
                  stroke="#000" strokeWidth={0.5}
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={e => {
                    const svg  = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTip({ p, x: rect.left - svg.left + 10, y: rect.top - svg.top - 52 });
                  }}
                />
              </g>
            );
          })}
        </svg>

        {tip && (
          <div style={{
            position: 'absolute', left: tip.x, top: tip.y,
            background: '#0e0e0e', border: '1px solid #222',
            padding: '6px 10px', pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
          }}>
            <p className="text-xs font-bold" style={{ color: '#e0e0e0' }}>{tip.p.name}</p>
            <p className="text-xs" style={{ color: SEV_COLOR[tip.p.severity] }}>
              {tip.p.severity.toUpperCase()}{tip.p.hasCve ? '  ·  has CVEs' : ''}
            </p>
            <p className="text-xs" style={{ color: '#555' }}>
              {fmtAge(tip.p.ageDays)} old  ·  {fmtDl(tip.p.downloads)}/mo
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── export ───────────────────────────────────────────────────────────────────

export default function ScanCharts({ results, scanning }: { results: ScanResult[]; scanning: boolean }) {
  if (results.length === 0 || scanning) return null;
  return (
    <div className="mt-6 mb-2 flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SeverityDonut  results={results} />
        <CveDonut       results={results} />
        <AgeHistogram   results={results} />
      </div>
      <RiskScatter results={results} />
    </div>
  );
}
