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

async function fetchNpmMonthlyDownloads(): Promise<number | null> {
  try {
    const res = await fetch('https://api.npmjs.org/downloads/point/last-month/npm');
    if (!res.ok) return null;
    const data = await res.json() as { downloads?: number };
    return data.downloads ?? null;
  } catch { return null; }
}

async function fetchNpmPackageCount(): Promise<number | null> {
  // Try the stats endpoint which returns aggregate registry info
  try {
    const res = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/search?size=0');
    if (res.ok) {
      const data = await res.json() as { total?: number };
      if (data.total) return data.total;
    }
  } catch { /* fall through */ }

  // Fallback: fetch a known high-download package and use the registry's document count
  try {
    const res = await fetch('https://registry.npmjs.org/-/all/static/today.json');
    if (res.ok) {
      const data = await res.json() as { _updated?: number; [key: string]: unknown };
      const count = Object.keys(data).filter(k => !k.startsWith('_')).length;
      if (count > 100) return count;
    }
  } catch { /* fall through */ }

  // Fallback: use npm downloads for a wide set of packages as a proxy for total count
  try {
    const res = await fetch('https://api.npmjs.org/downloads/point/last-month/react,lodash,express,webpack,typescript,axios,vue,next,tailwindcss,eslint,prettier,jest,vite,react-dom,@types/node');
    if (!res.ok) return null;
    const data = await res.json() as Record<string, { downloads?: number }>;
    const total = Object.values(data).reduce((sum, v) => sum + (v.downloads ?? 0), 0);
    return total > 0 ? total : null;
  } catch { return null; }
}

async function fetchPypiDownloads(): Promise<number | null> {
  // Sum downloads for top PyPI packages using the per-package endpoint (known to work with CORS)
  const topPackages = ['numpy', 'pandas', 'requests', 'pip', 'setuptools', 'boto3', 'botocore', 'urllib3', 'certifi', 'charset-normalizer'];
  try {
    const results = await Promise.all(
      topPackages.map(async name => {
        try {
          const res = await fetch(`https://pypistats.org/api/packages/${name}/recent`);
          if (!res.ok) return 0;
          const data = await res.json() as { data?: { last_month?: number } };
          return data.data?.last_month ?? 0;
        } catch { return 0; }
      })
    );
    const total = results.reduce((a, b) => a + b, 0);
    return total > 0 ? total : null;
  } catch { return null; }
}

export default function LiveStats() {
  const [stats, setStats] = useState<(Stat | null)[]>([null, null, null]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchNpmPackageCount(),
      fetchPypiDownloads(),
      fetchNpmMonthlyDownloads(),
    ]).then(([npmPkgs, pypiDl, npmDl]) => {
      setStats([
        npmDl !== null ? {
          value: fmt(npmDl),
          label: 'npm CLI downloads\nlast 30 days',
          source: 'api.npmjs.org',
          sourceUrl: 'https://api.npmjs.org',
        } : null,
        pypiDl !== null ? {
          value: fmt(pypiDl),
          label: 'PyPI downloads (top 10 pkgs)\nlast 30 days',
          source: 'pypistats.org',
          sourceUrl: 'https://pypistats.org',
        } : null,
        npmPkgs !== null ? {
          value: fmt(npmPkgs),
          label: 'npm downloads\n(react + 14 core pkgs)',
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
              <div className="text-xs leading-relaxed whitespace-pre-line mb-3" style={{ color: '#aaa' }}>
                {s.label}
              </div>
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs transition-colors"
                style={{ color: '#777' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.color = '#777')}
              >
                SOURCE: {s.source} ↗
              </a>
            </>
          ) : (
            <div className="text-4xl font-bold mb-3 tracking-tight animate-pulse" style={{ color: '#333' }}>
              ——
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
