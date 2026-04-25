'use client';

import { useState } from 'react';
import { detectAndParse } from '@/lib/parsers';
import { runScan } from '@/lib/scanner';
import type { ScanResult } from '@/lib/types';

type Eco = 'npm' | 'pypi' | 'cargo' | 'go' | 'rubygems';

const ECOSYSTEMS: { label: string; value: Eco; placeholder: string }[] = [
  { label: 'npm',   value: 'npm',      placeholder: 'lodash  or  @types/react  or  express@4.18' },
  { label: 'PyPI',  value: 'pypi',     placeholder: 'flask  or  flask==2.0.1  or  requests>=2.28' },
  { label: 'Cargo', value: 'cargo',    placeholder: 'serde  or  serde@1.0' },
  { label: 'Go',    value: 'go',       placeholder: 'github.com/gin-gonic/gin' },
  { label: 'Ruby',  value: 'rubygems', placeholder: 'rails  or  rails@7.0' },
];

interface RichMeta {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  maintainers?: number;
  totalVersions?: number;
  installCmd: string;
  registryUrl: string;
}

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
    case 'npm':      return JSON.stringify({ dependencies: { [name]: ver } }, null, 2);
    case 'pypi':     return version ? `${name}==${version}` : name;
    case 'go':       return `module check\ngo 1.21\nrequire ${name} ${version ?? 'v0.0.0'}`;
    case 'cargo':    return `[package]\nname = "check"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${name} = "${ver}"`;
    case 'rubygems': return version ? `gem '${name}', '${version}'` : `gem '${name}'`;
  }
}

async function fetchNpmMeta(name: string): Promise<RichMeta | null> {
  try {
    const encoded = name.startsWith('@') ? name.replace('/', '%2F') : name;
    const r = await fetch(`https://registry.npmjs.org/${encoded}`);
    if (!r.ok) return null;
    const d = await r.json();
    const latest = d['dist-tags']?.latest ?? '';
    const pkgData = d.versions?.[latest] ?? {};
    const repoRaw = typeof pkgData.repository === 'object' ? pkgData.repository?.url : undefined;
    const repo = repoRaw?.replace(/^git\+/, '').replace(/\.git$/, '');
    return {
      name: d.name,
      version: latest,
      description: d.description,
      homepage: pkgData.homepage ?? d.homepage,
      repository: repo,
      keywords: Array.isArray(d.keywords) ? d.keywords.slice(0, 8) : [],
      maintainers: d.maintainers?.length,
      totalVersions: Object.keys(d.versions ?? {}).length,
      installCmd: `npm install ${name}`,
      registryUrl: `https://www.npmjs.com/package/${name}`,
    };
  } catch { return null; }
}

async function fetchPypiMeta(name: string): Promise<RichMeta | null> {
  try {
    const r = await fetch(`https://pypi.org/pypi/${name}/json`);
    if (!r.ok) return null;
    const d = await r.json();
    const info = d.info;
    const keywords = info.keywords ? info.keywords.split(/[,\s]+/).filter(Boolean).slice(0, 8) : [];
    return {
      name: info.name,
      version: info.version,
      description: info.summary,
      homepage: info.home_page || info.project_urls?.Homepage || info.project_urls?.homepage,
      keywords,
      totalVersions: Object.keys(d.releases ?? {}).length,
      installCmd: `pip install ${name}`,
      registryUrl: `https://pypi.org/project/${name}/`,
    };
  } catch { return null; }
}

async function fetchCargoMeta(name: string): Promise<RichMeta | null> {
  try {
    const r = await fetch(`https://crates.io/api/v1/crates/${name}`, {
      headers: { 'User-Agent': 'slopcheck.com' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const c = d.crate;
    return {
      name: c.name,
      version: c.newest_version,
      description: c.description,
      homepage: c.homepage,
      repository: c.repository,
      totalVersions: d.versions?.length,
      installCmd: `cargo add ${name}`,
      registryUrl: `https://crates.io/crates/${name}`,
    };
  } catch { return null; }
}

async function fetchRubyMeta(name: string): Promise<RichMeta | null> {
  try {
    const r = await fetch(`https://rubygems.org/api/v1/gems/${name}.json`);
    if (!r.ok) return null;
    const d = await r.json();
    return {
      name: d.name,
      version: d.version,
      description: d.info,
      homepage: d.homepage_uri ?? d.project_uri,
      repository: d.source_code_uri,
      installCmd: `gem install ${name}`,
      registryUrl: `https://rubygems.org/gems/${name}`,
    };
  } catch { return null; }
}

async function fetchGoMeta(name: string): Promise<RichMeta | null> {
  try {
    const encoded = encodeURIComponent(name);
    const r = await fetch(`https://proxy.golang.org/${encoded}/@v/list`);
    const versions = r.ok ? (await r.text()).trim().split('\n').filter(Boolean) : [];
    const latest = versions[versions.length - 1] ?? 'v0.0.0';
    return {
      name,
      version: latest,
      totalVersions: versions.length || undefined,
      installCmd: `go get ${name}`,
      registryUrl: `https://pkg.go.dev/${name}`,
    };
  } catch { return null; }
}

async function fetchRichMeta(name: string, eco: Eco): Promise<RichMeta | null> {
  switch (eco) {
    case 'npm':      return fetchNpmMeta(name);
    case 'pypi':     return fetchPypiMeta(name);
    case 'cargo':    return fetchCargoMeta(name);
    case 'rubygems': return fetchRubyMeta(name);
    case 'go':       return fetchGoMeta(name);
  }
}

function fmtDownloads(n?: number): string {
  if (n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M/mo`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K/mo`;
  return `${n}/mo`;
}

function fmtAge(iso?: string): string {
  if (!iso) return '—';
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days < 30) return `${Math.floor(days)}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

function cveHref(id: string): string {
  return /^CVE-/i.test(id)
    ? `https://nvd.nist.gov/vuln/detail/${id}`
    : `https://osv.dev/vulnerability/${id}`;
}

const SEV_COLOR: Record<string, string> = {
  critical: 'var(--critical)',
  high: 'var(--orange)',
  medium: 'var(--warning)',
  clean: 'var(--clean)',
  unsupported: 'var(--muted)',
  CRITICAL: 'var(--critical)',
  HIGH: 'var(--orange)',
  MEDIUM: 'var(--warning)',
  LOW: 'var(--warning)',
};

const SEV_LABEL: Record<string, string> = {
  critical: 'CRITICAL RISK',
  high: 'HIGH RISK',
  medium: 'CAUTION',
  clean: 'CLEAN',
  unsupported: 'N/A',
};

const FLAG_DESC: Record<string, string> = {
  nonexistent: 'NOT FOUND on registry',
  typosquat: 'POSSIBLE TYPOSQUAT',
  recently_registered: 'NEWLY REGISTERED (< 30 days)',
  low_downloads: 'LOW DOWNLOAD COUNT',
  suspicious_script: 'SUSPICIOUS INSTALL SCRIPT',
  outdated: 'OUTDATED',
  low_adoption_latest: 'LOW ADOPTION ON LATEST VERSION',
  clean: 'No issues found',
  unsupported: 'Registry checks not supported',
  has_cve_critical: 'KNOWN CRITICAL CVEs',
  has_cve_high: 'KNOWN HIGH CVEs',
  has_cve_medium: 'KNOWN MEDIUM CVEs',
};

function StatCell({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold leading-none" style={{ color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div className="text-xs tracking-widest mt-1" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs tracking-wider"
      style={{ color: 'var(--fg)' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.55')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {label} →
    </a>
  );
}

function PkgCard({ rich, scan, cvesPending }: { rich: RichMeta; scan: ScanResult; cvesPending: boolean }) {
  const [cmdCopied, setCmdCopied] = useState(false);

  function copyCmd() {
    navigator.clipboard?.writeText(rich.installCmd).then(() => {
      setCmdCopied(true);
      setTimeout(() => setCmdCopied(false), 1500);
    });
  }

  const sevColor = SEV_COLOR[scan.severity] ?? 'var(--muted)';
  const sevLabel = SEV_LABEL[scan.severity] ?? scan.severity.toUpperCase();
  const flagDesc = FLAG_DESC[scan.flag] ?? scan.flag;
  const totalCves = scan.cves?.length ?? 0;
  const latestAvailable = scan.meta.latestVersion && scan.meta.latestVersion !== scan.package.version;

  return (
    <div style={{ border: `2px solid ${sevColor}` }}>
      {/* Severity banner */}
      <div
        className="px-5 py-2 flex items-center justify-between text-xs tracking-widest font-bold"
        style={{ background: sevColor, color: 'var(--bg)' }}
      >
        <span>{sevLabel}</span>
        <span style={{ opacity: 0.75, fontWeight: 400 }}>{scan.reason}</span>
      </div>

      {/* Name + version + description */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-mono)' }}>
            {rich.name}
          </h2>
          <span className="text-sm" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {rich.version || scan.package.version || ''}
          </span>
          {latestAvailable && (
            <span className="text-xs px-2 py-0.5" style={{ border: '1px solid var(--warning)', color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
              UPDATE → {scan.meta.latestVersion}
            </span>
          )}
        </div>
        {rich.description && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)', maxWidth: 680 }}>
            {rich.description}
          </p>
        )}
        {rich.keywords && rich.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {rich.keywords.map(kw => (
              <span key={kw} className="text-xs px-2 py-0.5"
                style={{ border: '1px solid var(--border)', color: 'var(--dim-lo)', fontFamily: 'var(--font-mono)' }}>
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 py-4 flex flex-wrap gap-8 border-b" style={{ borderColor: 'var(--border)' }}>
        {scan.meta.monthlyDownloads !== undefined && (
          <StatCell value={fmtDownloads(scan.meta.monthlyDownloads)} label="DOWNLOADS" />
        )}
        {scan.meta.createdAt && (
          <StatCell value={fmtAge(scan.meta.createdAt)} label="AGE" />
        )}
        {rich.maintainers !== undefined && (
          <StatCell value={rich.maintainers} label="MAINTAINERS" />
        )}
        {rich.totalVersions !== undefined && (
          <StatCell value={rich.totalVersions} label="VERSIONS" />
        )}
      </div>

      {/* Install command */}
      <div className="px-5 py-3 flex items-center justify-between gap-4 border-b text-xs"
        style={{ borderColor: 'var(--border)' }}>
        <code style={{ color: 'var(--fg)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
          $ {rich.installCmd}
        </code>
        <button
          onClick={copyCmd}
          className="shrink-0 px-3 py-1 tracking-widest"
          style={{ border: '1px solid var(--border)', color: cmdCopied ? 'var(--clean)' : 'var(--muted)', cursor: 'pointer', background: 'none' }}
        >
          {cmdCopied ? 'COPIED!' : 'COPY'}
        </button>
      </div>

      {/* Flag + install script */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--muted)' }}>SECURITY FLAG</p>
        <p className="text-xs font-bold tracking-widest" style={{ color: sevColor, fontFamily: 'var(--font-mono)' }}>
          {flagDesc}
        </p>
        {scan.meta.hasPostInstall && scan.meta.postInstallScript && (
          <div className="mt-3">
            <p className="text-xs tracking-widest mb-1" style={{ color: 'var(--warning)' }}>INSTALL SCRIPT</p>
            <pre className="text-xs leading-relaxed overflow-x-auto"
              style={{ color: 'var(--fg)', opacity: 0.7, fontFamily: 'var(--font-mono)', maxHeight: 100 }}>
              {scan.meta.postInstallScript}
            </pre>
          </div>
        )}
      </div>

      {/* CVEs */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          CVEs{totalCves > 0 && <span style={{ color: 'var(--critical)', marginLeft: 6 }}>({totalCves})</span>}
        </p>
        {cvesPending ? (
          <p className="text-xs tracking-widest" style={{ color: 'var(--dim-lo)' }}>CHECKING CVE DATABASE...</p>
        ) : totalCves === 0 ? (
          <p className="text-xs tracking-widest font-bold" style={{ color: 'var(--clean)', fontFamily: 'var(--font-mono)' }}>
            NONE FOUND
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(scan.cves ?? []).map(cve => (
              <div key={cve.id} className="text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a
                    href={cveHref(cve.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold font-mono"
                    style={{ color: SEV_COLOR[cve.severity] ?? 'var(--warning)' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {cve.id}
                  </a>
                  <span style={{ color: SEV_COLOR[cve.severity] ?? 'var(--warning)' }}>{cve.severity}</span>
                  {cve.cvss !== null && (
                    <span style={{ color: 'var(--muted)' }}>CVSS {cve.cvss.toFixed(1)}</span>
                  )}
                  {cve.fixedIn && (
                    <span style={{ color: 'var(--clean)' }}>Fixed in {cve.fixedIn}</span>
                  )}
                </div>
                {cve.summary && (
                  <p className="mt-1" style={{ color: 'var(--dim-lo)', maxWidth: 640 }}>{cve.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div className="px-5 py-4 flex flex-wrap gap-5">
        <ExtLink href={rich.registryUrl} label="REGISTRY" />
        {rich.homepage && <ExtLink href={rich.homepage} label="HOMEPAGE" />}
        {rich.repository && <ExtLink href={rich.repository} label="SOURCE" />}
      </div>
    </div>
  );
}

export default function PkgInspector() {
  const [input, setInput] = useState('');
  const [eco, setEco] = useState<Eco>('npm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rich, setRich] = useState<RichMeta | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [cvesPending, setCvesPending] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const ecoMeta = ECOSYSTEMS.find(e => e.value === eco)!;

  async function handleLookup() {
    const t = input.trim();
    if (!t || loading) return;

    setError(null);
    setRich(null);
    setScan(null);
    setCvesPending(true);
    setNotFound(false);
    setLoading(true);

    const { name, version } = parsePkgInput(t);
    const manifest = buildManifest(name, version, eco);
    const packages = detectAndParse(manifest, eco, false);

    if (packages.length === 0) {
      setError('Could not parse package name.');
      setLoading(false);
      return;
    }

    try {
      // Kick off rich meta and scan concurrently
      const richPromise = fetchRichMeta(name, eco).then(r => { setRich(r); return r; });

      await runScan(packages, {
        onResult: result => {
          setScan(result);
          if (!result.meta.exists) setNotFound(true);
        },
        onNetworkEvent: () => {},
        onOsvResult: updated => {
          setScan(updated);
          setCvesPending(false);
        },
      });

      await richPromise;
      setCvesPending(false);
    } catch {
      setError('Lookup failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Input panel */}
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
          <span className="tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>ECOSYSTEM</span>
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
            {loading ? 'LOOKING UP...' : 'LOOKUP →'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-xs tracking-widest" style={{ color: 'var(--critical)' }}>{error}</p>
      )}

      {loading && !scan && (
        <div className="mt-6 py-10 text-center text-xs tracking-widest"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
          CHECKING REGISTRY...
        </div>
      )}

      {!loading && notFound && (
        <div className="mt-6 py-10 text-center" style={{ border: '1px solid var(--critical)' }}>
          <p className="text-3xl font-bold tracking-widest mb-2" style={{ color: 'var(--critical)' }}>NOT FOUND</p>
          <p className="text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{parsePkgInput(input.trim()).name}</span>
            {' '}does not exist on the {eco} registry
          </p>
        </div>
      )}

      {scan && scan.meta.exists && rich && (
        <div className="mt-6">
          <PkgCard rich={rich} scan={scan} cvesPending={cvesPending} />
        </div>
      )}
    </>
  );
}
