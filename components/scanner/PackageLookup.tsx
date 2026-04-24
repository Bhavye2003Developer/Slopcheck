'use client';

import { useState } from 'react';
import type { EcosystemHint } from '@/lib/parsers';

type Eco = Exclude<EcosystemHint, 'auto'>;

const ECOSYSTEMS: { label: string; value: Eco; placeholder: string }[] = [
  { label: 'npm',   value: 'npm',      placeholder: 'lodash  or  lodash@4.17.21  or  @types/react' },
  { label: 'PyPI',  value: 'pypi',     placeholder: 'flask  or  flask==2.0.1  or  requests>=2.28' },
  { label: 'Go',    value: 'go',       placeholder: 'github.com/gin-gonic/gin  or  @v1.9.1' },
  { label: 'Cargo', value: 'cargo',    placeholder: 'serde  or  serde@1.0' },
  { label: 'Ruby',  value: 'rubygems', placeholder: 'rails  or  rails@7.0' },
];

function parsePkgInput(input: string): { name: string; version: string | null } {
  const t = input.trim();
  if (t.startsWith('@')) {
    const second = t.indexOf('@', 1);
    if (second > 1) return { name: t.slice(0, second), version: t.slice(second + 1) || null };
    return { name: t, version: null };
  }
  const opMatch = t.match(/^([a-zA-Z0-9_.\-/]+)[>=!~^<]+(.+)$/);
  if (opMatch) return { name: opMatch[1], version: opMatch[2] };
  const atMatch = t.match(/^([^@]+)@(.+)$/);
  if (atMatch) return { name: atMatch[1], version: atMatch[2] };
  return { name: t, version: null };
}

function buildManifest(name: string, version: string | null, eco: Eco): string {
  const ver = version ?? '*';
  switch (eco) {
    case 'npm':
      return JSON.stringify({ dependencies: { [name]: ver } }, null, 2);
    case 'pypi':
      return version ? `${name}==${version}` : name;
    case 'go':
      return `module check\ngo 1.21\nrequire ${name} ${version ?? 'v0.0.0'}`;
    case 'cargo':
      return `[package]\nname = "check"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${name} = "${ver}"`;
    case 'rubygems':
      return version ? `gem '${name}', '${version}'` : `gem '${name}'`;
  }
}

interface Props {
  onScan: (content: string, ecosystem: EcosystemHint, includeDevDeps: boolean) => void;
  loading: boolean;
}

export default function PackageLookup({ onScan, loading }: Props) {
  const [input, setInput] = useState('');
  const [eco, setEco] = useState<Eco>('npm');

  const ecoMeta = ECOSYSTEMS.find(e => e.value === eco)!;

  function handleLookup() {
    const t = input.trim();
    if (!t || loading) return;
    const { name, version } = parsePkgInput(t);
    onScan(buildManifest(name, version, eco), eco, false);
  }

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Title bar + ecosystem tabs */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
        <span className="tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>PACKAGE LOOKUP</span>
        <div className="flex gap-1 flex-wrap">
          {ECOSYSTEMS.map(e => (
            <button
              key={e.value}
              onClick={() => setEco(e.value)}
              className="px-2 py-0.5 text-xs tracking-widest"
              style={{
                border: `1px solid ${eco === e.value ? 'var(--fg)' : 'var(--border)'}`,
                background: eco === e.value ? 'var(--fg)' : 'transparent',
                color: eco === e.value ? 'var(--bg)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
          placeholder={ecoMeta.placeholder}
          className="flex-1 bg-transparent outline-none text-xs"
          style={{
            color: 'var(--fg)', caretColor: 'var(--fg)',
            fontFamily: 'var(--font-mono)',
            border: '1px solid var(--border)', padding: '8px 12px',
            minWidth: 220,
          }}
          spellCheck={false}
        />
        <button
          onClick={handleLookup}
          disabled={!input.trim() || loading}
          className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30 shrink-0"
          style={{ background: 'var(--fg)', color: 'var(--bg)', fontFamily: 'var(--font-mono)' }}
        >
          {loading ? 'SCANNING...' : 'LOOKUP →'}
        </button>
      </div>
    </div>
  );
}
