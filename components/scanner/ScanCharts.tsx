'use client';

import { useState, useMemo } from 'react';
import type { ScanResult, Severity } from '@/lib/types';

// ─── filter type ──────────────────────────────────────────────────────────────

export type ChartFilter =
  | { type: 'severity'; value: string }
  | { type: 'cve';      value: string }
  | { type: 'age';      bucket: number }
  | { type: 'package';  name: string }
  | null;

function ageBucket(createdAt?: string): number {
  if (!createdAt) return 3;
  const d = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (d < 30)  return 0;
  if (d < 180) return 1;
  if (d < 730) return 2;
  return 3;
}

export function matchesFilter(r: ScanResult, f: ChartFilter): boolean {
  if (!f) return true;
  if (f.type === 'severity') return r.severity === f.value;
  if (f.type === 'cve') return r.cveSeverity === f.value;
  if (f.type === 'age') {
    const bucket = (f as { type: 'age'; bucket: number }).bucket;
    if (!r.meta.exists) return bucket === 3;
    return ageBucket(r.meta.createdAt) === bucket;
  }
  if (f.type === 'package') return r.package.name === (f as { type: 'package'; name: string }).name;
  return true;
}

const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--critical)',
  high: 'var(--orange)',
  medium: 'var(--warning)',
  clean: 'var(--clean)',
  unsupported: 'var(--dim-mid)',
};

// ─── card: title pinned top, content centered in remaining space ───────────────

function Card({
  title, children, onClear,
}: {
  title: string;
  children: React.ReactNode;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col p-4" style={{ border: '1px solid var(--border)', background: 'var(--surface-deep)', height: '100%' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <p className="text-xs tracking-widest" style={{ color: 'var(--dim-mid)' }}>{title}</p>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs tracking-widest px-2 py-0.5"
            style={{ color: 'var(--dim-label)', border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}
          >
            RESET ×
          </button>
        )}
      </div>
      <div className="flex flex-col items-center justify-center flex-1 gap-5">
        {children}
      </div>
    </div>
  );
}

// ─── ring helper ──────────────────────────────────────────────────────────────

interface RingSeg { label: string; color: string; count: number; filterVal: string }

function Ring({
  segs, total, center, filterType, active, onFilter,
}: {
  segs: RingSeg[];
  total: number;
  center: string;
  filterType: 'severity' | 'cve';
  active: ChartFilter;
  onFilter: (f: ChartFilter) => void;
}) {
  const R = 68, SW = 18, SZ = 176, cx = 88, cy = 88;
  const C = 2 * Math.PI * R;
  const visible = segs.filter(s => s.count > 0);
  const arcs = visible.reduce<Array<RingSeg & { dash: number; off: number }>>(
    (acc, s) => {
      const cum = acc.reduce((sum, a) => sum + a.dash, 0);
      const dash = (s.count / total) * C;
      const off  = C * 0.25 - cum;
      return [...acc, { ...s, dash, off }];
    },
    []
  );

  const activeVal = active?.type === filterType
    ? (active as { type: string; value: string }).value
    : null;

  function toggle(val: string) {
    if (activeVal === val) onFilter(null);
    else onFilter({ type: filterType, value: val } as ChartFilter);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 12, overflow: 'hidden' }}>
      {/* legend - shrinkable */}
      <div style={{ width: 110, flexShrink: 1, minWidth: 80 }}>
        {arcs.map((a, i) => {
          const isActive = activeVal === a.filterVal;
          const dimmed   = activeVal !== null && !isActive;
          return (
            <button
              key={i}
              onClick={() => toggle(a.filterVal)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                width: '100%', padding: '4px 5px', marginBottom: 3,
                background: isActive ? 'var(--panel)' : 'transparent',
                border: `1px solid ${isActive ? a.color + '55' : 'transparent'}`,
                borderRadius: 3, cursor: 'pointer',
                opacity: dimmed ? 0.22 : 1,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em', flexShrink: 0, whiteSpace: 'nowrap' }}>{a.label}</span>
              <span style={{ fontSize: 10, color: a.color, fontWeight: 700 }}>{a.count}</span>
            </button>
          );
        })}
      </div>

      {/* ring - shrinkable */}
      <div style={{ width: 160, flexShrink: 1, minWidth: 110, display: 'flex', alignItems: 'center' }}>
        <svg
          viewBox={`0 0 ${SZ} ${SZ}`}
          style={{ width: '100%', height: 'auto' }}
        >
          <circle cx={cx} cy={cy} r={R} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth={SW} />
          {arcs.map((a, i) => {
            const dimmed = activeVal !== null && activeVal !== a.filterVal;
            return (
              <circle key={i} cx={cx} cy={cy} r={R}
                fill="none" style={{ stroke: a.color }} strokeWidth={SW}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={a.off}
                strokeLinecap="butt"
                opacity={dimmed ? 0.13 : 1}
                cursor="pointer"
                onClick={() => toggle(a.filterVal)}
              />
            );
          })}
          <text x={cx} y={cy - 6}  textAnchor="middle" fontSize={22} fontWeight="bold" style={{ fill: 'var(--chart-center)' }}>{total}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9}  style={{ fill: 'var(--dim-mid)' }} letterSpacing="2">{center}</text>
        </svg>
      </div>
    </div>
  );
}

// ─── 1. severity donut ────────────────────────────────────────────────────────

function SeverityDonut({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const segs: RingSeg[] = [
    { label: 'CRITICAL',    color: 'var(--critical)', filterVal: 'critical',    count: results.filter(r => r.severity === 'critical').length },
    { label: 'HIGH',        color: 'var(--orange)',   filterVal: 'high',        count: results.filter(r => r.severity === 'high').length },
    { label: 'MEDIUM',      color: 'var(--warning)',  filterVal: 'medium',      count: results.filter(r => r.severity === 'medium').length },
    { label: 'CLEAN',       color: 'var(--clean)',    filterVal: 'clean',       count: results.filter(r => r.severity === 'clean').length },
    { label: 'UNSUPPORTED', color: 'var(--dim-mid)',  filterVal: 'unsupported', count: results.filter(r => r.severity === 'unsupported').length },
  ];
  return (
    <Card
      title="RISK BREAKDOWN"
      onClear={active?.type === 'severity' ? () => onFilter(null) : undefined}
    >
      <Ring segs={segs} total={results.length} center="PKGS" filterType="severity" active={active} onFilter={onFilter} />
    </Card>
  );
}

// ─── 2. CVE exposure donut ────────────────────────────────────────────────────

function CveDonut({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const scanned = results.filter(r => r.cveSeverity !== undefined);
  const scannable = results.filter(r => r.meta.exists);

  if (scannable.length === 0) return (
    <Card title="CVE EXPOSURE">
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>No packages to scan.</p>
    </Card>
  );

  if (scanned.length === 0) return (
    <Card title="CVE EXPOSURE">
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>OSV scan in progress...</p>
    </Card>
  );

  const segs: RingSeg[] = [
    { label: 'CRITICAL', color: 'var(--critical)', filterVal: 'CRITICAL', count: scanned.filter(r => r.cveSeverity === 'CRITICAL').length },
    { label: 'HIGH',     color: 'var(--orange)',   filterVal: 'HIGH',     count: scanned.filter(r => r.cveSeverity === 'HIGH').length },
    { label: 'MEDIUM',   color: 'var(--warning)',  filterVal: 'MEDIUM',   count: scanned.filter(r => r.cveSeverity === 'MEDIUM').length },
    { label: 'LOW',      color: 'var(--blue)',     filterVal: 'LOW',      count: scanned.filter(r => r.cveSeverity === 'LOW').length },
    { label: 'CLEAN',    color: 'var(--clean)',    filterVal: 'CLEAN',    count: scanned.filter(r => r.cveSeverity === 'CLEAN').length },
  ];

  const totalCves = results.reduce((s, r) => s + (r.cves?.length ?? 0), 0);

  return (
    <Card
      title="CVE EXPOSURE"
      onClear={active?.type === 'cve' ? () => onFilter(null) : undefined}
    >
      <Ring segs={segs} total={scanned.length} center="PKGS" filterType="cve" active={active} onFilter={onFilter} />
      {totalCves > 0 && (
        <p style={{ fontSize: 11, color: 'var(--dim-mid)', marginTop: -8 }}>
          <span style={{ color: 'var(--critical)', fontWeight: 700 }}>{totalCves}</span> total CVEs
        </p>
      )}
    </Card>
  );
}

// ─── 3. age distribution ──────────────────────────────────────────────────────

const AGE_BUCKETS = [
  { label: '< 30d',   color: 'var(--critical)' },
  { label: '1–6mo',   color: 'var(--orange)' },
  { label: '6mo–2yr', color: 'var(--warning)' },
  { label: '2yr+',    color: 'var(--clean)' },
];


function AgeHistogram({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const pkgs   = results.filter(r => r.meta.exists);
  const counts = AGE_BUCKETS.map((_, i) => pkgs.filter(r => ageBucket(r.meta.createdAt) === i).length);
  const maxCnt = Math.max(...counts, 1);
  const activeBucket = active?.type === 'age' ? (active as { type: 'age'; bucket: number }).bucket : null;

  const W = 260, H = 160;
  const PAD = { top: 24, bottom: 28, left: 10, right: 10 };
  const slotW = (W - PAD.left - PAD.right) / AGE_BUCKETS.length;
  const barW  = slotW * 0.54;
  const plotH = H - PAD.top - PAD.bottom;

  function toggle(i: number) {
    if (activeBucket === i) onFilter(null);
    else onFilter({ type: 'age', bucket: i });
  }

  if (pkgs.length === 0) return (
    <Card title="AGE DISTRIBUTION">
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>No age data available.</p>
    </Card>
  );

  return (
    <Card
      title="AGE DISTRIBUTION"
      onClear={active?.type === 'age' ? () => onFilter(null) : undefined}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} style={{ stroke: 'var(--track)' }} strokeWidth={1} />
        {AGE_BUCKETS.map((b, i) => {
          const cnt    = counts[i];
          const barH   = Math.max((cnt / maxCnt) * plotH, cnt > 0 ? 3 : 0);
          const x      = PAD.left + i * slotW + (slotW - barW) / 2;
          const y      = PAD.top + plotH - barH;
          const isAct  = activeBucket === i;
          const dimmed = activeBucket !== null && !isAct;
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => toggle(i)}>
              <rect x={x} y={PAD.top} width={barW} height={plotH} style={{ fill: 'var(--surface-deep)' }} rx={2} />
              <rect x={x} y={y} width={barW} height={barH}
                style={{ fill: b.color }} fillOpacity={dimmed ? 0.12 : isAct ? 1 : 0.8} rx={2} />
              {isAct && (
                <rect x={x - 1} y={PAD.top} width={barW + 2} height={plotH}
                  fill="none" style={{ stroke: b.color }} strokeWidth={1} strokeOpacity={0.4} rx={2} />
              )}
              {cnt > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight="bold"
                  style={{ fill: b.color }} fillOpacity={dimmed ? 0.2 : 1}>{cnt}</text>
              )}
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9}
                style={{ fill: dimmed ? 'var(--dim-hi)' : isAct ? b.color : 'var(--dim-lo)' }}>{b.label}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

// ─── 4. risk scatter ──────────────────────────────────────────────────────────

interface ScatterPt { name: string; ageDays: number; downloads: number; severity: Severity; hasCve: boolean }

function calcAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
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

function RiskScatter({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const [tip, setTip] = useState<{ p: ScatterPt; x: number; y: number } | null>(null);
  const points: ScatterPt[] = useMemo(() => results
    .filter(r => r.meta.exists && r.meta.createdAt && r.meta.monthlyDownloads !== undefined)
    .map(r => ({
      name:      r.package.name,
      ageDays:   calcAgeDays(r.meta.createdAt!),
      downloads: r.meta.monthlyDownloads!,
      severity:  r.severity,
      hasCve:    (r.cves?.length ?? 0) > 0,
    })), [results]);

  if (points.length < 2) return null;

  const W = 900, H = 210;
  const PAD = { top: 16, right: 20, bottom: 36, left: 54 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  const maxAge = Math.max(...points.map(p => p.ageDays), 365);
  const maxLog = Math.log10(Math.max(...points.map(p => p.downloads + 1), 100));

  const xPos = (d: number) => PAD.left + (Math.min(d, maxAge) / maxAge) * pw;
  const yPos = (d: number) => PAD.top + ph - (Math.log10(d + 1) / maxLog) * ph;

  const yTicks = [1, 50, 500, 5_000, 50_000, 500_000].filter(v => Math.log10(v + 1) <= maxLog + 0.1);
  const xTicks = [0, 90, 180, 365, 730, 1_825, 3_650].filter(v => v <= maxAge);

  const dzX2 = xPos(180);
  const dzY1 = yPos(500);

  const activePkg = active?.type === 'package' ? (active as { type: 'package'; name: string }).name : null;
  const activeSev = active?.type === 'severity' ? active.value : null;

  function togglePkg(name: string) {
    if (activePkg === name) onFilter(null);
    else onFilter({ type: 'package', name });
  }

  return (
    <Card
      title="RISK SCATTER  ·  age vs downloads"
      onClear={(active?.type === 'severity' || active?.type === 'package') ? () => onFilter(null) : undefined}
    >
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: 'max(100%, 600px)', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setTip(null)}
        >
          {/* danger zone */}
          <rect x={PAD.left} y={dzY1} width={Math.max(dzX2 - PAD.left, 0)} height={PAD.top + ph - dzY1}
            fill="var(--critical)" fillOpacity={0.04} />
          <text x={PAD.left + 4} y={dzY1 + 12} fontSize={7} style={{ fill: 'var(--critical)' }} fillOpacity={0.28} letterSpacing="1">DANGER ZONE</text>

          {/* grid */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yPos(v)} x2={PAD.left + pw} y2={yPos(v)} style={{ stroke: 'var(--grid)' }} strokeWidth={1} />
              <text x={PAD.left - 5} y={yPos(v) + 3} textAnchor="end" fontSize={8} style={{ fill: 'var(--dim-hi)' }}>{fmtDl(v)}</text>
            </g>
          ))}
          {xTicks.map(v => (
            <g key={v}>
              <line x1={xPos(v)} y1={PAD.top} x2={xPos(v)} y2={PAD.top + ph} style={{ stroke: 'var(--grid)' }} strokeWidth={1} />
              <text x={xPos(v)} y={PAD.top + ph + 14} textAnchor="middle" fontSize={8} style={{ fill: 'var(--dim-hi)' }}>{fmtAge(v)}</text>
            </g>
          ))}

          {/* axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
          <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} style={{ stroke: 'var(--border)' }} strokeWidth={1} />

          {/* axis labels */}
          <text x={PAD.left + pw / 2} y={H - 2} textAnchor="middle" fontSize={8} style={{ fill: 'var(--chart-label)' }} letterSpacing="1">PACKAGE AGE</text>
          <text x={11} y={PAD.top + ph / 2} textAnchor="middle" fontSize={8} style={{ fill: 'var(--chart-label)' }} letterSpacing="1"
            transform={`rotate(-90,11,${PAD.top + ph / 2})`}>DL/MO</text>

          {/* points */}
          {points.map(p => {
            const px = xPos(p.ageDays), py = yPos(p.downloads);
            const color  = SEV_COLOR[p.severity];
            const dimmed = activePkg !== null ? activePkg !== p.name : (activeSev !== null && activeSev !== p.severity);
            return (
              <g key={p.name} style={{ cursor: 'pointer' }} onClick={() => togglePkg(p.name)}>
                {p.hasCve && (
                  <circle cx={px} cy={py} r={11} fill="none" style={{ stroke: color }} strokeWidth={1}
                    opacity={dimmed ? 0.08 : 0.35} />
                )}
                <circle cx={px} cy={py} r={5.5}
                  style={{ fill: color, stroke: dimmed ? 'var(--bg)' : color }}
                  fillOpacity={dimmed ? 0.1 : 0.85}
                  strokeWidth={dimmed ? 0.5 : 1}
                  onMouseEnter={e => {
                    const svg  = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTip({ p, x: rect.left - svg.left + 10, y: rect.top - svg.top - 58 });
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              </g>
            );
          })}
        </svg>

        {tip && (
          <div style={{
            position: 'absolute', left: tip.x, top: tip.y,
            background: 'var(--surface-deep)', border: '1px solid var(--border)',
            padding: '6px 10px', pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{tip.p.name}</p>
            <p style={{ fontSize: 11, color: SEV_COLOR[tip.p.severity], margin: '2px 0 0' }}>
              {tip.p.severity.toUpperCase()}{tip.p.hasCve ? '  ·  CVEs' : ''}
            </p>
            <p style={{ fontSize: 11, color: 'var(--dim-lo)', margin: '1px 0 0' }}>
              {fmtAge(tip.p.ageDays)} old  ·  {fmtDl(tip.p.downloads)}/mo
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── export ───────────────────────────────────────────────────────────────────

export default function ScanCharts({
  results, scanning, filter, onFilter,
}: {
  results: ScanResult[];
  scanning: boolean;
  filter: ChartFilter;
  onFilter: (f: ChartFilter) => void;
}) {
  if (results.length === 0 || scanning) return null;
  return (
    <div className="mt-6 mb-2 flex flex-col gap-3">
      {filter && (
        <div className="flex items-center justify-between px-1">
          <p style={{ fontSize: 11, color: 'var(--dim-lo)' }}>
            Showing filtered results -
            <span style={{ color: 'var(--dim-label)' }}> {results.filter(r => matchesFilter(r, filter)).length} of {results.length} packages</span>
          </p>
          <button
            onClick={() => onFilter(null)}
            style={{
              fontSize: 11, color: 'var(--dim-label)', background: 'none',
              border: '1px solid var(--border)', padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.05em',
            }}
          >
            RESET FILTER ×
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ alignItems: 'stretch' }}>
        <SeverityDonut results={results} active={filter} onFilter={onFilter} />
        <CveDonut      results={results} active={filter} onFilter={onFilter} />
        <AgeHistogram  results={results} active={filter} onFilter={onFilter} />
      </div>
      <RiskScatter results={results} active={filter} onFilter={onFilter} />
    </div>
  );
}
