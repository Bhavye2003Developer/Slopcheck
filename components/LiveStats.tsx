'use client';

import { useEffect, useState } from 'react';

interface Stat {
  value: string;
  label: string;
  source: string;
  sourceUrl: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

async function fetchNpmPackageCount(): Promise<number | null> {
  try {
    const res = await fetch('https://registry.npmjs.org/-/v1/search?text=*&size=0');
    if (!res.ok) return null;
    const data = await res.json() as { total?: number };
    return data.total ?? null;
  } catch { return null; }
}

async function fetchPypiMonthlyDownloads(): Promise<number | null> {
  try {
    const res = await fetch('https://pypistats.org/api/packages/__all__/recent');
    if (!res.ok) return null;
    const data = await res.json() as { data?: { last_month?: number } };
    return data.data?.last_month ?? null;
  } catch { return null; }
}

async function fetchNpmMonthlyDownloads(): Promise<number | null> {
  // Use the npmjs.com download counts for the registry as a whole via a bulk query
  try {
    const res = await fetch('https://api.npmjs.org/downloads/point/last-month/npm');
    if (!res.ok) return null;
    const data = await res.json() as { downloads?: number };
    return data.downloads ?? null;
  } catch { return null; }
}

export default function LiveStats() {
  const [stats, setStats] = useState<(Stat | null)[]>([null, null, null]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchNpmPackageCount(),
      fetchPypiMonthlyDownloads(),
      fetchNpmMonthlyDownloads(),
    ]).then(([npmPkgs, pypiDl, npmDl]) => {
      setStats([
        npmPkgs !== null ? {
          value: fmt(npmPkgs),
          label: 'packages\npublished on npm',
          source: 'registry.npmjs.org',
          sourceUrl: 'https://registry.npmjs.org',
        } : null,
        pypiDl !== null ? {
          value: fmt(pypiDl),
          label: 'PyPI downloads\nlast 30 days',
          source: 'pypistats.org',
          sourceUrl: 'https://pypistats.org',
        } : null,
        npmDl !== null ? {
          value: fmt(npmDl),
          label: 'npm CLI downloads\nlast 30 days',
          source: 'api.npmjs.org',
          sourceUrl: 'https://api.npmjs.org',
        } : null,
      ]);
      setLoaded(true);
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: 'var(--border)' }}>
      {stats.map((s, i) => (
        <div key={i} className="px-6 md:px-8 py-10" style={{ background: 'var(--bg)' }}>
          {s && loaded ? (
            <>
              <div className="text-4xl md:text-5xl font-bold mb-3 tracking-tight" style={{ color: 'var(--warning)' }}>
                {s.value}
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-line mb-3" style={{ color: '#999' }}>
                {s.label}
              </div>
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555')}
              >
                SOURCE: {s.source} ↗
              </a>
            </>
          ) : (
            <div className="text-4xl font-bold mb-3 tracking-tight" style={{ color: '#222' }}>
              ——
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
