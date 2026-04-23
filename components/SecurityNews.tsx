'use client';

import { useEffect, useState, startTransition } from 'react';

interface CveItem {
  id: string;
  published: string;
  description: string;
  severity: string;
  score: number | null;
}

type RawMetric = { cvssData: { baseScore: number; baseSeverity: string } }[];
type RawVuln = {
  cve: {
    id: string;
    published: string;
    descriptions: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: RawMetric;
      cvssMetricV30?: RawMetric;
    };
  };
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ff4444',
  HIGH: '#ff7700',
  MEDIUM: '#ffaa00',
};

function relDate(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'TODAY';
  if (d === 1) return '1D AGO';
  return `${d}D AGO`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseCves(data: { vulnerabilities?: RawVuln[] }): CveItem[] {
  return (data.vulnerabilities ?? [])
    .map(v => {
      const cve = v.cve;
      const desc = cve.descriptions.find(d => d.lang === 'en')?.value ?? '';
      const cvss =
        cve.metrics?.cvssMetricV31?.[0]?.cvssData ??
        cve.metrics?.cvssMetricV30?.[0]?.cvssData;
      return {
        id: cve.id,
        published: cve.published,
        description: desc.length > 110 ? desc.slice(0, 110) + '…' : desc,
        severity: cvss?.baseSeverity ?? '',
        score: cvss?.baseScore ?? null,
      };
    })
    .filter(c => c.severity === 'CRITICAL' || c.severity === 'HIGH')
    .slice(0, 6);
}

export default function SecurityNews() {
  const [items, setItems] = useState<CveItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fmt = (d: Date) => d.toISOString().slice(0, 19) + '.000';
    const end = fmt(new Date());
    const start = fmt(new Date(Date.now() - 30 * 86_400_000));
    fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20&pubStartDate=${start}&pubEndDate=${end}`
    )
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: { vulnerabilities?: RawVuln[] }) => {
        const parsed = parseCves(data);
        startTransition(() => {
          setItems(parsed);
          setReady(true);
        });
      })
      .catch(() => {
        startTransition(() => setReady(true));
      });
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section
      id="news"
      className="px-4 md:px-6 py-6"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <p className="text-xs tracking-widest" style={{ color: 'var(--critical)' }}>
            THREAT INTEL
          </p>
          <span className="text-xs" style={{ color: '#333' }}>
            · recent critical CVEs · source: NVD
          </span>
          <span
            className="text-xs px-2 py-0.5 tracking-widest"
            style={{ border: '1px solid #2a2a2a', color: '#444' }}
          >
            LIVE
          </span>
        </div>

        <div style={{ border: '1px solid var(--border)' }}>
          {items.map((item, i) => {
            const color = SEV_COLOR[item.severity] ?? '#888';
            const isLast = i === items.length - 1;
            return (
              <a
                key={item.id}
                href={`https://nvd.nist.gov/vuln/detail/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-wrap md:flex-nowrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-xs transition-colors"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'var(--muted)',
                  background: '#060606',
                  display: 'flex',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0f0f0f')}
                onMouseLeave={e => (e.currentTarget.style.background = '#060606')}
              >
                <span className="font-bold shrink-0" style={{ color, minWidth: 140 }}>
                  {item.id}
                </span>
                <span className="shrink-0" style={{ color, minWidth: 100 }}>
                  {item.severity}
                  {item.score !== null && (
                    <span style={{ color: '#888', fontWeight: 'normal' }}> {item.score.toFixed(1)}</span>
                  )}
                </span>
                <span className="flex-1 min-w-0" style={{ color: 'var(--muted)' }}>
                  {item.description}
                </span>
                <span className="shrink-0 ml-4 hidden md:block" style={{ color: '#555' }} title={item.published}>
                  {fmtDate(item.published)}
                </span>
                <span className="shrink-0 ml-2 hidden md:block" style={{ color: '#333' }}>
                  {relDate(item.published)}
                </span>
                <span className="shrink-0 ml-2" style={{ color: '#333' }}>↗</span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
