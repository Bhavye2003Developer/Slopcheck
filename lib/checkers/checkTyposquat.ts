import type { NetworkLogger } from '../types';
import { fetchWithTimeout, ONE_HOUR } from '../fetch';

export function generateCandidates(name: string): string[] {
  const set = new Set<string>();

  // separator swap and removal
  if (name.includes('-')) set.add(name.replaceAll('-', '_'));
  if (name.includes('_')) set.add(name.replaceAll('_', '-'));
  if (name.includes('-') || name.includes('_')) set.add(name.replace(/[-_]/g, ''));

  // single deletions
  for (let i = 0; i < name.length; i++) {
    const c = name.slice(0, i) + name.slice(i + 1);
    if (c.length >= 3) set.add(c);
  }

  // adjacent transpositions
  for (let i = 0; i < name.length - 1; i++) {
    const arr = [...name];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    const c = arr.join('');
    if (c !== name) set.add(c);
  }

  set.delete(name);
  return [...set].slice(0, 14);
}

function fmtDl(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export interface TyposquatMatch {
  candidate: string;
  candidateDownloads: number;
  candidateDlFmt: string;
}

async function findBestCandidate(
  candidates: string[],
  fetchDl: (name: string) => Promise<number>,
  pkgDownloads: number | undefined
): Promise<TyposquatMatch | null> {
  if (candidates.length === 0) return null;
  const pkgDl = pkgDownloads ?? 0;
  const results = await Promise.allSettled(candidates.map(async c => ({ c, dl: await fetchDl(c) })));
  let best: TyposquatMatch | null = null;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { c, dl } = r.value;
    if (dl >= 10_000 && dl > pkgDl * 10) {
      if (!best || dl > best.candidateDownloads) {
        best = { candidate: c, candidateDownloads: dl, candidateDlFmt: fmtDl(dl) };
      }
    }
  }
  return best;
}

export async function checkTyposquatNpm(
  name: string,
  pkgDownloads: number | undefined,
  log?: NetworkLogger
): Promise<TyposquatMatch | null> {
  if (pkgDownloads !== undefined && pkgDownloads >= 50_000) return null;
  const candidates = generateCandidates(name);
  return findBestCandidate(candidates, async c => {
    const encoded = c.startsWith('@') ? c.replace('/', '%2F') : c;
    const data = await fetchWithTimeout<{ downloads?: number }>(
      `https://api.npmjs.org/downloads/point/last-month/${encoded}`,
      { timeout: 2500, ttl: ONE_HOUR, log, logPkg: name, logLabel: 'typosquat' }
    );
    return data?.downloads ?? 0;
  }, pkgDownloads);
}

export async function checkTyposquatPypi(
  name: string,
  pkgDownloads: number | undefined,
  log?: NetworkLogger
): Promise<TyposquatMatch | null> {
  if (pkgDownloads !== undefined && pkgDownloads >= 50_000) return null;
  const candidates = generateCandidates(name);
  return findBestCandidate(candidates, async c => {
    const data = await fetchWithTimeout<{ data?: { last_month?: number } }>(
      `https://pypistats.org/api/packages/${c.toLowerCase()}/recent`,
      { timeout: 2500, ttl: ONE_HOUR, log, logPkg: name, logLabel: 'typosquat' }
    );
    return data?.data?.last_month ?? 0;
  }, pkgDownloads);
}
