'use client';

import { useState, useEffect } from 'react';
import type { EcosystemHint } from '@/lib/parsers';
import { detectEcosystem, ECOSYSTEM_META } from '@/lib/parsers';

const FORMAT_OPTIONS: { label: string; value: EcosystemHint }[] = [
  { label: 'AUTO-DETECT', value: 'auto' },
  { label: 'package.json (npm)', value: 'npm' },
  { label: 'requirements.txt (PyPI)', value: 'pypi' },
  { label: 'Gemfile (RubyGems)', value: 'rubygems' },
  { label: 'go.mod (Go)', value: 'go' },
  { label: 'Cargo.toml (Rust)', value: 'cargo' },
];

interface ScanInputProps {
  onScan: (content: string, ecosystem: EcosystemHint, includeDevDeps: boolean) => void;
  loading: boolean;
}

export default function ScanInput({ onScan, loading }: ScanInputProps) {
  const [content, setContent] = useState('');
  const [ecosystem, setEcosystem] = useState<EcosystemHint>('auto');
  const [includeDevDeps, setIncludeDevDeps] = useState(true);
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    if (!content.trim()) { setDetected(null); return; }
    if (ecosystem !== 'auto') { setDetected(null); return; }
    const eco = detectEcosystem(content);
    const meta = ECOSYSTEM_META[eco];
    setDetected(`${meta.file} - ${meta.label}`);
  }, [content, ecosystem]);

  function handleScan() {
    if (!content.trim() || loading) return;
    onScan(content, ecosystem, includeDevDeps);
  }

  return (
    <div className="rounded text-xs" style={{ border: '1px solid var(--border)', background: '#0f0f0f' }}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>PASTE MANIFEST</span>
          {detected && (
            <span className="truncate text-xs px-2 py-0.5 tracking-wider" style={{ border: '1px solid var(--clean)', color: 'var(--clean)' }}>
              DETECTED: {detected}
            </span>
          )}
        </div>
        <select
          value={ecosystem}
          onChange={e => setEcosystem(e.target.value as EcosystemHint)}
          className="text-xs tracking-wider bg-transparent outline-none cursor-pointer ml-3 shrink-0"
          style={{ color: 'var(--fg)', border: '1px solid var(--border)', padding: '2px 6px' }}
        >
          {FORMAT_OPTIONS.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#0f0f0f' }}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={'Paste contents here...\n\ne.g. package.json, requirements.txt, go.mod'}
        rows={10}
        className="w-full bg-transparent outline-none resize-none px-4 py-4 text-xs leading-relaxed"
        style={{ color: 'var(--fg)', caretColor: 'var(--fg)' }}
        spellCheck={false}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={includeDevDeps} onChange={e => setIncludeDevDeps(e.target.checked)} className="accent-current" />
          INCLUDE DEV DEPENDENCIES
        </label>
        <button
          onClick={handleScan}
          disabled={!content.trim() || loading}
          className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          {loading ? 'SCANNING...' : 'SCAN ->'}
        </button>
      </div>
    </div>
  );
}
