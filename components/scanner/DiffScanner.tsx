'use client';

import { useState } from 'react';
import { detectAndParse, detectEcosystem, ECOSYSTEM_META } from '@/lib/parsers';
import { runScan } from '@/lib/scanner';
import type { ScanResult, Severity } from '@/lib/types';
import type { EcosystemHint } from '@/lib/parsers';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, clean: 3, unsupported: 4 };

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--critical)',
  high: 'var(--warning)',
  medium: 'var(--warning)',
  clean: 'var(--clean)',
  unsupported: 'var(--muted)',
};

const ECOSYSTEMS: { label: string; value: EcosystemHint }[] = [
  { label: 'AUTO', value: 'auto' },
  { label: 'npm', value: 'npm' },
  { label: 'PyPI', value: 'pypi' },
  { label: 'RubyGems', value: 'rubygems' },
  { label: 'Go', value: 'go' },
  { label: 'Cargo', value: 'cargo' },
];

interface DiffRow {
  name: string;
  status: 'added' | 'removed' | 'escalated' | 'improved' | 'stable';
  before: ScanResult | null;
  after: ScanResult | null;
}

function buildDiff(before: ScanResult[], after: ScanResult[]): DiffRow[] {
  const beforeMap = new Map(before.map(r => [r.package.name.toLowerCase(), r]));
  const afterMap = new Map(after.map(r => [r.package.name.toLowerCase(), r]));
  const rows: DiffRow[] = [];

  for (const [key, a] of afterMap) {
    const b = beforeMap.get(key);
    if (!b) { rows.push({ name: a.package.name, status: 'added', before: null, after: a }); continue; }
    const bOrd = SEVERITY_ORDER[b.severity];
    const aOrd = SEVERITY_ORDER[a.severity];
    const status = aOrd < bOrd ? 'escalated' : aOrd > bOrd ? 'improved' : 'stable';
    rows.push({ name: a.package.name, status, before: b, after: a });
  }
  for (const [key, b] of beforeMap) {
    if (!afterMap.has(key)) rows.push({ name: b.package.name, status: 'removed', before: b, after: null });
  }

  const order = { added: 0, escalated: 1, removed: 2, improved: 3, stable: 4 };
  return rows.sort((a, b) => order[a.status] - order[b.status]);
}

const STATUS_LABEL: Record<DiffRow['status'], string> = {
  added: '+ ADDED',
  removed: '- REMOVED',
  escalated: '↑ WORSE',
  improved: '↓ BETTER',
  stable: '= STABLE',
};
const STATUS_COLOR: Record<DiffRow['status'], string> = {
  added: 'var(--critical)',
  removed: '#555',
  escalated: 'var(--warning)',
  improved: 'var(--clean)',
  stable: '#444',
};

function ManifestPane({
  label, value, ecosystem, onValue, onEcosystem, detected,
}: {
  label: string; value: string; ecosystem: EcosystemHint;
  onValue: (v: string) => void; onEcosystem: (e: EcosystemHint) => void;
  detected: string | null;
}) {
  return (
    <div className="flex flex-col" style={{ border: '1px solid var(--border)', background: '#0f0f0f' }}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
        <span className="tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
        {detected && (
          <span className="text-xs px-2 py-0.5 tracking-wider shrink-0" style={{ border: '1px solid var(--clean)', color: 'var(--clean)' }}>
            {detected}
          </span>
        )}
        <select
          value={ecosystem}
          onChange={e => onEcosystem(e.target.value as EcosystemHint)}
          className="text-xs bg-transparent outline-none cursor-pointer ml-auto shrink-0"
          style={{ color: 'var(--fg)', border: '1px solid var(--border)', padding: '2px 4px', fontFamily: 'var(--font-mono)' }}
        >
          {ECOSYSTEMS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <textarea
        value={value}
        onChange={e => onValue(e.target.value)}
        placeholder={`Paste ${label.toLowerCase()} manifest...`}
        rows={8}
        className="flex-1 w-full bg-transparent outline-none resize-none px-3 py-3 text-xs leading-relaxed"
        style={{ color: 'var(--fg)', caretColor: 'var(--fg)', fontFamily: 'var(--font-mono)' }}
        spellCheck={false}
      />
    </div>
  );
}

export default function DiffScanner() {
  const [beforeContent, setBeforeContent] = useState('');
  const [afterContent, setAfterContent] = useState('');
  const [beforeEco, setBeforeEco] = useState<EcosystemHint>('auto');
  const [afterEco, setAfterEco] = useState<EcosystemHint>('auto');
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function detectLabel(content: string, eco: EcosystemHint): string | null {
    if (!content.trim() || eco !== 'auto') return null;
    const detected = detectEcosystem(content);
    const meta = ECOSYSTEM_META[detected];
    return `${meta.file}`;
  }

  async function runDiff() {
    if (!beforeContent.trim() || !afterContent.trim() || loading) return;
    setError(null);
    setDiff(null);
    setLoading(true);

    const beforePkgs = detectAndParse(beforeContent, beforeEco, true);
    const afterPkgs = detectAndParse(afterContent, afterEco, true);

    if (beforePkgs.length === 0 || afterPkgs.length === 0) {
      setError('Could not parse one or both manifests. Check the format.');
      setLoading(false);
      return;
    }

    try {
      const [beforeResults, afterResults] = await Promise.all([
        new Promise<ScanResult[]>(resolve => {
          const acc: ScanResult[] = [];
          runScan(beforePkgs, { onResult: r => acc.push(r), onNetworkEvent: () => {}, onOsvResult: () => {} }).then(() => resolve(acc));
        }),
        new Promise<ScanResult[]>(resolve => {
          const acc: ScanResult[] = [];
          runScan(afterPkgs, { onResult: r => acc.push(r), onNetworkEvent: () => {}, onOsvResult: () => {} }).then(() => resolve(acc));
        }),
      ]);
      setDiff(buildDiff(beforeResults, afterResults));
    } catch {
      setError('Scan failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const diffSummary = diff ? {
    added: diff.filter(r => r.status === 'added').length,
    removed: diff.filter(r => r.status === 'removed').length,
    escalated: diff.filter(r => r.status === 'escalated').length,
    improved: diff.filter(r => r.status === 'improved').length,
  } : null;

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <ManifestPane
          label="BEFORE" value={beforeContent} ecosystem={beforeEco}
          onValue={setBeforeContent} onEcosystem={setBeforeEco}
          detected={detectLabel(beforeContent, beforeEco)}
        />
        <ManifestPane
          label="AFTER" value={afterContent} ecosystem={afterEco}
          onValue={setAfterContent} onEcosystem={setAfterEco}
          detected={detectLabel(afterContent, afterEco)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 mb-6">
        {error && <span className="text-xs tracking-widest" style={{ color: 'var(--critical)' }}>{error}</span>}
        <button
          onClick={runDiff}
          disabled={!beforeContent.trim() || !afterContent.trim() || loading}
          className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          {loading ? 'SCANNING...' : 'DIFF →'}
        </button>
      </div>

      {diff && (
        <div>
          {/* Summary */}
          <p className="text-xs tracking-widest mb-3 flex flex-wrap gap-3" style={{ color: 'var(--muted)' }}>
            <span style={{ color: 'var(--fg)' }}>DIFF COMPLETE</span>
            <span>·</span>
            {diffSummary!.escalated > 0 && <><span style={{ color: 'var(--warning)' }}>{diffSummary!.escalated} WORSE</span><span>·</span></>}
            {diffSummary!.added > 0 && <><span style={{ color: 'var(--critical)' }}>{diffSummary!.added} ADDED</span><span>·</span></>}
            {diffSummary!.removed > 0 && <><span style={{ color: '#555' }}>{diffSummary!.removed} REMOVED</span><span>·</span></>}
            {diffSummary!.improved > 0 && <><span style={{ color: 'var(--clean)' }}>{diffSummary!.improved} BETTER</span><span>·</span></>}
            <span>{diff.length} total packages</span>
          </p>

          {/* Table */}
          <div style={{ border: '1px solid var(--border)', maxHeight: '500px', overflowY: 'auto' }}>
            {/* Header */}
            <div
              className="grid text-xs tracking-widest px-3 py-2 border-b"
              style={{ gridTemplateColumns: '100px 1fr 100px 100px', borderColor: 'var(--border)', background: '#111', color: 'var(--muted)', position: 'sticky', top: 0 }}
            >
              <span>STATUS</span>
              <span>PACKAGE</span>
              <span>BEFORE</span>
              <span>AFTER</span>
            </div>

            {diff.map((row, i) => (
              <div
                key={i}
                className="grid items-center text-xs px-3 py-2 border-b"
                style={{ gridTemplateColumns: '100px 1fr 100px 100px', borderColor: 'var(--border)', background: row.status === 'stable' ? 'transparent' : undefined }}
              >
                <span className="font-bold tracking-widest" style={{ color: STATUS_COLOR[row.status] }}>
                  {STATUS_LABEL[row.status]}
                </span>
                <span style={{ color: 'var(--fg)' }}>
                  {row.name}
                  <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 4 }}>
                    {row.after?.package.version ?? row.before?.package.version ?? ''}
                  </span>
                </span>
                <span style={{ color: row.before ? SEVERITY_COLOR[row.before.severity] : '#333' }}>
                  {row.before ? row.before.severity.toUpperCase() : '—'}
                </span>
                <span style={{ color: row.after ? SEVERITY_COLOR[row.after.severity] : '#333' }}>
                  {row.after ? row.after.severity.toUpperCase() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
