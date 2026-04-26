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
  const [isDragging, setIsDragging] = useState(false);
  const pasteFlag = useRef(false);
  const dragCounter = useRef(0);

  const detected = useMemo<string | null>(() => {
    if (!content.trim() || ecosystem !== 'auto') return null;
    const eco = detectEcosystem(content);
    return `${ECOSYSTEM_META[eco].file} - ${ECOSYSTEM_META[eco].label}`;
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
      setTimeout(() => { if (val.trim() && !loading) onScan(val, ecosystem, includeDevDeps); }, 100);
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (!text?.trim()) return;
      setContent(text);
      setTimeout(() => { if (!loading) onScan(text, ecosystem, includeDevDeps); }, 100);
    };
    reader.readAsText(file);
  }

  return (
    <div
      className="rounded text-xs relative"
      style={{ border: `1px solid ${isDragging ? 'var(--warning)' : 'var(--border)'}`, background: 'var(--surface)', transition: 'border-color 0.15s' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded pointer-events-none"
          style={{ background: 'rgba(10,10,10,0.88)', border: '2px dashed var(--warning)' }}
        >
          <span className="text-2xl md:text-3xl font-black tracking-widest" style={{ color: 'var(--warning)', wordSpacing: '-0.15em' }}>
            DROP TO SCAN
          </span>
          <span className="text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
            package.json · requirements.txt · go.mod · Cargo.toml · Gemfile
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        {detected && (
          <span className="text-xs px-2 py-0.5 tracking-wider" style={{ border: '1px solid var(--clean)', color: 'var(--clean)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            DETECTED: {detected}
          </span>
        )}
        <select
          value={ecosystem}
          onChange={e => setEcosystem(e.target.value as EcosystemHint)}
          className="text-xs tracking-wider bg-transparent outline-none cursor-pointer ml-auto shrink-0"
          style={{ color: 'var(--fg)', border: '1px solid var(--border)', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}
        >
          {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        onPaste={() => { pasteFlag.current = true; }}
        placeholder={'Paste or drop a file here...\n\ne.g. package.json, requirements.txt, go.mod'}
        rows={10}
        className="w-full bg-transparent outline-none resize-none px-4 py-4 text-xs leading-relaxed"
        style={{ color: 'var(--fg)', caretColor: 'var(--fg)', fontFamily: 'var(--font-mono)' }}
        spellCheck={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={includeDevDeps} onChange={e => setIncludeDevDeps(e.target.checked)} className="accent-current" />
          INCLUDE DEV DEPENDENCIES
        </label>
        <button
          onClick={() => handleScan()}
          disabled={!content.trim() || loading}
          className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30 shrink-0"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          {loading ? 'SCANNING...' : 'SCAN →'}
        </button>
      </div>
    </div>
  );
}
