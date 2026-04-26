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
  license?: string;
  deprecated?: string;
  directDeps?: number;
  publishedBy?: string;
  lastPublished?: string;
}

interface BundleSize {
  raw: number;
  gzip: number;
  deps: number;
}

interface ScorecardCheck {
  name: string;
  score: number;
  reason: string;
}

interface Scorecard {
  score: number;
  checks: ScorecardCheck[];
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
    const time = d.time as Record<string, string> | undefined;
    const lastPublished = latest && time ? time[latest] : undefined;
    const rawLicense = pkgData.license ?? d.license;
    const license = rawLicense ? String(rawLicense) : undefined;
    const deprecated = pkgData.deprecated ? String(pkgData.deprecated) : undefined;
    const directDeps = Object.keys(pkgData.dependencies ?? {}).length;
    const publishedBy = (pkgData._npmUser as { name?: string } | undefined)?.name;
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
      license,
      deprecated,
      directDeps,
      publishedBy,
      lastPublished,
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
    let license: string | undefined = info.license ? String(info.license).split('\n')[0].slice(0, 60) : undefined;
    const licClassifier = (info.classifiers as string[] | undefined)?.find((c: string) => c.startsWith('License :: OSI Approved ::'));
    if (licClassifier) license = licClassifier.split(' :: ').pop();
    const releases = d.releases as Record<string, Array<{ upload_time: string }>> | undefined;
    const lastPublished = releases?.[info.version]?.[0]?.upload_time;
    const directDeps = Array.isArray(info.requires_dist) ? (info.requires_dist as string[]).length : undefined;
    return {
      name: info.name,
      version: info.version,
      description: info.summary,
      homepage: info.home_page || info.project_urls?.Homepage || info.project_urls?.homepage,
      keywords,
      totalVersions: Object.keys(d.releases ?? {}).length,
      installCmd: `pip install ${name}`,
      registryUrl: `https://pypi.org/project/${name}/`,
      license,
      directDeps,
      lastPublished,
    };
  } catch { return null; }
}

async function fetchCargoMeta(name: string): Promise<RichMeta | null> {
  try {
    const r = await fetch(`https://crates.io/api/v1/crates/${name}`, {
      headers: { 'User-Agent': 'hookcheck.dev' },
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
      license: c.license as string | undefined,
      lastPublished: c.updated_at as string | undefined,
    };
  } catch { return null; }
}

async function fetchRubyMeta(name: string): Promise<RichMeta | null> {
  try {
    const r = await fetch(`https://rubygems.org/api/v1/gems/${name}.json`);
    if (!r.ok) return null;
    const d = await r.json();
    const licenses = d.licenses as string[] | undefined;
    const runtimeDeps = (d.dependencies as { runtime?: unknown[] } | undefined)?.runtime;
    return {
      name: d.name,
      version: d.version,
      description: d.info,
      homepage: d.homepage_uri ?? d.project_uri,
      repository: d.source_code_uri,
      installCmd: `gem install ${name}`,
      registryUrl: `https://rubygems.org/gems/${name}`,
      license: licenses && licenses.length > 0 ? licenses.join(' / ') : undefined,
      directDeps: Array.isArray(runtimeDeps) ? runtimeDeps.length : undefined,
      lastPublished: d.version_created_at as string | undefined,
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

async function fetchBundleSize(name: string): Promise<BundleSize | null> {
  try {
    const r = await fetch(`https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d.size !== 'number') return null;
    return { raw: d.size, gzip: d.gzip, deps: d.dependencyCount };
  } catch { return null; }
}

async function fetchScorecard(repoUrl: string): Promise<Scorecard | null> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/.\s]+)/);
    if (!match) return null;
    const repo = match[1].replace(/\.git$/, '');
    const r = await fetch(`https://api.securityscorecards.dev/projects/github.com/${repo}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d.score !== 'number') return null;
    return { score: d.score, checks: Array.isArray(d.checks) ? d.checks : [] };
  } catch { return null; }
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

function fmtRelTime(iso?: string): string {
  if (!iso) return '—';
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${Math.floor(days)}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}yr ago`;
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function licenseColor(lic?: string): string {
  if (!lic) return 'var(--muted)';
  const l = lic.toUpperCase();
  if (/\b(MIT|ISC|BSD|APACHE|0BSD|UNLICENSE|CC0|WTFPL|ZLIB)\b/.test(l)) return 'var(--clean)';
  if (/\b(GPL|LGPL|AGPL|MPL|EUPL|CDDL|EPL)\b/.test(l)) return 'var(--warning)';
  return 'var(--muted)';
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

function StatCell({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div
        className="text-base sm:text-xl font-bold leading-none truncate"
        style={{ color: color ?? 'var(--fg)', fontFamily: 'var(--font-mono)' }}
        title={String(value)}
      >
        {value}
      </div>
      <div className="text-xs tracking-widest mt-1 whitespace-nowrap" style={{ color: 'var(--muted)' }}>{label}</div>
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

const SCORECARD_CHECKS = [
  'Maintained', 'Code-Review', 'Branch-Protection', 'Vulnerabilities',
  'Security-Policy', 'Token-Permissions', 'Dangerous-Workflow', 'SAST', 'Fuzzing',
];

/* PkgCard renders without an outer border — the modal container owns the border */
function PkgCard({
  rich, scan, cvesPending, bundleSize, bundleSizeLoading, scorecard, scorecardLoading,
}: {
  rich: RichMeta;
  scan: ScanResult;
  cvesPending: boolean;
  bundleSize: BundleSize | null;
  bundleSizeLoading: boolean;
  scorecard: Scorecard | null;
  scorecardLoading: boolean;
}) {
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
  const isNpm = scan.package.ecosystem === 'npm';
  const lastRelease = rich.lastPublished ?? scan.meta.updatedAt;

  return (
    <>
      {/* Severity banner */}
      <div
        className="px-4 sm:px-5 py-2 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1 text-xs tracking-widest font-bold"
        style={{ background: sevColor, color: 'var(--bg)' }}
      >
        <span className="shrink-0">{sevLabel}</span>
        <span className="opacity-75 font-normal text-xs leading-snug">{scan.reason}</span>
      </div>

      {/* Deprecated warning */}
      {rich.deprecated && (
        <div
          className="px-4 sm:px-5 py-2 text-xs tracking-widest border-b"
          style={{ background: 'rgba(255,160,0,0.12)', borderColor: 'var(--warning)', color: 'var(--warning)' }}
        >
          <span className="font-bold">DEPRECATED</span>
          {rich.deprecated.toLowerCase() !== 'true' && (
            <span className="opacity-75 ml-2 break-words">— {rich.deprecated}</span>
          )}
        </div>
      )}

      {/* Name + version + description */}
      <div className="px-4 sm:px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight break-all" style={{ fontFamily: 'var(--font-mono)' }}>
            {rich.name}
          </h2>
          <span className="text-sm shrink-0" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {rich.version || scan.package.version || ''}
          </span>
          {latestAvailable && (
            <span
              className="text-xs px-2 py-0.5 shrink-0"
              style={{ border: '1px solid var(--warning)', color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}
            >
              UPDATE → {scan.meta.latestVersion}
            </span>
          )}
        </div>
        {rich.description && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {rich.description}
          </p>
        )}
        {rich.keywords && rich.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {rich.keywords.map(kw => (
              <span
                key={kw}
                className="text-xs px-2 py-0.5"
                style={{ border: '1px solid var(--border)', color: 'var(--dim-lo)', fontFamily: 'var(--font-mono)' }}
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats grid — wraps naturally on narrow screens */}
      <div className="px-4 sm:px-5 py-4 flex flex-wrap gap-x-6 gap-y-4 sm:gap-x-8 border-b" style={{ borderColor: 'var(--border)' }}>
        {scan.meta.monthlyDownloads !== undefined && (
          <StatCell value={fmtDownloads(scan.meta.monthlyDownloads)} label="DOWNLOADS" />
        )}
        {scan.meta.createdAt && (
          <StatCell value={fmtAge(scan.meta.createdAt)} label="AGE" />
        )}
        {lastRelease && (
          <StatCell value={fmtRelTime(lastRelease)} label="LAST RELEASE" />
        )}
        {rich.license && (
          <StatCell value={rich.license} label="LICENSE" color={licenseColor(rich.license)} />
        )}
        {rich.maintainers !== undefined && (
          <StatCell value={rich.maintainers} label="MAINTAINERS" />
        )}
        {rich.totalVersions !== undefined && (
          <StatCell value={rich.totalVersions} label="VERSIONS" />
        )}
        {rich.directDeps !== undefined && (
          <StatCell value={rich.directDeps} label="DIRECT DEPS" />
        )}
        {rich.publishedBy && (
          <StatCell value={rich.publishedBy} label="PUBLISHED BY" />
        )}
      </div>

      {/* Bundle size — npm only, parallel fetch */}
      {isNpm && (
        <div className="px-4 sm:px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>BUNDLE SIZE</p>
          {bundleSizeLoading && !bundleSize ? (
            <p className="text-xs tracking-widest" style={{ color: 'var(--dim-lo)' }}>ANALYZING...</p>
          ) : bundleSize ? (
            <div className="flex flex-wrap gap-x-6 gap-y-4 sm:gap-x-8">
              <StatCell value={fmtBytes(bundleSize.gzip)} label="GZIP" />
              <StatCell value={fmtBytes(bundleSize.raw)} label="MINIFIED" />
              <StatCell value={bundleSize.deps} label="TOTAL DEPS" />
            </div>
          ) : (
            <p className="text-xs tracking-widest" style={{ color: 'var(--dim-lo)' }}>
              NOT AVAILABLE (server-side or native package)
            </p>
          )}
        </div>
      )}

      {/* Install command */}
      <div
        className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b text-xs"
        style={{ borderColor: 'var(--border)' }}
      >
        <code className="overflow-x-auto" style={{ color: 'var(--fg)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
          $ {rich.installCmd}
        </code>
        <button
          onClick={copyCmd}
          className="self-start sm:self-auto shrink-0 px-3 py-1 tracking-widest"
          style={{
            border: '1px solid var(--border)',
            color: cmdCopied ? 'var(--clean)' : 'var(--muted)',
            cursor: 'pointer',
            background: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {cmdCopied ? 'COPIED!' : 'COPY'}
        </button>
      </div>

      {/* Security flag + install script */}
      <div className="px-4 sm:px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--muted)' }}>SECURITY FLAG</p>
        <p className="text-xs font-bold tracking-widest" style={{ color: sevColor, fontFamily: 'var(--font-mono)' }}>
          {flagDesc}
        </p>
        {scan.meta.hasPostInstall && scan.meta.postInstallScript && (
          <div className="mt-3">
            <p className="text-xs tracking-widest mb-1" style={{ color: 'var(--warning)' }}>INSTALL SCRIPT</p>
            <pre
              className="text-xs leading-relaxed overflow-x-auto"
              style={{ color: 'var(--fg)', opacity: 0.7, fontFamily: 'var(--font-mono)', maxHeight: 100 }}
            >
              {scan.meta.postInstallScript}
            </pre>
          </div>
        )}
      </div>

      {/* CVEs */}
      <div className="px-4 sm:px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
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
                  <p className="mt-1 leading-snug" style={{ color: 'var(--dim-lo)' }}>{cve.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OpenSSF Scorecard */}
      {(scorecardLoading || scorecard) && (
        <div className="px-4 sm:px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs tracking-widest" style={{ color: 'var(--muted)' }}>OPENSSF SCORECARD</p>
            {scorecard && (
              <span
                className="text-sm font-bold"
                style={{
                  color: scorecard.score >= 7 ? 'var(--clean)' : scorecard.score >= 5 ? 'var(--warning)' : 'var(--critical)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {scorecard.score.toFixed(1)}<span style={{ color: 'var(--muted)', fontWeight: 'normal' }}> / 10</span>
              </span>
            )}
          </div>
          {scorecardLoading && !scorecard && (
            <p className="text-xs tracking-widest" style={{ color: 'var(--dim-lo)' }}>FETCHING...</p>
          )}
          {scorecard && (() => {
            const displayed = scorecard.checks
              .filter(c => SCORECARD_CHECKS.includes(c.name) && c.score !== -1)
              .sort((a, b) => a.score - b.score);
            if (displayed.length === 0) return null;
            return (
              <div className="flex flex-col gap-1.5">
                {displayed.map(check => {
                  const color = check.score >= 8 ? 'var(--clean)' : check.score >= 5 ? 'var(--warning)' : 'var(--critical)';
                  return (
                    <div key={check.name} className="flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {check.name.replace(/-/g, ' ').toUpperCase()}
                      </span>
                      <span className="font-bold shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>
                        {check.score}/10
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* External links */}
      <div className="px-4 sm:px-5 py-4 flex flex-wrap gap-4 sm:gap-5">
        <ExtLink href={rich.registryUrl} label="REGISTRY" />
        {rich.homepage && <ExtLink href={rich.homepage} label="HOMEPAGE" />}
        {rich.repository && <ExtLink href={rich.repository} label="SOURCE" />}
      </div>
    </>
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
  const [bundleSize, setBundleSize] = useState<BundleSize | null>(null);
  const [bundleSizeLoading, setBundleSizeLoading] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  const ecoMeta = ECOSYSTEMS.find(e => e.value === eco)!;

  async function handleLookup() {
    const t = input.trim();
    if (!t || loading) return;

    setError(null);
    setRich(null);
    setScan(null);
    setCvesPending(true);
    setNotFound(false);
    setBundleSize(null);
    setBundleSizeLoading(eco === 'npm');
    setScorecard(null);
    setScorecardLoading(false);
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
      const richPromise = fetchRichMeta(name, eco).then(r => {
        setRich(r);
        if (r?.repository && r.repository.includes('github.com')) {
          setScorecardLoading(true);
          fetchScorecard(r.repository)
            .then(sc => { setScorecard(sc); setScorecardLoading(false); })
            .catch(() => setScorecardLoading(false));
        }
        return r;
      });

      if (eco === 'npm') {
        fetchBundleSize(name)
          .then(bs => { setBundleSize(bs); setBundleSizeLoading(false); })
          .catch(() => setBundleSizeLoading(false));
      }

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

  const cardBorder = scan?.meta.exists
    ? `2px solid ${SEV_COLOR[scan.severity] ?? 'var(--border)'}`
    : '1px solid var(--border)';

  const pkgName = input.trim() ? parsePkgInput(input.trim()).name : '';

  return (
    <>
      {/* Input panel */}
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3 border-b text-xs"
          style={{ borderColor: 'var(--border)' }}
        >
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
              minWidth: 180,
            }}
            spellCheck={false}
          />
          <button
            onClick={handleLookup}
            disabled={!input.trim() || loading}
            className="flex-1 sm:flex-none px-6 py-2 text-xs font-bold tracking-widest transition-opacity disabled:opacity-30 shrink-0"
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
        <div
          className="mt-6 py-16 text-center text-xs tracking-widest"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          CHECKING REGISTRY...
        </div>
      )}

      {!loading && !error && notFound && (
        <div className="mt-6 py-16 text-center" style={{ border: '2px solid var(--critical)' }}>
          <p className="text-2xl sm:text-3xl font-bold tracking-widest mb-3" style={{ color: 'var(--critical)' }}>
            NOT FOUND
          </p>
          <p className="text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{pkgName}</span>
            {' '}does not exist on the {eco} registry
          </p>
        </div>
      )}

      {scan && scan.meta.exists && rich && (
        <div className="mt-6" style={{ border: cardBorder }}>
          <PkgCard
            rich={rich}
            scan={scan}
            cvesPending={cvesPending}
            bundleSize={bundleSize}
            bundleSizeLoading={bundleSizeLoading}
            scorecard={scorecard}
            scorecardLoading={scorecardLoading}
          />
        </div>
      )}
    </>
  );
}
