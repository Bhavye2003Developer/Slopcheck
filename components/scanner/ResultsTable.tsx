'use client';

import { useState } from 'react';
import LZString from 'lz-string';
import type { ScanResult, Severity, CVEEntry } from '@/lib/types';
import ScanCharts, { type ChartFilter, matchesFilter } from './ScanCharts';

import type { FlagType } from '@/lib/types';

const FLAG_LABEL: Partial<Record<FlagType, string>> = {
  nonexistent: '❌ NOT FOUND',
  typosquat: '🎭 TYPOSQUAT',
  recently_registered: '⚠️  NEW PKG',
  low_downloads: '⚠️  LOW DL',
  suspicious_script: '⚠️  MALICIOUS',
  outdated: '⬆️  OUTDATED',
  low_adoption_latest: '⚠️  LOW ADOPT',
  clean: '✅ CLEAN',
  unsupported: 'N/A',
  has_cve_critical: '🔴 CVE CRIT',
  has_cve_high: '🟠 CVE HIGH',
  has_cve_medium: '🟡 CVE MED',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '❌ CRITICAL',
  high: '⚠️  HIGH',
  medium: '⚠️  MEDIUM',
  clean: '✅ CLEAN',
  unsupported: 'N/A',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--critical)',
  high: 'var(--warning)',
  medium: 'var(--warning)',
  clean: 'var(--clean)',
  unsupported: 'var(--muted)',
};

type CveSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';

const VULN_COLOR: Record<CveSeverity | 'PENDING' | 'UNKNOWN', string> = {
  CRITICAL: 'var(--critical)',
  HIGH: 'var(--orange)',
  MEDIUM: 'var(--warning)',
  LOW: 'var(--warning)',
  CLEAN: 'var(--clean)',
  PENDING: 'var(--dim-lo)',
  UNKNOWN: 'var(--dim-lo)',
};

interface ResultsTableProps {
  results: ScanResult[];
  scanning?: boolean;
  scanMs?: number;
}

function buildSummary(results: ScanResult[]) {
  const critical = results.filter(r => r.severity === 'critical').length;
  const high     = results.filter(r => r.severity === 'high').length;
  const medium   = results.filter(r => r.severity === 'medium').length;
  const clean    = results.filter(r => r.severity === 'clean').length;
  const cveCritical = results.filter(r => r.cveSeverity === 'CRITICAL').length;
  const cveHigh     = results.filter(r => r.cveSeverity === 'HIGH').length;
  const totalCves   = results.reduce((sum, r) => sum + (r.cves?.length ?? 0), 0);
  const cveClean    = results.filter(r => r.cveSeverity === 'CLEAN').length;
  return { critical, high, medium, clean, cveCritical, cveHigh, totalCves, cveClean };
}

function VulnPill({ result }: { result: ScanResult }) {
  if (result.cveSeverity === undefined) {
    return (
      <span className="text-xs px-2 py-0.5 font-mono tracking-widest" style={{ color: 'var(--dim-lo)', border: '1px solid var(--dim-hi)' }}>
        -
      </span>
    );
  }
  const sev = result.cveSeverity;
  const color = VULN_COLOR[sev] ?? 'var(--dim-lo)';
  return (
    <span className="text-xs px-2 py-0.5 font-mono tracking-widest" style={{ color, border: `1px solid ${color}` }}>
      {sev}
    </span>
  );
}

function fmtDateShort(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function cveUrl(id: string): string {
  if (/^CVE-/i.test(id)) return `https://nvd.nist.gov/vuln/detail/${id}`;
  return `https://osv.dev/vulnerability/${id}`;
}

function CvePanel({ cves }: { cves: CVEEntry[] }) {
  if (cves.length === 0) return null;
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--muted)' }}>CVEs</p>
      <div className="flex flex-col gap-1">
        {cves.map(cve => {
          const color = VULN_COLOR[cve.severity] ?? 'var(--dim-lo)';
          return (
            <div key={cve.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
              <a
                href={cveUrl(cve.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all"
                style={{ color: 'var(--fg)', textDecorationLine: 'underline', textDecorationColor: 'var(--dim-mid)' }}
                onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'var(--dim-mid)')}
              >
                {cve.id}
              </a>
              <span style={{ color }}>{cve.severity}</span>
              {cve.cvss !== null && (
                <span style={{ color: 'var(--muted)' }}>CVSS {cve.cvss.toFixed(1)}</span>
              )}
              {cve.reportedAt && (
                <span style={{ color: 'var(--muted)' }}>Reported {fmtDateShort(cve.reportedAt)}</span>
              )}
              {cve.fixedIn && (
                <span style={{ color: 'var(--clean)' }}>Fixed in {cve.fixedIn}</span>
              )}
              {cve.summary && (
                <span className="w-full mt-0.5" style={{ color: 'var(--muted)' }}>{cve.summary}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDownloads(n?: number): string {
  if (n === undefined) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M/mo`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K/mo`;
  return `${n}/mo`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function computeScore(results: ScanResult[]): number {
  const c = results.filter(r => r.severity === 'critical').length;
  const h = results.filter(r => r.severity === 'high').length;
  const m = results.filter(r => r.severity === 'medium').length;
  return Math.min(100, c * 25 + h * 8 + m * 2);
}

function buildReportHtml(results: ScanResult[], scanMs: number | null): string {
  const date = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const score = computeScore(results);
  const critical = results.filter(r => r.severity === 'critical').length;
  const high     = results.filter(r => r.severity === 'high').length;
  const medium   = results.filter(r => r.severity === 'medium').length;
  const clean    = results.filter(r => r.severity === 'clean').length;
  const flagged  = results.filter(r => r.severity !== 'clean' && r.severity !== 'unsupported').length;
  const totalCves = results.reduce((s, r) => s + (r.cves?.length ?? 0), 0);

  const scoreColor = score >= 75 ? '#ff4444' : score >= 50 ? '#ff7700' : score >= 25 ? '#ffaa00' : score > 0 ? '#ffaa00' : '#22ff88';
  const scoreLabel = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH RISK' : score >= 25 ? 'CAUTION' : score > 0 ? 'LOW RISK' : 'ALL CLEAR';

  const sevColor: Record<string, string> = {
    critical: '#ff4444', high: '#ff7700', medium: '#ffaa00', clean: '#22ff88', unsupported: '#555',
  };

  const rows = results.map((r, i) => {
    const ver = r.package.version ?? '-';
    const latest = r.meta.latestVersion && r.meta.latestVersion !== r.package.version ? ` → ${r.meta.latestVersion}` : '';
    const dl = r.meta.monthlyDownloads !== undefined ? fmtDownloads(r.meta.monthlyDownloads) : '-';
    const sc = sevColor[r.severity] ?? '#888';
    const cveCount = r.cves?.length ? `${r.cves.length} CVE${r.cves.length > 1 ? 's' : ''}` : '-';
    return `<tr>
      <td style="color:#555;text-align:right;width:28px">${i + 1}</td>
      <td style="font-weight:bold;word-break:break-all">${r.package.name}<br><span style="color:#555;font-weight:normal;font-size:7.5pt">${ver !== '-' ? ver + (latest ? ' → ' + r.meta.latestVersion : '') : ''}</span></td>
      <td style="color:${sc};white-space:nowrap">${r.severity.toUpperCase()}</td>
      <td style="word-break:break-word">${r.reason}</td>
      <td style="color:#555;white-space:nowrap">${dl}</td>
      <td style="color:${(r.cves?.length ?? 0) > 0 ? '#ff7700' : '#333'};white-space:nowrap">${cveCount}</td>
    </tr>`;
  }).join('');

  const cveRows = results.filter(r => r.cves?.length).flatMap(r =>
    (r.cves ?? []).map(cve => `<tr>
      <td style="font-weight:bold">${r.package.name}${r.package.version ? '@' + r.package.version : ''}</td>
      <td style="font-weight:bold;color:${cve.severity === 'CRITICAL' ? '#ff4444' : cve.severity === 'HIGH' ? '#ff7700' : '#ffaa00'}">${cve.id}</td>
      <td style="color:${cve.severity === 'CRITICAL' ? '#ff4444' : cve.severity === 'HIGH' ? '#ff7700' : '#ffaa00'}">${cve.severity}</td>
      <td>${cve.cvss !== null ? cve.cvss.toFixed(1) : '-'}</td>
      <td>${cve.summary ?? '-'}</td>
      <td style="color:#22ff88">${cve.fixedIn ?? '-'}</td>
    </tr>`)
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>HookCheck - Security Audit Report</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Courier New', Courier, monospace; background: #0a0a0a; color: #ededed; font-size: 10pt; line-height: 1.5; }
.page { padding: 2.5cm 2.5cm 2cm; max-width: 1100px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ededed; padding-bottom: 14px; margin-bottom: 22px; }
.brand { font-size: 22pt; font-weight: bold; letter-spacing: 0.08em; }
.subtitle { font-size: 7.5pt; letter-spacing: 0.25em; color: #999; margin-top: 3px; }
.meta { font-size: 9pt; color: #999; text-align: right; }
.score-block { display: flex; align-items: center; gap: 40px; padding: 20px 24px; border: 1px solid #222; margin-bottom: 24px; }
.score-num { font-size: 52pt; font-weight: bold; line-height: 1; color: ${scoreColor}; }
.score-label { font-size: 9pt; letter-spacing: 0.3em; color: ${scoreColor}; margin-top: 4px; }
.stats { display: flex; gap: 28px; }
.stat { text-align: center; }
.stat-val { font-size: 22pt; font-weight: bold; line-height: 1; }
.stat-key { font-size: 7.5pt; letter-spacing: 0.2em; color: #666; margin-top: 3px; }
.section-title { font-size: 7.5pt; letter-spacing: 0.25em; color: #666; border-bottom: 1px solid #222; padding-bottom: 7px; margin: 26px 0 12px; text-transform: uppercase; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; table-layout: fixed; }
col.c-num { width: 28px; }
col.c-pkg { width: 22%; }
col.c-sev { width: 72px; }
col.c-reason { width: auto; }
col.c-dl { width: 80px; }
col.c-cve { width: 60px; }
col.c-id { width: 18%; }
col.c-csev { width: 70px; }
col.c-cvss { width: 44px; }
col.c-sum { width: auto; }
col.c-fix { width: 80px; }
th { text-align: left; letter-spacing: 0.1em; font-size: 7pt; color: #666; border-bottom: 1px solid #ededed; padding: 5px 6px; white-space: nowrap; }
td { padding: 5px 6px; border-bottom: 1px solid #1a1a1a; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
tr:last-child td { border-bottom: none; }
.footer { margin-top: 36px; border-top: 1px solid #222; padding-top: 12px; font-size: 7.5pt; color: #555; text-align: center; letter-spacing: 0.1em; }
.print-btn { position: fixed; top: 16px; right: 16px; font-family: 'Courier New', monospace; font-size: 10pt; letter-spacing: 0.1em; padding: 8px 18px; background: #ededed; color: #0a0a0a; border: none; cursor: pointer; }
@media print {
  @page { margin: 1.5cm; }
  .page { padding: 0; }
  .print-btn { display: none; }
  tr { page-break-inside: avoid; }
  .score-block { page-break-inside: avoid; }
}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">PRINT / SAVE PDF</button>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">HOOKCHECK.</div>
      <div class="subtitle">DEPENDENCY SECURITY AUDIT REPORT</div>
    </div>
    <div class="meta">
      ${date}<br>
      ${results.length} packages scanned${scanMs !== null ? ' · ' + (scanMs >= 1000 ? (scanMs / 1000).toFixed(1) + 's' : scanMs + 'ms') : ''}
    </div>
  </div>

  <div class="score-block">
    <div>
      <div class="score-num">${score}</div>
      <div class="score-label">${scoreLabel}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-val" style="color:#ff4444">${critical}</div><div class="stat-key">CRITICAL</div></div>
      <div class="stat"><div class="stat-val" style="color:#ff7700">${high}</div><div class="stat-key">HIGH</div></div>
      <div class="stat"><div class="stat-val" style="color:#ffaa00">${medium}</div><div class="stat-key">MEDIUM</div></div>
      <div class="stat"><div class="stat-val" style="color:#22ff88">${clean}</div><div class="stat-key">CLEAN</div></div>
      ${totalCves > 0 ? `<div class="stat"><div class="stat-val" style="color:#ff7700">${totalCves}</div><div class="stat-key">CVEs</div></div>` : ''}
    </div>
  </div>

  <div class="section-title">PACKAGE AUDIT · ${flagged} flagged of ${results.length} scanned</div>
  <table>
    <colgroup><col class="c-num"><col class="c-pkg"><col class="c-sev"><col class="c-reason"><col class="c-dl"><col class="c-cve"></colgroup>
    <thead><tr><th>#</th><th>PACKAGE</th><th>SEVERITY</th><th>REASON</th><th>DOWNLOADS</th><th>CVEs</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${cveRows ? `
  <div class="section-title">CVE DETAILS · ${totalCves} vulnerabilities</div>
  <table>
    <colgroup><col class="c-pkg"><col class="c-id"><col class="c-csev"><col class="c-cvss"><col class="c-sum"><col class="c-fix"></colgroup>
    <thead><tr><th>PACKAGE</th><th>CVE ID</th><th>SEVERITY</th><th>CVSS</th><th>SUMMARY</th><th>FIXED IN</th></tr></thead>
    <tbody>${cveRows}</tbody>
  </table>` : ''}

  <div class="footer">
    GENERATED BY HOOKCHECK · hookcheck.dev · ${date} · ALL CHECKS PERFORMED CLIENT-SIDE · NO DATA SENT TO ANY SERVER
  </div>
</div>
<script>setTimeout(function(){ window.print(); }, 400);</script>
</body>
</html>`;
}

function buildSarif(results: ScanResult[]): string {
  type SarifLevel = 'error' | 'warning' | 'note';

  const FLAG_RULES: Record<FlagType, { id: string; name: string; description: string }> = {
    nonexistent:        { id: 'HOOK001', name: 'PackageNotFound',        description: 'Package not found in registry - may be hallucinated or removed.' },
    typosquat:          { id: 'HOOK002', name: 'PossibleTyposquat',      description: 'Package name closely resembles a popular package - possible typosquat.' },
    suspicious_script:  { id: 'HOOK003', name: 'SuspiciousInstallScript',description: 'Post-install script contains potentially dangerous commands.' },
    recently_registered:{ id: 'HOOK004', name: 'RecentlyRegistered',     description: 'Package was registered within the last 30 days.' },
    low_downloads:      { id: 'HOOK005', name: 'LowDownloads',           description: 'Package has very few monthly downloads - low community trust signal.' },
    low_adoption_latest:{ id: 'HOOK006', name: 'LowAdoptionLatest',      description: 'Latest version has low adoption - pinned version may be more stable.' },
    outdated:           { id: 'HOOK007', name: 'OutdatedVersion',         description: 'A newer version of this package is available.' },
    has_cve_critical:   { id: 'HOOK008', name: 'KnownVulnerability',     description: 'Package has known critical CVE(s) from OSV.dev.' },
    has_cve_high:       { id: 'HOOK008', name: 'KnownVulnerability',     description: 'Package has known high-severity CVE(s) from OSV.dev.' },
    has_cve_medium:     { id: 'HOOK008', name: 'KnownVulnerability',     description: 'Package has known CVE(s) from OSV.dev.' },
    clean:              { id: 'HOOK000', name: 'Clean',                   description: 'No issues detected.' },
    unsupported:        { id: 'HOOK000', name: 'Unsupported',             description: 'Ecosystem check not fully supported.' },
  };

  const SEVERITY_LEVEL: Record<Severity, SarifLevel> = {
    critical: 'error', high: 'error', medium: 'warning', clean: 'note', unsupported: 'note',
  };

  const ECOSYSTEM_FILE: Record<string, string> = {
    npm: 'package.json', pypi: 'requirements.txt', rubygems: 'Gemfile', go: 'go.mod', cargo: 'Cargo.toml',
  };

  const flagged = results.filter(r => r.severity !== 'clean' && r.severity !== 'unsupported');

  // Deduplicated rules
  const rulesMap = new Map<string, { id: string; name: string; shortDescription: { text: string }; defaultConfiguration: { level: string }; helpUri: string }>();
  for (const r of flagged) {
    const rule = FLAG_RULES[r.flag];
    if (!rulesMap.has(rule.id)) {
      rulesMap.set(rule.id, { id: rule.id, name: rule.name, shortDescription: { text: rule.description }, defaultConfiguration: { level: 'warning' }, helpUri: 'https://hookcheck.dev' });
    }
  }
  if (results.some(r => (r.cves?.length ?? 0) > 0) && !rulesMap.has('HOOK008')) {
    rulesMap.set('HOOK008', { id: 'HOOK008', name: 'KnownVulnerability', shortDescription: { text: 'Package has known CVE(s) from OSV.dev.' }, defaultConfiguration: { level: 'error' }, helpUri: 'https://hookcheck.dev' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sarifResults: any[] = [];

  for (const r of flagged) {
    const file = ECOSYSTEM_FILE[r.package.ecosystem] ?? 'manifest.txt';
    sarifResults.push({
      ruleId: FLAG_RULES[r.flag].id,
      level: SEVERITY_LEVEL[r.severity],
      message: { text: r.reason },
      locations: [{ physicalLocation: { artifactLocation: { uri: file, uriBaseId: '%SRCROOT%' }, region: { startLine: 1 } }, logicalLocations: [{ name: r.package.name, kind: 'package', fullyQualifiedName: r.package.version ? `${r.package.name}@${r.package.version}` : r.package.name }] }],
    });
  }

  for (const r of results) {
    if (!r.cves?.length) continue;
    const file = ECOSYSTEM_FILE[r.package.ecosystem] ?? 'manifest.txt';
    for (const cve of r.cves) {
      const msg = [cve.id, cve.summary, cve.fixedIn ? `Fixed in ${cve.fixedIn}` : ''].filter(Boolean).join(' - ');
      sarifResults.push({
        ruleId: 'HOOK008',
        level: SEVERITY_LEVEL[r.severity] as SarifLevel,
        message: { text: msg },
        locations: [{ physicalLocation: { artifactLocation: { uri: file, uriBaseId: '%SRCROOT%' }, region: { startLine: 1 } }, logicalLocations: [{ name: r.package.name, kind: 'package', fullyQualifiedName: r.package.version ? `${r.package.name}@${r.package.version}` : r.package.name }] }],
      });
    }
  }

  const artifactUris = [...new Set(results.map(r => ECOSYSTEM_FILE[r.package.ecosystem] ?? 'manifest.txt'))];

  return JSON.stringify({
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'Hook Check', version: '1.0.0', informationUri: 'https://hookcheck.dev', rules: [...rulesMap.values()].sort((a, b) => a.id.localeCompare(b.id)) } },
      results: sarifResults,
      artifacts: artifactUris.map(uri => ({ location: { uri, uriBaseId: '%SRCROOT%' } })),
    }],
  }, null, 2);
}

function buildCycloneDx(results: ScanResult[]): string {
  const ECO_PURL: Record<string, string> = {
    npm: 'npm', pypi: 'pypi', cargo: 'cargo', rubygems: 'gem', go: 'golang',
  };

  function toPurl(r: ScanResult): string {
    const type = ECO_PURL[r.package.ecosystem] ?? r.package.ecosystem;
    let name = r.package.name;
    if (r.package.ecosystem === 'npm' && name.startsWith('@')) {
      name = '%40' + name.slice(1).replace('/', '%2F');
    }
    const ver = r.package.version ? `@${r.package.version}` : '';
    return `pkg:${type}/${name}${ver}`;
  }

  function bomRef(r: ScanResult): string {
    return `${r.package.ecosystem}:${r.package.name}`;
  }

  const components = results.map(r => ({
    type: 'library',
    'bom-ref': bomRef(r),
    name: r.package.name,
    ...(r.package.version ? { version: r.package.version } : {}),
    purl: toPurl(r),
    properties: [
      { name: 'hookcheck:severity', value: r.severity },
      { name: 'hookcheck:flag', value: r.flag },
      { name: 'hookcheck:reason', value: r.reason },
      ...(r.meta.monthlyDownloads !== undefined
        ? [{ name: 'hookcheck:monthly_downloads', value: String(r.meta.monthlyDownloads) }]
        : []),
      ...(r.meta.createdAt ? [{ name: 'hookcheck:created_at', value: r.meta.createdAt }] : []),
      ...(r.meta.updatedAt ? [{ name: 'hookcheck:updated_at', value: r.meta.updatedAt }] : []),
    ],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vulnerabilities: any[] = [];
  for (const r of results) {
    if (!r.cves?.length) continue;
    const ref = bomRef(r);
    for (const cve of r.cves) {
      const isNvd = /^CVE-/i.test(cve.id);
      vulnerabilities.push({
        'bom-ref': `vuln:${cve.id}`,
        id: cve.id,
        source: isNvd
          ? { name: 'NVD', url: `https://nvd.nist.gov/vuln/detail/${cve.id}` }
          : { name: 'OSV', url: `https://osv.dev/vulnerability/${cve.id}` },
        ratings: [{
          severity: cve.severity.toLowerCase(),
          ...(cve.cvss !== null ? { score: cve.cvss, method: 'CVSSv3' } : {}),
        }],
        ...(cve.summary ? { description: cve.summary } : {}),
        ...(cve.fixedIn ? { recommendation: `Upgrade to ${cve.fixedIn}` } : {}),
        affects: [{ ref }],
      });
    }
  }

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

  return JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: `urn:uuid:${id}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'HookCheck', name: 'HookCheck', version: '1.0.0' }],
    },
    components,
    ...(vulnerabilities.length > 0 ? { vulnerabilities } : {}),
  }, null, 2);
}

function buildGhYaml(): string {
  return `name: Hook Check

on:
  pull_request:
    paths:
      - 'package.json'
      - 'requirements.txt'
      - 'go.mod'
      - 'Cargo.toml'

jobs:
  hookcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Hook Check - dependency audit
        run: |
          node --input-type=module << 'HOOKEOF'
          import { readFileSync } from 'fs';
          import { existsSync } from 'fs';

          if (!existsSync('package.json')) { console.log('No package.json found, skipping.'); process.exit(0); }

          const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          const names = Object.keys(deps);
          console.log(\`Checking \${names.length} packages via Hook Check...\`);

          const results = await Promise.allSettled(names.map(async name => {
            const encoded = name.startsWith('@') ? name.replace('/', '%2F') : name;
            const [reg, dl] = await Promise.all([
              fetch(\`https://registry.npmjs.org/\${encoded}\`).then(r => r.ok ? r.json() : null).catch(() => null),
              fetch(\`https://api.npmjs.org/downloads/point/last-month/\${encoded}\`).then(r => r.ok ? r.json() : null).catch(() => null),
            ]);
            if (!reg?.name) return { name, level: 'CRITICAL', msg: 'not found on registry' };
            const age = reg.time?.created ? (Date.now() - new Date(reg.time.created).getTime()) / 86400000 : Infinity;
            if (age < 30) return { name, level: 'HIGH', msg: \`registered \${Math.floor(age)} days ago\` };
            if (dl?.downloads !== undefined && dl.downloads < 500) return { name, level: 'MEDIUM', msg: \`\${dl.downloads}/mo downloads\` };
            return null;
          }));

          const flags = results.filter(r => r.status === 'fulfilled' && r.value).map(r => (r as PromiseFulfilledResult<unknown>).value as { name: string; level: string; msg: string });
          if (flags.length === 0) { console.log('✅  All packages passed.'); process.exit(0); }
          console.error(\`\\n⚠️  \${flags.length} package(s) flagged:\\n\`);
          for (const f of flags) console.error(\`  [\${f.level}] \${f.name}: \${f.msg}\`);
          console.error('\\nFull scan: https://hookcheck.dev\\n');
          process.exit(1);
          HOOKEOF`;
}

export default function ResultsTable({ results, scanning = false, scanMs }: ResultsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ChartFilter>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);
  const [ciOpen, setCiOpen] = useState(false);
  const [yamlCopied, setYamlCopied] = useState(false);
  const [sarifCopied, setSarifCopied] = useState(false);
  const [pdfOpened, setPdfOpened] = useState(false);
  const [sbomExported, setSbomExported] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);

  function copyPkg(name: string, version: string | null) {
    const text = version ? `${name}@${version}` : name;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedPkg(name);
      setTimeout(() => setCopiedPkg(null), 1500);
    });
  }

  if (results.length === 0) return null;

  const allClean = !scanning && results.length > 0 && results.every(r => r.severity === 'clean');

  const displayed = results.filter(r => matchesFilter(r, filter));
  const { critical, high, medium, clean, cveCritical, cveHigh, totalCves, cveClean } = buildSummary(results);
  const deps    = displayed.filter(r => !r.package.isDev);
  const devDeps = displayed.filter(r => r.package.isDev);
  const osvDone = results.some(r => r.cveSeverity !== undefined);

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderRow(r: ScanResult, _i: number, globalIndex: number) {
    const fileVer = r.package.version ?? '-';
    const latestVer = r.meta.latestVersion ?? '-';
    const versionMismatch = r.meta.latestVersion && r.package.version && r.package.version !== r.meta.latestVersion;
    const flagLabel = FLAG_LABEL[r.flag] ?? SEVERITY_LABEL[r.severity];
    const rowKey = `${r.package.ecosystem}:${r.package.name}`;
    const isExpanded = expanded.has(rowKey);
    const hasCves = (r.cves?.length ?? 0) > 0;

    return (
      <div
        key={`${r.package.name}-${globalIndex}`}
        className="px-3 md:px-4 py-4 border-b animate-fade-in-up"
        style={{ borderColor: 'var(--border)', animationDelay: `${Math.min(globalIndex * 30, 400)}ms`, animationFillMode: 'both', opacity: 0 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="text-xs shrink-0" style={{ color: SEVERITY_COLOR[r.severity] }}>
              {flagLabel}
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>
              {r.package.name}
              {r.package.version && (
                <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>@{r.package.version}</span>
              )}
            </span>
            <button
              onClick={() => copyPkg(r.package.name, r.package.version ?? null)}
              className="text-xs shrink-0 transition-colors"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copiedPkg === r.package.name ? 'var(--clean)' : 'var(--dim-mid)' }}
              title={`Copy ${r.package.name}${r.package.version ? `@${r.package.version}` : ''}`}
              onMouseEnter={e => { if (copiedPkg !== r.package.name) e.currentTarget.style.color = 'var(--muted)'; }}
              onMouseLeave={e => { if (copiedPkg !== r.package.name) e.currentTarget.style.color = 'var(--dim-mid)'; }}
            >
              {copiedPkg === r.package.name ? '✓' : '⧉'}
            </button>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <VulnPill result={r} />
            {r.registryUrl && (
              <a href={r.registryUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs transition-colors" style={{ color: 'var(--muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                VIEW ↗
              </a>
            )}
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{r.reason}</p>
        {r.meta.exists && (
          <div className="flex flex-wrap gap-x-3 md:gap-x-5 gap-y-1 text-xs">
            <span style={{ color: 'var(--dim-label)' }}>FILE <span style={{ color: 'var(--fg)' }}>{fileVer}</span></span>
            <span style={{ color: 'var(--dim-label)' }}>
              LATEST{' '}
              <span style={{ color: versionMismatch ? 'var(--warning)' : 'var(--fg)' }}>{latestVer}</span>
              {versionMismatch && <span style={{ color: 'var(--warning)' }}> ^</span>}
            </span>
            <span style={{ color: 'var(--dim-label)' }}>DL <span style={{ color: 'var(--fg)' }}>{fmtDownloads(r.meta.monthlyDownloads)}</span></span>
            <span style={{ color: 'var(--dim-label)' }}>UPDATED <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.updatedAt)}</span></span>
            <span style={{ color: 'var(--dim-label)' }}>CREATED <span style={{ color: 'var(--fg)' }}>{fmtDate(r.meta.createdAt)}</span></span>
          </div>
        )}
        {hasCves && (
          <button
            onClick={() => toggleExpanded(rowKey)}
            className="mt-2 text-xs tracking-widest transition-colors"
            style={{ color: 'var(--muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            {isExpanded ? '▲ HIDE CVEs' : `▼ SHOW ${r.cves!.length} CVE${r.cves!.length !== 1 ? 's' : ''}`}
          </button>
        )}
        {isExpanded && hasCves && <CvePanel cves={r.cves!} />}
      </div>
    );
  }

  function renderGroup(group: ScanResult[], label: string, offset: number) {
    if (group.length === 0) return null;
    return (
      <>
        <div
          className="px-3 md:px-4 py-2 text-xs tracking-widest"
          style={{ background: 'var(--panel)', color: 'var(--muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}
        >
          {label} <span style={{ color: 'var(--fg)' }}>{group.length}</span>
          {filter && <span style={{ color: 'var(--dim-lo)', marginLeft: 8 }}>· filtered</span>}
        </div>
        {group.map((r, i) => renderRow(r, i, offset + i))}
      </>
    );
  }

  function exportJson() {
    downloadFile(JSON.stringify(results, null, 2), 'hookcheck-results.json', 'application/json');
  }

  function exportPdf() {
    const html = buildReportHtml(results, scanMs ?? null);
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    setPdfOpened(true);
    setTimeout(() => setPdfOpened(false), 2000);
  }

  function exportSarif() {
    downloadFile(buildSarif(results), 'hookcheck-results.sarif', 'application/json');
    setSarifCopied(true);
    setTimeout(() => setSarifCopied(false), 2000);
  }

  function exportSbom() {
    downloadFile(buildCycloneDx(results), 'hookcheck-sbom.cdx.json', 'application/json');
    setSbomExported(true);
    setTimeout(() => setSbomExported(false), 2000);
  }

  function exportText() {
    const lines = results.map(r => {
      const ver = r.package.version ? `@${r.package.version}` : '';
      const latest = r.meta.latestVersion ? ` -> latest ${r.meta.latestVersion}` : '';
      const dl = r.meta.monthlyDownloads !== undefined ? ` |${fmtDownloads(r.meta.monthlyDownloads)}` : '';
      const updated = r.meta.updatedAt ? ` |updated ${fmtDate(r.meta.updatedAt)}` : '';
      return `${SEVERITY_LABEL[r.severity].padEnd(14)} ${(r.package.name + ver).padEnd(45)} ${r.reason}${latest}${dl}${updated}`;
    });
    const summary = `\n---\n${critical} critical |${high} high |${medium} medium |${clean} clean`;
    downloadFile(lines.join('\n') + summary, 'hookcheck-results.txt', 'text/plain');
  }

  function copyMarkdown() {
    const rows = results.map(r => {
      const pkg = r.package.version ? `\`${r.package.name}@${r.package.version}\`` : `\`${r.package.name}\``;
      const sev = SEVERITY_LABEL[r.severity];
      const cves = r.cves?.length ? ` · ${r.cves.length} CVE${r.cves.length > 1 ? 's' : ''}` : '';
      return `| ${pkg} | ${r.package.ecosystem} | ${sev} | ${r.reason}${cves} |`;
    });
    const summary = `**${critical} critical · ${high} high · ${medium} medium · ${clean} clean · ${results.length} packages**`;
    const md = [
      '## Hook Check Scan Results',
      '',
      '| Package | Ecosystem | Severity | Details |',
      '|---|---|---|---|',
      ...rows,
      '',
      summary,
      '',
      '_Scanned by [Hook Check](https://hookcheck.dev)_',
    ].join('\n');
    navigator.clipboard?.writeText(md).then(() => {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 2000);
    });
  }

  function shareReport() {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(results));
    const url = `${window.location.origin}${window.location.pathname}#share=${compressed}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }).catch(() => {
        prompt('Copy this link to share the report:', url);
      });
    } else {
      prompt('Copy this link to share the report:', url);
    }
  }

  return (
    <div className="mt-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs tracking-widest flex flex-wrap items-center gap-2" style={{ color: 'var(--muted)' }}>
          {!scanning && (
            <span style={{ color: 'var(--fg)' }}>
              SCAN COMPLETE
              {scanMs !== undefined && (
                <span style={{ color: 'var(--dim-lo)', marginLeft: 6 }}>
                  {scanMs >= 1000 ? `${(scanMs / 1000).toFixed(1)}s` : `${scanMs}ms`}
                </span>
              )}
            </span>
          )}
          <span>·</span>
          <span style={{ color: 'var(--critical)' }}>{critical} CRITICAL</span>
          <span>·</span>
          <span style={{ color: 'var(--warning)' }}>{high} HIGH</span>
          <span>·</span>
          <span style={{ color: 'var(--warning)' }}>{medium} MED</span>
          {osvDone && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--critical)' }}>{cveCritical} CVE-CRIT</span>
              <span>·</span>
              <span style={{ color: 'var(--orange)' }}>{cveHigh} CVE-HIGH</span>
              <span>·</span>
              <span style={{ color: 'var(--fg)' }}>{totalCves} CVEs</span>
              <span>·</span>
              <span style={{ color: 'var(--clean)' }}>{cveClean} CLEAN</span>
            </>
          )}
          <span>·</span>
          <span style={{ color: 'var(--fg)' }}>{results.length} packages</span>
          {scanning && (
            <span className="ml-1 px-2 py-0.5" style={{ border: '1px solid var(--warning)', color: 'var(--warning)' }}>
              SCANNING...
            </span>
          )}
        </p>
        {!scanning && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyMarkdown}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: `1px solid ${mdCopied ? 'var(--clean)' : 'var(--border)'}`, color: mdCopied ? 'var(--clean)' : 'var(--fg)' }}
              onMouseEnter={e => { if (!mdCopied) e.currentTarget.style.borderColor = 'var(--fg)'; }}
              onMouseLeave={e => { if (!mdCopied) e.currentTarget.style.borderColor = mdCopied ? 'var(--clean)' : 'var(--border)'; }}
              title="Copy results as Markdown table — paste into GitHub PRs, issues, or Slack"
            >
              {mdCopied ? 'COPIED!' : 'MD'}
            </button>
            <button
              onClick={exportJson}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              JSON
            </button>
            <button
              onClick={exportText}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              TXT
            </button>
            <button
              onClick={exportSarif}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: `1px solid ${sarifCopied ? 'var(--clean)' : 'var(--border)'}`, color: sarifCopied ? 'var(--clean)' : 'var(--fg)' }}
              onMouseEnter={e => { if (!sarifCopied) e.currentTarget.style.borderColor = 'var(--fg)'; }}
              onMouseLeave={e => { if (!sarifCopied) e.currentTarget.style.borderColor = sarifCopied ? 'var(--clean)' : 'var(--border)'; }}
              title="Export SARIF - upload to GitHub code scanning"
            >
              {sarifCopied ? 'SAVED!' : 'SARIF'}
            </button>
            <button
              onClick={exportSbom}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: `1px solid ${sbomExported ? 'var(--clean)' : 'var(--border)'}`, color: sbomExported ? 'var(--clean)' : 'var(--fg)' }}
              onMouseEnter={e => { if (!sbomExported) e.currentTarget.style.borderColor = 'var(--fg)'; }}
              onMouseLeave={e => { if (!sbomExported) e.currentTarget.style.borderColor = sbomExported ? 'var(--clean)' : 'var(--border)'; }}
              title="Export CycloneDX 1.4 SBOM - Software Bill of Materials"
            >
              {sbomExported ? 'SAVED!' : 'SBOM'}
            </button>
            <button
              onClick={exportPdf}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: `1px solid ${pdfOpened ? 'var(--clean)' : 'var(--border)'}`, color: pdfOpened ? 'var(--clean)' : 'var(--fg)' }}
              onMouseEnter={e => { if (!pdfOpened) e.currentTarget.style.borderColor = 'var(--fg)'; }}
              onMouseLeave={e => { if (!pdfOpened) e.currentTarget.style.borderColor = pdfOpened ? 'var(--clean)' : 'var(--border)'; }}
              title="Open print-ready report - use browser Print → Save as PDF"
            >
              {pdfOpened ? 'OPENED!' : 'PDF'}
            </button>
            <button
              onClick={shareReport}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: shareCopied ? 'var(--clean)' : 'var(--fg)' }}
              onMouseEnter={e => { if (!shareCopied) e.currentTarget.style.borderColor = 'var(--fg)'; }}
              onMouseLeave={e => { if (!shareCopied) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {shareCopied ? 'COPIED!' : 'SHARE →'}
            </button>
            <button
              onClick={() => setCiOpen(o => !o)}
              className="text-xs tracking-widest px-3 py-2 transition-colors"
              style={{ border: `1px solid ${ciOpen ? 'var(--fg)' : 'var(--border)'}`, color: 'var(--fg)' }}
            >
              {ciOpen ? 'CI SETUP ▲' : 'CI SETUP ▼'}
            </button>
          </div>
        )}
      </div>

      {/* CI Setup panel */}
      {!scanning && ciOpen && (() => {
        const yaml = buildGhYaml();
        function copySnippet(text: string, setCopied: (v: boolean) => void) {
          navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
        }
        return (
          <div className="mt-3 text-xs" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="tracking-widest" style={{ color: 'var(--muted)' }}>GITHUB ACTIONS</p>
                <button
                  onClick={() => copySnippet(yaml, setYamlCopied)}
                  className="shrink-0 px-3 py-1 text-xs tracking-widest transition-colors"
                  style={{ border: '1px solid var(--border)', color: yamlCopied ? 'var(--clean)' : 'var(--muted)' }}
                >
                  {yamlCopied ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              <pre
                className="text-xs leading-relaxed overflow-x-auto"
                style={{ color: 'var(--fg)', opacity: 0.7, maxHeight: 200, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              >{yaml}</pre>
            </div>
          </div>
        );
      })()}

      <ScanCharts results={results} scanning={scanning} filter={filter} onFilter={setFilter} />

      {/* ALL CLEAR state */}
      {allClean && (
        <div
          className="my-6 px-6 py-8 text-center"
          style={{ border: '1px solid var(--clean)' }}
        >
          <p className="text-4xl md:text-5xl font-black tracking-widest mb-3" style={{ color: 'var(--clean)', wordSpacing: '-0.2em' }}>
            ALL CLEAR
          </p>
          <p className="text-xs tracking-widest" style={{ color: 'var(--dim-lo)' }}>
            {results.length} package{results.length !== 1 ? 's' : ''} scanned · no flags · no known CVEs
          </p>
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', maxHeight: 'min(600px, 70vh)', overflowY: 'auto' }}>
        {deps.length === 0 && devDeps.length === 0 ? (
          <div className="px-4 py-8 text-xs tracking-widest text-center" style={{ color: 'var(--dim-hi)' }}>
            NO PACKAGES MATCH THIS FILTER
            <button
              onClick={() => setFilter(null)}
              style={{ display: 'block', margin: '8px auto 0', color: 'var(--dim-lo)', background: 'none', border: '1px solid var(--border)', padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}
            >
              RESET ×
            </button>
          </div>
        ) : (
          <>
            {renderGroup(deps, 'DEPENDENCIES', 0)}
            {devDeps.length > 0 && renderGroup(devDeps, 'DEV DEPENDENCIES', deps.length)}
          </>
        )}
      </div>
    </div>
  );
}
