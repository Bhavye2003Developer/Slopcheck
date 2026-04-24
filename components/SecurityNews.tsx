'use client';

import { useEffect, useState, startTransition } from 'react';

interface NewsItem {
  id: string;
  label: string;
  description: string;
  url: string;
  date: string;
  type: 'CVE' | 'NEWS';
  source: string;
  badge: string;
  badgeColor: string;
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

type HnHit = {
  objectID: string;
  title: string;
  url: string | null;
  created_at: string;
  points: number;
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'var(--critical)',
  HIGH: 'var(--orange)',
};

function relDate(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'TODAY';
  if (d === 1) return '1D AGO';
  return `${d}D AGO`;
}

function parseCves(data: { vulnerabilities?: RawVuln[] }): NewsItem[] {
  return (data.vulnerabilities ?? [])
    .flatMap(v => {
      const cve = v.cve;
      const desc = cve.descriptions.find(d => d.lang === 'en')?.value ?? '';
      const cvss =
        cve.metrics?.cvssMetricV31?.[0]?.cvssData ??
        cve.metrics?.cvssMetricV30?.[0]?.cvssData;
      const severity = cvss?.baseSeverity ?? '';
      if (severity !== 'CRITICAL' && severity !== 'HIGH') return [];
      const score = cvss?.baseScore ?? null;
      return [{
        id: cve.id,
        label: cve.id,
        description: desc.length > 130 ? desc.slice(0, 130) + '…' : desc,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
        date: cve.published,
        type: 'CVE' as const,
        source: 'NVD',
        badge: severity + (score !== null ? ` ${score.toFixed(1)}` : ''),
        badgeColor: SEV_COLOR[severity] ?? '#888',
      }];
    })
    .slice(0, 10);
}

function parseHnStories(data: { hits?: HnHit[] }): NewsItem[] {
  return (data.hits ?? [])
    .filter(h => h.url)
    .map(h => ({
      id: h.objectID,
      label: h.title,
      description: `${h.points} points on Hacker News`,
      url: h.url!,
      date: h.created_at,
      type: 'NEWS' as const,
      source: 'HN',
      badge: 'HN',
      badgeColor: '#ff6600',
    }))
    .slice(0, 10);
}

function Skeleton() {
  return (
    <section
      id="news"
      className="px-4 md:px-6 py-6"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <p className="text-xs tracking-widest" style={{ color: 'var(--critical)' }}>THREAT INTEL</p>
          <span className="text-xs" style={{ color: 'var(--dim-hi)' }}>· fetching...</span>
          <span className="text-xs px-2 py-0.5 tracking-widest font-bold" style={{ border: '1px solid var(--live)', color: 'var(--live)' }}>LIVE</span>
        </div>
        <div style={{ border: '1px solid var(--border)' }}>
          {[70, 55, 80, 45].map((w, i) => (
            <div
              key={i}
              className="px-4 py-3"
              style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}
            >
              <div style={{ height: 11, background: 'var(--panel)', borderRadius: 2, width: `${w}%`, marginBottom: 7 }} />
              <div style={{ height: 9, background: 'var(--panel)', borderRadius: 2, width: '90%' }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function SecurityNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fmt = (d: Date) => d.toISOString().slice(0, 19) + '.000';
    const end = fmt(new Date());
    const start = fmt(new Date(Date.now() - 7 * 86_400_000));

    const nvdUrl =
      `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20&pubStartDate=${start}&pubEndDate=${end}`;
    // search_by_date returns newest-first — no date filter needed, points>10 filters noise
    const hnUrl =
      `https://hn.algolia.com/api/v1/search_by_date?query=security+hacked+breach+vulnerability+exploit&tags=story&hitsPerPage=10&numericFilters=points>10`;

    Promise.allSettled([
      fetch(nvdUrl).then(r => (r.ok ? r.json() : Promise.reject())),
      fetch(hnUrl).then(r => (r.ok ? r.json() : Promise.reject())),
    ]).then(([nvdRes, hnRes]) => {
      const cves = nvdRes.status === 'fulfilled' ? parseCves(nvdRes.value) : [];
      const news = hnRes.status === 'fulfilled' ? parseHnStories(hnRes.value) : [];
      const merged = [...cves, ...news]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);
      startTransition(() => {
        setItems(merged);
        setLoading(false);
      });
    });
  }, []);

  if (loading) return <Skeleton />;
  if (items.length === 0) return null;

  return (
    <section
      id="news"
      className="px-4 md:px-6 py-6"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <p className="text-xs tracking-widest" style={{ color: 'var(--critical)' }}>THREAT INTEL</p>
          <span className="text-xs" style={{ color: 'var(--dim-hi)' }}>· recent CVEs + security incidents</span>
          <span
            className="text-xs px-2 py-0.5 tracking-widest font-bold"
            style={{ border: '1px solid var(--live)', color: 'var(--live)' }}
          >
            LIVE
          </span>
        </div>

        <div
          style={{
            border: '1px solid var(--border)',
            maxHeight: 480,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--scrollbar) transparent',
          }}
        >
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 text-xs"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  textDecoration: 'none',
                  background: 'var(--surface-deep)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-deep)')}
              >
                {/* Row 1: source · badge · label · age · arrow */}
                <div className="flex items-baseline gap-2 mb-1 min-w-0">
                  <span
                    className="shrink-0 font-bold"
                    style={{ color: item.type === 'CVE' ? 'var(--dim-label)' : '#ff6600', fontSize: 9, letterSpacing: '0.05em' }}
                  >
                    [{item.source}]
                  </span>
                  <span className="shrink-0 font-bold" style={{ color: item.badgeColor }}>
                    {item.badge}
                  </span>
                  <span
                    className="font-bold truncate min-w-0"
                    style={{ color: item.type === 'CVE' ? item.badgeColor : 'var(--fg)', flex: 1 }}
                  >
                    {item.label}
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--dim-mid)' }}>{relDate(item.date)}</span>
                  <span className="shrink-0" style={{ color: 'var(--dim-hi)' }}>↗</span>
                </div>
                {/* Row 2: description */}
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--dim-lo)', margin: 0, paddingLeft: 0 }}
                >
                  {item.description}
                </p>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
