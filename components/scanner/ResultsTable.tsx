'use client';

import { useState } from 'react';
import type { ScanResult, Severity, CVEEntry } from '@/lib/types';

import type { FlagType } from '@/lib/types';

const FLAG_LABEL: Partial<Record<FlagType, string>> = {
  nonexistent: '❌ NOT FOUND',
  recently_registered: '⚠️  NEW PKG',
  low_downloads: '⚠️  LOW DL',
  suspicious_script: '⚠️  MALICIOUS',
  outdated: '⬆️  OUTDATED',
  low_adoption_latest: '⚠️  LOW ADOPT',
  clean: '✅ CLEAN',
  unsupported: 'N/A',
  has_cve_critical: '❌ NOT FOUND',
  has_cve_high: '⚠️  NEW PKG',
  has_cve_medium: '⚠️  LOW DL',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '❌ CRITICAL',
  high: '⚠️  HIGH',
  medium: '⚠️  MEDIUM',
  clean: '✅ CLEAN',
  unsupported: 'N/A',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--critical)',
  high: 'var(--warning)',
  medium: 'var(--warning)',
  clean: 'var(--clean)',
  unsupported: 'var(--muted)',
};

type CveSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';

const VULN_COLOR: Record<CveSeverity | 'PENDING' | 'UNKNOWN', string> = {
  CRITICAL: '#ff4444',
  HIGH: '#ff7700',
  MEDIUM: '#ffaa00',
  LOW: '#ffaa00',
  CLEAN: '#22ff88',
  PENDING: '#555',
  UNKNOWN: '#555',
};

interface ResultsTableProps {
  results: ScanResult[];
  scanning?: boolean;
}

function buildSummary(results: ScanResult[]) {
  const critical = results.filter(r => r.severity === 'critical').length;
  const warnings = results.filter(r => r.severity === 'high' || r.severity === 'medium').length;
  const clean = results.filter(r => r.severity === 'clean').length;
  const cveCritical = results.filter(r => r.cveSeverity === 'CRITICAL').length;
  const cveHigh = results.filter(r => r.cveSeverity === 'HIGH').length;
  const totalCves = results.reduce((sum, r) => sum + (r.cves?.length ?? 0), 0);
  const cveClean = results.filter(r => r.cveSeverity === 'CLEAN').length;
  return { critical, warnings, clean, cveCritical, cveHigh, totalCves, cveClean };
}

function VulnPill({ result }: { result: ScanResult }) {
  if (result.cveSeverity === undefined) {
    return (
      <span className="text-xs px-2 py-0.5 font-mono tracking-widest" style={{ color: '#555', border: '1px solid #333' }}>
        —
      </span>
    );
  }
  const sev = result.cveSeverity;
  const color = VULN_COLOR[sev] ?? '#555';
  return (
    <span className="text-xs px-2 py-0.5 font-mono tracking-widest" style={{ color, border: `1px solid ${color}` }}>
      {sev}
    </span>
  );
}

function CvePanel({ cves }: { cves: CVEEntry[] }) {
  if (cves.length === 0) return null;
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--muted)' }}>CVEs</p>
      <div className="flex flex-col gap-1">
        {cves.map(cve => {
          const color = VULN_COLOR[cve.severity] ?? '#555';
          return (
            <div key={cve.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
              <span style={{ color: 'var(--fg)' }}>{cve.id}</span>
              <span style={{ color }}>{cve.severity}</span>
              {cve.cvss !== null && (
                <span style={{ color: 'var(--muted)' }}>CVSS {cve.cvss.toFixed(1)}</span>
              )}
              {cve.fixedIn && (
                <span style={{ color: 'var(--clean)' }}>Fixed in {cve.fixedIn}</span>
              )}
              {cve.summary && (
                <span className="w-full mt-0.5" style={{ color: '#666' }}>{cve.summary}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDownloads(n?: number): string {
  if (n === undefined) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M/mo`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K/mo`;
  return `${n}/mo`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsTable({ results, scanning = false }: ResultsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (results.length === 0) return null;

  const { critical, warnings, clean, cveCritical, cveHigh, totalCves, cveClean } = buildSummary(results);
  const deps = results.filter(r => !r.package.isDev);
  const devDeps = results.filter(r => r.package.isDev);
  const osvDone = results.some(r => r.cveSeverity !== undefined);

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderRow(r: ScanResult, i: number, globalIndex: number) {
    const fileVer = r.package.version ?? '-';
    const latestVer = r.meta.latestVersion ?? '-';
    const versionMismatch = r.meta.latestVersion && r.package.version && r.package.version !== r.meta.latestVersion;
    const flagLabel = FLAG_LABEL[r.flag] ?? SEVERITY_LABEL[r.severity];
    const rowKey = `${r.package.ecosystem}:${r.package.name}`;
    const isExpanded = expanded.has(rowKey);
    const hasCves = (r.cves?.length ?? 0) > 0;

    return (
      <div
        key={`${r.package.name}-${globalIndex}`}
        className="px-3 md:px-4 py-4 border-b animate-fade-in-up"
        style={{ borderColor: 'var(--border)', animationDelay: `${Math.min(globalIndex * 30, 400)}ms`, animationFillMode: 'both', opacity: 0 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="text-xs shrink-0" style={{ color: SEVERITY_COLOR[r.severity] }}>
              {flagLabel}
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>
              {r.package.name}
              {r.package.version && (
                <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>@{r.package.version}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <VulnPill result={r} />
            {r.registryUrl && (
              <a href={r.registryUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs transition-colors" style={{ color: 'var(--muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                VIEW ↗
              </a>
            )}
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{r.reason}</p>
        {r.meta.exists && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span style={{ color: '#888' }}>FILE <span style={{ color: 'var(--fg)' }}>{fileVer}</span></span>
            <span style={{ color: '#888' }}>
              LATEST{' '}
              <span style={{ color: versionMismatch ? 'var(--warning)' : 'var(--fg)' }}>{latestVer}</span>
              {versionMismatch && <span style={{ color: 'var(--warning)' }}> ^</span>}
            </span>
            <span style={{ color: '#888' }}>DL <span style={{ color: 'var(--fg)' }}>{fmtDownloads(r.meta.monthlyDownloads)}</span></span>
            <span style={{ color: '#888' }}>UPDATED <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.updatedAt)}</span></span>
            <span style={{ color: '#888' }}>CREATED <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.createdAt)}</span></span>
          </div>
        )}
        {hasCves && (
          <button
            onClick={() => toggleExpanded(rowKey)}
            className="mt-2 text-xs tracking-widest transition-colors"
            style={{ color: 'var(--muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            {isExpanded ? '▲ HIDE CVEs' : `▼ SHOW ${r.cves!.length} CVE${r.cves!.length !== 1 ? 's' : ''}`}
          </button>
        )}
        {isExpanded && hasCves && <CvePanel cves={r.cves!} />}
      </div>
    );
  }

  function renderGroup(group: ScanResult[], label: string, offset: number) {
    if (group.length === 0) return null;
    return (
      <>
        <div
          className="px-3 md:px-4 py-2 text-xs tracking-widest"
          style={{ background: '#111', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
        >
          {label} <span style={{ color: 'var(--fg)' }}>{group.length}</span>
        </div>
        {group.map((r, i) => renderRow(r, i, offset + i))}
      </>
    );
  }

  function exportJson() {
    downloadFile(JSON.stringify(results, null, 2), 'slopcheck-results.json', 'application/json');
  }

  function exportText() {
    const lines = results.map(r => {
      const ver = r.package.version ? `@${r.package.version}` : '';
      const latest = r.meta.latestVersion ? ` -> latest ${r.meta.latestVersion}` : '';
      const dl = r.meta.monthlyDownloads !== undefined ? ` |${fmtDownloads(r.meta.monthlyDownloads)}` : '';
      const updated = r.meta.updatedAt ? ` |updated ${fmtDate(r.meta.updatedAt)}` : '';
      return `${SEVERITY_LABEL[r.severity].padEnd(14)} ${(r.package.name + ver).padEnd(45)} ${r.reason}${latest}${dl}${updated}`;
    });
    const summary = `\n---\n${critical} critical |${warnings} warnings |${clean} clean`;
    downloadFile(lines.join('\n') + summary, 'slopcheck-results.txt', 'text/plain');
  }

  return (
    <div className="mt-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs tracking-widest flex flex-wrap items-center gap-2" style={{ color: 'var(--muted)' }}>
          {!scanning && <span style={{ color: 'var(--fg)' }}>SCAN COMPLETE</span>}
          <span>·</span>
          <span style={{ color: 'var(--critical)' }}>{critical} CRITICAL</span>
          <span>·</span>
          <span style={{ color: 'var(--warning)' }}>{warnings} HIGH</span>
          {osvDone && (
            <>
              <span>·</span>
              <span style={{ color: '#ff4444' }}>{cveCritical} CVE-CRIT</span>
              <span>·</span>
              <span style={{ color: '#ff7700' }}>{cveHigh} CVE-HIGH</span>
              <span>·</span>
              <span style={{ color: 'var(--fg)' }}>{totalCves} CVEs</span>
              <span>·</span>
              <span style={{ color: '#22ff88' }}>{cveClean} CLEAN</span>
            </>
          )}
          <span>·</span>
          <span style={{ color: 'var(--fg)' }}>{results.length} packages</span>
          {scanning && (
            <span className="ml-1 px-2 py-0.5" style={{ border: '1px solid var(--warning)', color: 'var(--warning)' }}>
              SCANNING...
            </span>
          )}
        </p>
        {!scanning && (
          <div className="flex gap-2">
            <button
              onClick={exportJson}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              JSON
            </button>
            <button
              onClick={exportText}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              TXT
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)' }}>
        {renderGroup(deps, 'DEPENDENCIES', 0)}
        {devDeps.length > 0 && renderGroup(devDeps, 'DEV DEPENDENCIES', deps.length)}
      </div>
    </div>
  );
}
