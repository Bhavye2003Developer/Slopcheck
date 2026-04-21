'use client';

import type { ScanResult, Severity } from '@/lib/types';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '❌ CRITICAL',
  high: '⚠️  HIGH',
  medium: '⚠️  MEDIUM',
  clean: '✅ CLEAN',
  unsupported: '—  N/A',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--critical)',
  high: 'var(--warning)',
  medium: 'var(--warning)',
  clean: 'var(--clean)',
  unsupported: 'var(--muted)',
};

interface ResultsTableProps {
  results: ScanResult[];
  scanning?: boolean;
}

function buildSummary(results: ScanResult[]) {
  return {
    critical: results.filter(r => r.severity === 'critical').length,
    warnings: results.filter(r => r.severity === 'high' || r.severity === 'medium').length,
    clean: results.filter(r => r.severity === 'clean').length,
  };
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDownloads(n?: number): string {
  if (n === undefined) return '—';
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
  if (results.length === 0) return null;

  const { critical, warnings, clean } = buildSummary(results);

  function exportJson() {
    downloadFile(JSON.stringify(results, null, 2), 'slopcheck-results.json', 'application/json');
  }

  function exportText() {
    const lines = results.map(r => {
      const ver = r.package.version ? `@${r.package.version}` : '';
      const latest = r.meta.latestVersion ? ` → latest ${r.meta.latestVersion}` : '';
      const dl = r.meta.monthlyDownloads !== undefined ? ` · ${fmtDownloads(r.meta.monthlyDownloads)}` : '';
      const updated = r.meta.updatedAt ? ` · updated ${fmtDate(r.meta.updatedAt)}` : '';
      return `${SEVERITY_LABEL[r.severity].padEnd(14)} ${(r.package.name + ver).padEnd(45)} ${r.reason}${latest}${dl}${updated}`;
    });
    const summary = `\n---\n${critical} critical · ${warnings} warnings · ${clean} clean`;
    downloadFile(lines.join('\n') + summary, 'slopcheck-results.txt', 'text/plain');
  }

  return (
    <div className="mt-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs tracking-widest flex flex-wrap items-center gap-2" style={{ color: 'var(--muted)' }}>
          <span style={{ color: 'var(--critical)' }}>{critical} critical</span>
          <span>·</span>
          <span style={{ color: 'var(--warning)' }}>{warnings} warnings</span>
          <span>·</span>
          <span style={{ color: 'var(--clean)' }}>{clean} clean</span>
          {scanning && (
            <span className="ml-1 px-2 py-0.5" style={{ border: '1px solid var(--warning)', color: 'var(--warning)' }}>
              SCANNING…
            </span>
          )}
        </p>
        {!scanning && (
          <div className="flex gap-2">
            <button
              onClick={exportJson}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              JSON
            </button>
            <button
              onClick={exportText}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              TXT
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)' }}>
        {results.map((r, i) => {
          const fileVer = r.package.version ?? '—';
          const latestVer = r.meta.latestVersion ?? '—';
          const versionMismatch = r.meta.latestVersion && r.package.version && r.package.version !== r.meta.latestVersion;

          return (
            <div
              key={`${r.package.name}-${i}`}
              className="px-3 md:px-4 py-4 border-b animate-fade-in-up"
              style={{ borderColor: 'var(--border)', animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: 'both', opacity: 0 }}
            >
              {/* Top row: status + name + link */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs shrink-0" style={{ color: SEVERITY_COLOR[r.severity] }}>
                    {SEVERITY_LABEL[r.severity]}
                  </span>
                  <span className="text-xs font-bold truncate" style={{ color: 'var(--fg)' }}>
                    {r.package.name}
                    {r.package.version && (
                      <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>@{r.package.version}</span>
                    )}
                  </span>
                </div>
                {r.registryUrl && (
                  <a href={r.registryUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs shrink-0 transition-colors" style={{ color: 'var(--muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                    VIEW ↗
                  </a>
                )}
              </div>

              {/* Reason */}
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{r.reason}</p>

              {/* Metadata pills */}
              {r.meta.exists && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>FILE <span style={{ color: 'var(--fg)' }}>{fileVer}</span></span>
                  <span>
                    LATEST{' '}
                    <span style={{ color: versionMismatch ? 'var(--warning)' : 'var(--fg)' }}>{latestVer}</span>
                    {versionMismatch && <span style={{ color: 'var(--warning)' }}> ↑</span>}
                  </span>
                  <span>DL <span style={{ color: 'var(--fg)' }}>{fmtDownloads(r.meta.monthlyDownloads)}</span></span>
                  <span>UPDATED <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.updatedAt)}</span></span>
                  <span>CREATED <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.createdAt)}</span></span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
