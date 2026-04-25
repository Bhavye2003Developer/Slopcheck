'use client';

import { useState, useCallback } from 'react';
import ScanProgress from './ScanProgress';
import ResultsTable from './ResultsTable';
import NetworkTrail from './NetworkTrail';
import ThreatDial from './ThreatDial';
import { detectAndParse } from '@/lib/parsers';
import { runScan } from '@/lib/scanner';
import type { ScanResult, NetworkEvent, Severity } from '@/lib/types';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, clean: 3, unsupported: 4 };

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

export default function GithubScanner() {
  const [ghUrl, setGhUrl] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghFetched, setGhFetched] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMs, setScanMs] = useState<number | null>(null);

  const runGhScan = useCallback(async (content: string) => {
    setError(null);
    setResults([]);
    setNetworkEvents([]);
    setProgress(null);
    setScanMs(null);
    const scanStart = Date.now();

    const packages = detectAndParse(content, 'auto', true);
    if (packages.length === 0) {
      setError('No packages found in this manifest.');
      return;
    }

    setLoading(true);
    setScanning(true);
    setProgress({ done: 0, total: packages.length });

    try {
      await runScan(packages, {
        onResult: (result, done, total) => {
          setProgress({ done, total });
          setResults(prev => [...prev, result].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]));
        },
        onNetworkEvent: event => setNetworkEvents(prev => [...prev, event]),
        onOsvResult: updated => {
          setResults(prev =>
            prev.map(r =>
              r.package.name === updated.package.name && r.package.ecosystem === updated.package.ecosystem
                ? updated : r
            )
          );
        },
      });
    } catch {
      setError('Scan failed. Check your connection and try again.');
    } finally {
      setScanMs(Date.now() - scanStart);
      setLoading(false);
      setScanning(false);
    }
  }, []);

  async function handleFetch() {
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
      await runGhScan(result.content);
    } catch {
      setGhError('Fetch failed. Check the URL or your connection.');
    } finally {
      setGhLoading(false);
    }
  }

  return (
    <>
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
          <span className="tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>GITHUB URL</span>
          {ghFetched && (
            <span className="px-2 py-0.5 tracking-wider" style={{ border: '1px solid var(--clean)', color: 'var(--clean)' }}>
              LOADED: {ghFetched}
            </span>
          )}
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Paste a GitHub repo or file URL. Supports public repos —{' '}
            <span style={{ color: 'var(--fg)' }}>package.json, requirements.txt, go.mod, Cargo.toml, Gemfile</span>.
          </p>
          <div className="flex flex-wrap gap-3 items-start">
            <input
              type="url"
              value={ghUrl}
              onChange={e => setGhUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleFetch(); }}
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
              onClick={handleFetch}
              disabled={!ghUrl.trim() || ghLoading || loading}
              className="px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30 shrink-0"
              style={{ background: 'var(--fg)', color: 'var(--bg)', fontFamily: 'var(--font-mono)' }}
            >
              {ghLoading ? 'FETCHING...' : 'FETCH + SCAN →'}
            </button>
          </div>
          {ghError && (
            <p className="text-xs tracking-widest" style={{ color: 'var(--critical)' }}>{ghError}</p>
          )}
        </div>
      </div>

      {scanning && progress && (
        <ScanProgress done={progress.done} total={progress.total} />
      )}

      {error && (
        <p className="mt-4 text-xs tracking-widest" style={{ color: 'var(--critical)' }}>{error}</p>
      )}

      {!scanning && results.length > 0 && (
        <ThreatDial results={results} />
      )}

      {results.length > 0 && (
        <ResultsTable results={results} scanning={scanning} scanMs={scanMs ?? undefined} />
      )}

      <NetworkTrail events={networkEvents} />
    </>
  );
}
