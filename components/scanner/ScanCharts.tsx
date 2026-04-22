'use client';

import { useState } from 'react';
import type { ScanResult, Severity } from '@/lib/types';

// ─── filter type (exported so ResultsTable can use it) ────────────────────────

export type ChartFilter =
  | { type: 'severity'; value: string }
  | { type: 'cve';      value: string }
  | { type: 'age';      bucket: number }
  | null;

export function matchesFilter(r: ScanResult, f: ChartFilter): boolean {
  if (!f) return true;
  if (f.type === 'severity') return r.severity === f.value;
  if (f.type === 'cve') return r.cveSeverity === f.value;
  if (f.type === 'age') {
    if (!r.meta.createdAt) return false;
    const d = Math.floor((Date.now() - new Date(r.meta.createdAt).getTime()) / 86_400_000);
    if (f.bucket === 0) return d < 30;
    if (f.bucket === 1) return d >= 30 && d < 180;
    if (f.bucket === 2) return d >= 180 && d < 730;
    return d >= 730;
  }
  return true;
}

const SEV_COLOR: Record<Severity, string> = {
  critical: '#ff4444', high: '#ff7700', medium: '#ffaa00',
  clean: '#22ff88',    unsupported: '#444',
};

// ─── shared card ──────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4" style={{ border: '1px solid #1a1a1a', background: '#060606' }}>
      <p className="text-xs tracking-widest" style={{ color: '#444' }}>{title}</p>
      {children}
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
  const R = 44, SW = 13, SZ = 116, cx = 58, cy = 58;
  const C = 2 * Math.PI * R;
  const visible = segs.filter(s => s.count > 0);
  let cum = 0;
  const arcs = visible.map(s => {
    const dash = (s.count / total) * C;
    const off  = C * 0.25 - cum;
    cum += dash;
    return { ...s, dash, off };
  });

  const activeVal = active?.type === filterType ? (active as { type: string; value: string }).value : null;

  function toggle(val: string) {
    if (activeVal === val) onFilter(null);
    else onFilter({ type: filterType, value: val } as ChartFilter);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* centered ring */}
      <svg width={SZ} height={SZ}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#181818" strokeWidth={SW} />
        {arcs.map((a, i) => {
          const isActive = activeVal === a.filterVal;
          const dimmed   = activeVal !== null && !isActive;
          return (
            <circle key={i} cx={cx} cy={cy} r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={SW}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={a.off}
              strokeLinecap="butt"
              opacity={dimmed ? 0.2 : 1}
            />
          );
        })}
        <text x={cx} y={cy - 5}  textAnchor="middle" fontSize={18} fontWeight="bold" fill="#e0e0e0">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={7}  fill="#444" letterSpacing="1">{center}</text>
      </svg>

      {/* legend — compact, no justify-between */}
      <div className="flex flex-col gap-1.5 w-full">
        {arcs.map((a, i) => {
          const isActive = activeVal === a.filterVal;
          const dimmed   = activeVal !== null && !isActive;
          return (
            <button
              key={i}
              onClick={() => toggle(a.filterVal)}
              className="flex items-center gap-2 text-xs w-full text-left"
              style={{
                background: isActive ? '#1a1a1a' : 'none',
                border: isActive ? `1px solid ${a.color}33` : '1px solid transparent',
                padding: '3px 6px',
                cursor: 'pointer',
                opacity: dimmed ? 0.35 : 1,
                borderRadius: 2,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: dimmed ? '#444' : '#888', letterSpacing: '0.05em', flexShrink: 0 }}>{a.label}</span>
              <span style={{ color: a.color, fontWeight: 'bold' }}>{a.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 1. severity donut ────────────────────────────────────────────────────────

function SeverityDonut({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const segs: RingSeg[] = [
    { label: 'CRITICAL',    color: '#ff4444', filterVal: 'critical',    count: results.filter(r => r.severity === 'critical').length },
    { label: 'HIGH',        color: '#ff7700', filterVal: 'high',        count: results.filter(r => r.severity === 'high').length },
    { label: 'MEDIUM',      color: '#ffaa00', filterVal: 'medium',      count: results.filter(r => r.severity === 'medium').length },
    { label: 'CLEAN',       color: '#22ff88', filterVal: 'clean',       count: results.filter(r => r.severity === 'clean').length },
    { label: 'UNSUPPORTED', color: '#444',    filterVal: 'unsupported', count: results.filter(r => r.severity === 'unsupported').length },
  ];
  return (
    <Card title="RISK BREAKDOWN">
      <Ring segs={segs} total={results.length} center="PKGS" filterType="severity" active={active} onFilter={onFilter} />
      {active?.type === 'severity' && (
        <p className="text-xs" style={{ color: '#555' }}>filtered · <button onClick={() => onFilter(null)} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>clear ×</button></p>
      )}
    </Card>
  );
}

// ─── 2. CVE exposure donut ────────────────────────────────────────────────────

function CveDonut({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const scanned = results.filter(r => r.cveSeverity !== undefined);
  if (scanned.length === 0) return (
    <Card title="CVE EXPOSURE">
      <div className="flex items-center justify-center" style={{ minHeight: 120 }}>
        <p className="text-xs" style={{ color: '#2a2a2a' }}>OSV scan in progress...</p>
      </div>
    </Card>
  );
  const segs: RingSeg[] = [
    { label: 'CRITICAL', color: '#ff4444', filterVal: 'CRITICAL', count: scanned.filter(r => r.cveSeverity === 'CRITICAL').length },
    { label: 'HIGH',     color: '#ff7700', filterVal: 'HIGH',     count: scanned.filter(r => r.cveSeverity === 'HIGH').length },
    { label: 'MEDIUM',   color: '#ffaa00', filterVal: 'MEDIUM',   count: scanned.filter(r => r.cveSeverity === 'MEDIUM').length },
    { label: 'LOW',      color: '#6688ff', filterVal: 'LOW',      count: scanned.filter(r => r.cveSeverity === 'LOW').length },
    { label: 'CLEAN',    color: '#22ff88', filterVal: 'CLEAN',    count: scanned.filter(r => r.cveSeverity === 'CLEAN').length },
  ];
  const totalCves = results.reduce((s, r) => s + (r.cves?.length ?? 0), 0);
  return (
    <Card title="CVE EXPOSURE">
      <Ring segs={segs} total={scanned.length} center="PKGS" filterType="cve" active={active} onFilter={onFilter} />
      {totalCves > 0 && (
        <p className="text-xs" style={{ color: '#444' }}>
          <span style={{ color: '#ff4444', fontWeight: 'bold' }}>{totalCves}</span> total CVEs
        </p>
      )}
      {active?.type === 'cve' && (
        <p className="text-xs" style={{ color: '#555' }}>filtered · <button onClick={() => onFilter(null)} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>clear ×</button></p>
      )}
    </Card>
  );
}

// ─── 3. age distribution ──────────────────────────────────────────────────────

const AGE_BUCKETS = [
  { label: '< 30d',   color: '#ff4444' },
  { label: '1–6mo',   color: '#ff7700' },
  { label: '6mo–2yr', color: '#ffaa00' },
  { label: '2yr+',    color: '#22ff88' },
];

function getAgeBucket(createdAt: string): number {
  const d = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (d < 30)  return 0;
  if (d < 180) return 1;
  if (d < 730) return 2;
  return 3;
}

function AgeHistogram({ results, active, onFilter }: { results: ScanResult[]; active: ChartFilter; onFilter: (f: ChartFilter) => void }) {
  const pkgs = results.filter(r => r.meta.exists && r.meta.createdAt);
  const counts = AGE_BUCKETS.map((_, i) => pkgs.filter(r => getAgeBucket(r.meta.createdAt!) === i).length);
  const maxCount = Math.max(...counts, 1);
  const activeBucket = active?.type === 'age' ? (active as { type: 'age'; bucket: number }).bucket : null;

  const W = 240, H = 130;
  const PAD = { top: 20, bottom: 24, left: 8, right: 8 };
  const slotW = (W - PAD.left - PAD.right) / AGE_BUCKETS.length;
  const barW  = slotW * 0.52;
  const plotH = H - PAD.top - PAD.bottom;

  function toggle(i: number) {
    if (activeBucket === i) onFilter(null);
    else onFilter({ type: 'age', bucket: i });
  }

  return (
    <Card title="AGE DISTRIBUTION">
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
          <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} stroke="#1a1a1a" strokeWidth={1} />
          {AGE_BUCKETS.map((b, i) => {
            const cnt    = counts[i];
            const barH   = Math.max((cnt / maxCount) * plotH, cnt > 0 ? 3 : 0);
            const x      = PAD.left + i * slotW + (slotW - barW) / 2;
            const y      = PAD.top + plotH - barH;
            const isAct  = activeBucket === i;
            const dimmed = activeBucket !== null && !isAct;
            return (
              <g key={i} style={{ cursor: 'pointer' }} onClick={() => toggle(i)}>
                {/* track */}
                <rect x={x} y={PAD.top} width={barW} height={plotH} fill="#0d0d0d" rx={2} />
                {/* bar */}
                <rect x={x} y={y} width={barW} height={barH}
                  fill={b.color} fillOpacity={dimmed ? 0.15 : isAct ? 1 : 0.8} rx={2} />
                {/* active outline */}
                {isAct && <rect x={x - 1} y={PAD.top} width={barW + 2} height={plotH}
                  fill="none" stroke={b.color} strokeWidth={1} strokeOpacity={0.5} rx={2} />}
                {/* count */}
                {cnt > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight="bold"
                    fill={b.color} fillOpacity={dimmed ? 0.3 : 1}>{cnt}</text>
                )}
                {/* label */}
                <text x={x + barW / 2} y={H - 5} textAnchor="middle" fontSize={7.5}
                  fill={dimmed ? '#2a2a2a' : isAct ? b.color : '#555'}>{b.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {active?.type === 'age' && (
        <p className="text-xs" style={{ color: '#555' }}>filtered · <button onClick={() => onFilter(null)} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>clear ×</button></p>
      )}
    </Card>
  );
}

// ─── 4. risk scatter ──────────────────────────────────────────────────────────

interface ScatterPt { name: string; ageDays: number; downloads: number; severity: Severity; hasCve: boolean }

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
  const [tip, setTip] = useState<{ p: ScatterPt; x: number; y: number } | null>(null);

  const points: ScatterPt[] = results
    .filter(r => r.meta.exists && r.meta.createdAt && r.meta.monthlyDownloads !== undefined)
    .map(r => ({
      name:      r.package.name,
      ageDays:   Math.floor((Date.now() - new Date(r.meta.createdAt!).getTime()) / 86_400_000),
      downloads: r.meta.monthlyDownloads!,
      severity:  r.severity,
      hasCve:    (r.cves?.length ?? 0) > 0,
    }));

  if (points.length < 2) return null;

  const W = 900, H = 200;
  const PAD = { top: 14, right: 20, bottom: 34, left: 52 };
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

  return (
    <Card title="RISK SCATTER  ·  age vs downloads  ·  outer ring = has CVEs  ·  color = severity">
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setTip(null)}>
          {/* danger zone */}
          <rect x={PAD.left} y={dzY1} width={dzX2 - PAD.left} height={PAD.top + ph - dzY1}
            fill="#ff4444" fillOpacity={0.04} />
          <text x={PAD.left + 4} y={dzY1 + 11} fontSize={7} fill="#ff4444" fillOpacity={0.3} letterSpacing="1">DANGER ZONE</text>

          {/* grid */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yPos(v)} x2={PAD.left + pw} y2={yPos(v)} stroke="#111" strokeWidth={1} />
              <text x={PAD.left - 5} y={yPos(v) + 3} textAnchor="end" fontSize={8} fill="#333">{fmtDl(v)}</text>
            </g>
          ))}
          {xTicks.map(v => (
            <g key={v}>
              <line x1={xPos(v)} y1={PAD.top} x2={xPos(v)} y2={PAD.top + ph} stroke="#111" strokeWidth={1} />
              <text x={xPos(v)} y={PAD.top + ph + 13} textAnchor="middle" fontSize={8} fill="#333">{fmtAge(v)}</text>
            </g>
          ))}

          {/* axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke="#222" strokeWidth={1} />
          <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke="#222" strokeWidth={1} />

          {/* labels */}
          <text x={PAD.left + pw / 2} y={H - 3} textAnchor="middle" fontSize={8} fill="#444" letterSpacing="1">PACKAGE AGE</text>
          <text x={10} y={PAD.top + ph / 2} textAnchor="middle" fontSize={8} fill="#444" letterSpacing="1"
            transform={`rotate(-90,10,${PAD.top + ph / 2})`}>DL/MO</text>

          {/* points */}
          {points.map(p => {
            const px = xPos(p.ageDays), py = yPos(p.downloads);
            const color = SEV_COLOR[p.severity];
            return (
              <g key={p.name}>
                {p.hasCve && <circle cx={px} cy={py} r={10} fill="none" stroke={color} strokeWidth={1} opacity={0.3} />}
                <circle cx={px} cy={py} r={5} fill={color} fillOpacity={0.8} stroke="#000" strokeWidth={0.5}
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={e => {
                    const svg  = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTip({ p, x: rect.left - svg.left + 10, y: rect.top - svg.top - 55 });
                  }} />
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
              {tip.p.severity.toUpperCase()}{tip.p.hasCve ? '  ·  CVEs' : ''}
            </p>
            <p className="text-xs" style={{ color: '#555' }}>{fmtAge(tip.p.ageDays)} old  ·  {fmtDl(tip.p.downloads)}/mo</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SeverityDonut results={results} active={filter} onFilter={onFilter} />
        <CveDonut      results={results} active={filter} onFilter={onFilter} />
        <AgeHistogram  results={results} active={filter} onFilter={onFilter} />
      </div>
      <RiskScatter results={results} />
    </div>
  );
}
