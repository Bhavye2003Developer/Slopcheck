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
  fromCache?: boolean;
}

function buildSummary(results: ScanResult[]) {
  const critical = results.filter(r => r.severity === 'critical').length;
  const high = results.filter(r => r.severity === 'high').length;
  const medium = results.filter(r => r.severity === 'medium').length;
  const clean = results.filter(r => r.severity === 'clean').length;
  return { critical, high, medium, clean };
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

export default function ResultsTable({ results, fromCache = false }: ResultsTableProps) {
  if (results.length === 0) return null;

  const { critical, high, medium, clean } = buildSummary(results);

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
    const summary = `\n---\n${critical} critical · ${high + medium} warnings · ${clean} clean`;
    downloadFile(lines.join('\n') + summary, 'slopcheck-results.txt', 'text/plain');
  }

  return (
    <div className="mt-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <p className="text-xs tracking-widest flex items-center gap-3" style={{ color: 'var(--muted)' }}>
          <span style={{ color: 'var(--critical)' }}>{critical} critical</span>
          {' · '}
          <span style={{ color: 'var(--warning)' }}>{high + medium} warnings</span>
          {' · '}
          <span style={{ color: 'var(--clean)' }}>{clean} clean</span>
          {fromCache && (
            <span className="ml-2 px-2 py-0.5 text-xs" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
              CACHED
            </span>
          )}
        </p>
        <div className="flex gap-3">
          <button
            onClick={exportJson}
            className="text-xs tracking-widest px-4 py-2 transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            EXPORT JSON
          </button>
          <button
            onClick={exportText}
            className="text-xs tracking-widest px-4 py-2 transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            EXPORT TXT
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)' }}>
        {/* Header */}
        <div
          className="hidden md:grid text-xs tracking-widest px-4 py-3 border-b"
          style={{ gridTemplateColumns: '140px 1fr 1fr', borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          <span>STATUS</span>
          <span>PACKAGE</span>
          <span>DETAILS</span>
        </div>

        {/* Rows */}
        {results.map((r, i) => {
          const fileVer = r.package.version ?? '—';
          const latestVer = r.meta.latestVersion ?? '—';
          const versionMismatch = r.meta.latestVersion && r.package.version && r.package.version !== r.meta.latestVersion;

          return (
            <div
              key={i}
              className="px-4 py-4 border-b animate-fade-in-up"
              style={{
                borderColor: 'var(--border)',
                animationDelay: `${i * 40}ms`,
                animationFillMode: 'both',
                opacity: 0,
              }}
            >
              {/* Row top: status + package + registry link */}
              <div className="grid md:grid-cols-[140px_1fr_auto] gap-2 items-start mb-2">
                <span className="text-xs" style={{ color: SEVERITY_COLOR[r.severity] }}>
                  {SEVERITY_LABEL[r.severity]}
                </span>
                <div>
                  <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>
                    {r.package.name}
                  </span>
                  {r.package.version && (
                    <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>@{r.package.version}</span>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{r.reason}</p>
                </div>
                {r.registryUrl && (
                  <a
                    href={r.registryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs transition-colors shrink-0"
                    style={{ color: 'var(--muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    VIEW ↗
                  </a>
                )}
              </div>

              {/* Row bottom: metadata pills */}
              {r.meta.exists && (
                <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>
                    FILE{' '}
                    <span style={{ color: 'var(--fg)' }}>{fileVer}</span>
                  </span>
                  <span>
                    LATEST{' '}
                    <span style={{ color: versionMismatch ? 'var(--warning)' : 'var(--fg)' }}>
                      {latestVer}
                    </span>
                  </span>
                  <span>
                    DOWNLOADS{' '}
                    <span style={{ color: 'var(--fg)' }}>{fmtDownloads(r.meta.monthlyDownloads)}</span>
                  </span>
                  <span>
                    UPDATED{' '}
                    <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.updatedAt)}</span>
                  </span>
                  {r.meta.createdAt && (
                    <span>
                      CREATED{' '}
                      <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.createdAt)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
