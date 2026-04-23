'use client';

import { useState, useMemo, useRef } from 'react';
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
  const pasteFlag = useRef(false);

  const detected = useMemo<string | null>(() => {
    if (!content.trim() || ecosystem !== 'auto') return null;
    const eco = detectEcosystem(content);
    const meta = ECOSYSTEM_META[eco];
    return `${meta.file} - ${meta.label}`;
  }, [content, ecosystem]);

  function handleScan(text = content) {
    if (!text.trim() || loading) return;
    onScan(text, ecosystem, includeDevDeps);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (pasteFlag.current) {
      pasteFlag.current = false;
      setTimeout(() => {
        if (val.trim() && !loading) onScan(val, ecosystem, includeDevDeps);
      }, 100);
    }
  }

  function handlePaste() {
    pasteFlag.current = true;
  }

  return (
    <div className="rounded text-xs" style={{ border: '1px solid var(--border)', background: '#0f0f0f' }}>
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>PASTE MANIFEST</span>
        {detected && (
          <span className="text-xs px-2 py-0.5 tracking-wider" style={{ border: '1px solid var(--clean)', color: 'var(--clean)', maxWidth: 'min(100%, 220px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            DETECTED: {detected}
          </span>
        )}
        <select
          value={ecosystem}
          onChange={e => setEcosystem(e.target.value as EcosystemHint)}
          className="text-xs tracking-wider bg-transparent outline-none cursor-pointer ml-auto shrink-0"
          style={{ color: 'var(--fg)', border: '1px solid var(--border)', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}
        >
          {FORMAT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={'Paste contents here...\n\ne.g. package.json, requirements.txt, go.mod'}
        rows={10}
        className="w-full bg-transparent outline-none resize-none px-4 py-4 text-xs leading-relaxed"
        style={{ color: 'var(--fg)', caretColor: 'var(--fg)', fontFamily: 'var(--font-mono)' }}
        spellCheck={false}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={includeDevDeps} onChange={e => setIncludeDevDeps(e.target.checked)} className="accent-current" />
          INCLUDE DEV DEPENDENCIES
        </label>
        <button
          onClick={() => handleScan()}
          disabled={!content.trim() || loading}
          className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          {loading ? 'SCANNING...' : 'SCAN →'}
        </button>
      </div>
    </div>
  );
}
