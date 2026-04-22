import type { Ecosystem, CVEEntry } from '../types';
import { API } from '../api';
import { fetchWithTimeout, ONE_HOUR } from '../fetch';

const OSV_ECOSYSTEM: Record<Ecosystem, string> = {
  npm: 'npm',
  pypi: 'PyPI',
  rubygems: 'RubyGems',
  go: 'Go',
  cargo: 'crates.io',
};

interface OsvSeverity {
  type: string;
  score: string;
}

interface OsvEvent {
  introduced?: string;
  fixed?: string;
}

interface OsvRange {
  type: string;
  events?: OsvEvent[];
}

interface OsvAffected {
  ranges?: OsvRange[];
}

interface OsvDatabaseSpecific {
  severity?: string;
  cvss_v3?: { score?: number };
}

interface OsvVuln {
  id: string;
  summary?: string;
  severity?: OsvSeverity[];
  affected?: OsvAffected[];
  database_specific?: OsvDatabaseSpecific;
}

interface OsvResponse {
  vulns?: OsvVuln[];
}

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };

function normalizeSeverity(raw?: string): CVEEntry['severity'] {
  if (!raw) return 'UNKNOWN';
  const upper = raw.toUpperCase();
  if (upper === 'CRITICAL') return 'CRITICAL';
  if (upper === 'HIGH') return 'HIGH';
  if (upper === 'MEDIUM' || upper === 'MODERATE') return 'MEDIUM';
  if (upper === 'LOW') return 'LOW';
  return 'UNKNOWN';
}

function extractFixed(affected?: OsvAffected[]): string | undefined {
  if (!affected) return undefined;
  for (const a of affected) {
    for (const range of a.ranges ?? []) {
      for (const ev of range.events ?? []) {
        if (ev.fixed) return ev.fixed;
      }
    }
  }
  return undefined;
}

function extractCvss(vuln: OsvVuln): number | null {
  if (vuln.database_specific?.cvss_v3?.score != null) {
    return vuln.database_specific.cvss_v3.score;
  }
  for (const s of vuln.severity ?? []) {
    const match = /\/(\d+\.\d+)$/.exec(s.score);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function parseSeverityFromVuln(vuln: OsvVuln): CVEEntry['severity'] {
  const dbSev = vuln.database_specific?.severity;
  if (dbSev) return normalizeSeverity(dbSev);
  for (const s of vuln.severity ?? []) {
    if (s.type === 'CVSS_V3' || s.type === 'CVSS_V2') {
      const cvss = extractCvss(vuln);
      if (cvss !== null) {
        if (cvss >= 9.0) return 'CRITICAL';
        if (cvss >= 7.0) return 'HIGH';
        if (cvss >= 4.0) return 'MEDIUM';
        return 'LOW';
      }
    }
  }
  return 'UNKNOWN';
}

export async function checkOsv(name: string, ecosystem: Ecosystem): Promise<CVEEntry[]> {
  const osvEcosystem = OSV_ECOSYSTEM[ecosystem];
  const body = JSON.stringify({ package: { name, ecosystem: osvEcosystem } });
  const cacheKey = `osv:${ecosystem}:${name}`;

  const data = await fetchWithTimeout<OsvResponse>(API.osv.query, {
    timeout: 3000,
    ttl: ONE_HOUR,
    cacheKey,
    fetchOptions: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  });

  if (!data?.vulns?.length) return [];

  const entries: CVEEntry[] = data.vulns.map(v => ({
    id: v.id,
    severity: parseSeverityFromVuln(v),
    cvss: extractCvss(v),
    summary: v.summary ?? '',
    fixedIn: extractFixed(v.affected),
  }));

  return entries.sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4));
}
