'use client';

import type { ScanResult, Severity } from '@/lib/types';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '❌ CRITICAL',
  high: '⚠️ HIGH',
  medium: '⚠️ MEDIUM',
  clean: '✅ CLEAN',
  unsupported: '— N/A',
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
}

function buildSummary(results: ScanResult[]) {
  const critical = results.filter(r => r.severity === 'critical').length;
  const high = results.filter(r => r.severity === 'high').length;
  const medium = results.filter(r => r.severity === 'medium').length;
  const clean = results.filter(r => r.severity === 'clean').length;
  return { critical, high, medium, clean };
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

export default function ResultsTable({ results }: ResultsTableProps) {
  if (results.length === 0) return null;

  const { critical, high, medium, clean } = buildSummary(results);

  function exportJson() {
    downloadFile(JSON.stringify(results, null, 2), 'slopcheck-results.json', 'application/json');
  }

  function exportText() {
    const lines = results.map(
      r => `${SEVERITY_LABEL[r.severity].padEnd(14)} ${r.package.name.padEnd(40)} ${r.reason}`
    );
    const summary = `\n---\n${critical} critical · ${high + medium} warnings · ${clean} clean`;
    downloadFile(lines.join('\n') + summary, 'slopcheck-results.txt', 'text/plain');
  }

  return (
    <div className="mt-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <p className="text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
          <span style={{ color: 'var(--critical)' }}>{critical} critical</span>
          {' · '}
          <span style={{ color: 'var(--warning)' }}>{high + medium} warnings</span>
          {' · '}
          <span style={{ color: 'var(--clean)' }}>{clean} clean</span>
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
          className="grid text-xs tracking-widest px-4 py-3 border-b"
          style={{
            gridTemplateColumns: '160px 1fr 1fr 120px',
            borderColor: 'var(--border)',
            color: 'var(--muted)',
          }}
        >
          <span>STATUS</span>
          <span>PACKAGE</span>
          <span>REASON</span>
          <span className="text-right">REGISTRY</span>
        </div>

        {/* Rows */}
        {results.map((r, i) => (
          <div
            key={i}
            className="grid text-xs px-4 py-3 border-b animate-fade-in-up"
            style={{
              gridTemplateColumns: '160px 1fr 1fr 120px',
              borderColor: 'var(--border)',
              animationDelay: `${i * 40}ms`,
              animationFillMode: 'both',
              opacity: 0,
            }}
          >
            <span style={{ color: SEVERITY_COLOR[r.severity] }}>
              {SEVERITY_LABEL[r.severity]}
            </span>
            <span style={{ color: 'var(--fg)' }}>{r.package.name}</span>
            <span style={{ color: 'var(--muted)' }}>{r.reason}</span>
            <span className="text-right">
              {r.registryUrl ? (
                <a
                  href={r.registryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  VIEW ↗
                </a>
              ) : (
                <span style={{ color: 'var(--muted)' }}>—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
