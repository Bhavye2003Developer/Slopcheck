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

const MANIFEST_CANDIDATES = [
  'package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile', 'pyproject.toml',
];

interface ParsedGhUrl {
  owner: string; repo: string; branch: string | null; path: string | null;
}

function parseGitHubUrl(url: string): ParsedGhUrl | null {
  try {
    const u = new URL(url.trim().replace(/\/$/, ''));
    if (!u.hostname.endsWith('github.com') && !u.hostname.endsWith('githubusercontent.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    if (parts[2] === 'blob' && parts.length >= 5) {
      return { owner, repo, branch: parts[3], path: parts.slice(4).join('/') };
    }
    if (parts[2] === 'tree' && parts.length >= 4) {
      return { owner, repo, branch: parts[3], path: null };
    }
    return { owner, repo, branch: null, path: null };
  } catch {
    return null;
  }
}

async function fetchGitHubManifest(url: string): Promise<{ content: string; file: string } | null> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return null;
  const { owner, repo, branch, path } = parsed;

  if (path) {
    for (const b of branch ? [branch] : ['main', 'master']) {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${b}/${path}`);
      if (res.ok) return { content: await res.text(), file: path.split('/').pop() ?? path };
    }
    return null;
  }

  for (const b of branch ? [branch] : ['main', 'master']) {
    for (const file of MANIFEST_CANDIDATES) {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${b}/${file}`);
      if (res.ok) return { content: await res.text(), file };
    }
  }
  return null;
}

interface ScanInputProps {
  onScan: (content: string, ecosystem: EcosystemHint, includeDevDeps: boolean) => void;
  loading: boolean;
}

export default function ScanInput({ onScan, loading }: ScanInputProps) {
  const [source, setSource] = useState<'paste' | 'github'>('paste');
  const [content, setContent] = useState('');
  const [ecosystem, setEcosystem] = useState<EcosystemHint>('auto');
  const [includeDevDeps, setIncludeDevDeps] = useState(true);
  const [ghUrl, setGhUrl] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghFetched, setGhFetched] = useState<string | null>(null);
  const pasteFlag = useRef(false);

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

  async function handleGitHubFetch() {
    const trimmed = ghUrl.trim();
    if (!trimmed || ghLoading || loading) return;
    setGhError(null);
    setGhFetched(null);
    setGhLoading(true);
    try {
      const result = await fetchGitHubManifest(trimmed);
      if (!result) {
        setGhError('No supported manifest found. Try linking directly to the file.');
        return;
      }
      setGhFetched(result.file);
      setContent(result.content);
      setSource('paste');
      setTimeout(() => { if (!loading) onScan(result.content, ecosystem, includeDevDeps); }, 100);
    } catch {
      setGhError('Fetch failed. Check the URL or your connection.');
    } finally {
      setGhLoading(false);
    }
  }

  return (
    <div className="rounded text-xs" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        {/* Source tabs */}
        <div className="flex shrink-0" style={{ border: '1px solid var(--border)' }}>
          {(['paste', 'github'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setSource(s); setGhError(null); }}
              className="px-3 py-1 text-xs tracking-widest"
              style={{
                background: source === s ? 'var(--fg)' : 'transparent',
                color: source === s ? 'var(--bg)' : 'var(--muted)',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              }}
            >
              {s === 'paste' ? 'PASTE' : 'GITHUB'}
            </button>
          ))}
        </div>

        {source === 'paste' && detected && (
          <span className="text-xs px-2 py-0.5 tracking-wider" style={{ border: '1px solid var(--clean)', color: 'var(--clean)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            DETECTED: {detected}
          </span>
        )}
        {source === 'paste' && ghFetched && !detected && (
          <span className="text-xs px-2 py-0.5 tracking-wider" style={{ border: '1px solid var(--clean)', color: 'var(--clean)' }}>
            FROM GITHUB: {ghFetched}
          </span>
        )}

        {source === 'paste' && (
          <select
            value={ecosystem}
            onChange={e => setEcosystem(e.target.value as EcosystemHint)}
            className="text-xs tracking-wider bg-transparent outline-none cursor-pointer ml-auto shrink-0"
            style={{ color: 'var(--fg)', border: '1px solid var(--border)', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}
          >
            {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {source === 'paste' ? (
        <>
          <textarea
            value={content}
            onChange={handleChange}
            onPaste={() => { pasteFlag.current = true; }}
            placeholder={'Paste contents here...\n\ne.g. package.json, requirements.txt, go.mod'}
            rows={10}
            className="w-full bg-transparent outline-none resize-none px-4 py-4 text-xs leading-relaxed"
            style={{ color: 'var(--fg)', caretColor: 'var(--fg)', fontFamily: 'var(--font-mono)' }}
            spellCheck={false}
          />
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
        </>
      ) : (
        <div className="px-4 py-6 flex flex-col gap-4">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Paste a GitHub repo or file URL. Works with public repos — supports{' '}
            <span style={{ color: 'var(--fg)' }}>package.json, requirements.txt, go.mod, Cargo.toml, Gemfile</span>.
          </p>
          <div className="flex flex-wrap gap-3 items-start">
            <input
              type="url"
              value={ghUrl}
              onChange={e => setGhUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGitHubFetch(); }}
              placeholder="https://github.com/user/repo  or  .../blob/main/package.json"
              className="flex-1 bg-transparent outline-none text-xs"
              style={{
                color: 'var(--fg)', caretColor: 'var(--fg)',
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border)', padding: '8px 12px',
                minWidth: 240,
              }}
              spellCheck={false}
            />
            <button
              onClick={handleGitHubFetch}
              disabled={!ghUrl.trim() || ghLoading || loading}
              className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30 shrink-0"
              style={{ background: 'var(--fg)', color: 'var(--bg)', fontFamily: 'var(--font-mono)' }}
            >
              {ghLoading ? 'FETCHING...' : 'FETCH →'}
            </button>
          </div>
          {ghError && (
            <p className="text-xs tracking-widest" style={{ color: 'var(--critical)' }}>{ghError}</p>
          )}
        </div>
      )}
    </div>
  );
}
