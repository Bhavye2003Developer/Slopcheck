import type { ParsedPackage, ScanResult, Severity, NetworkLogger, NetworkEvent, CVEEntry, FlagType } from './types';
import { checkPackage } from './checkers';
import { checkOsv } from './checkers/checkOsv';
import { getPackageCached, setPackageCached } from './cache';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, clean: 3, unsupported: 4 };
// FlagType sort within same severity (outdated/low_adoption after real warnings)
const FLAG_SUBORDER: Partial<Record<string, number>> = { low_adoption_latest: 0, outdated: 1 };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CVE_SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };

function computeCveSeverity(cves: CVEEntry[]): ScanResult['cveSeverity'] {
  if (cves.length === 0) return 'CLEAN';
  const top = cves.reduce((a, b) =>
    (CVE_SEV_ORDER[a.severity] ?? 4) <= (CVE_SEV_ORDER[b.severity] ?? 4) ? a : b
  );
  const s = top.severity;
  if (s === 'LOW' || s === 'UNKNOWN') return 'LOW';
  return s;
}

function cveFlag(sev: ScanResult['cveSeverity']): FlagType | null {
  if (sev === 'CRITICAL') return 'has_cve_critical';
  if (sev === 'HIGH') return 'has_cve_high';
  if (sev === 'MEDIUM') return 'has_cve_medium';
  return null;
}

export interface ScanCallbacks {
  onResult?: (result: ScanResult, done: number, total: number) => void;
  onNetworkEvent?: (event: NetworkEvent) => void;
  onOsvResult?: (result: ScanResult) => void;
}

export async function runScan(packages: ParsedPackage[], callbacks: ScanCallbacks = {}): Promise<ScanResult[]> {
  const { onResult, onNetworkEvent } = callbacks;
  const results: ScanResult[] = [];
  const total = packages.length;
  let done = 0;

  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async pkg => {
      const cached = getPackageCached(pkg.ecosystem, pkg.name);
      if (cached) {
        onNetworkEvent?.({ pkg: pkg.name, label: 'cache hit', url: `${pkg.ecosystem}::${pkg.name}`, cached: true });
        const result = { ...cached, package: pkg };
        onResult?.(result, ++done, total);
        return result;
      }
      const log: NetworkLogger = event => onNetworkEvent?.(event);
      const result = await checkPackage(pkg, log);
      setPackageCached(result);
      onResult?.(result, ++done, total);
      return result;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    if (i + BATCH_SIZE < packages.length) await sleep(BATCH_DELAY_MS);
  }

  const sorted = results.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    const fa = FLAG_SUBORDER[a.flag] ?? 99;
    const fb = FLAG_SUBORDER[b.flag] ?? 99;
    return fa - fb;
  });

  if (callbacks.onOsvResult) {
    const { onOsvResult } = callbacks;
    void Promise.allSettled(
      sorted.map(async result => {
        const cves = await checkOsv(result.package.name, result.package.ecosystem).catch(() => [] as CVEEntry[]);
        const cveSeverity = computeCveSeverity(cves);
        const flag = cveFlag(cveSeverity);
        onOsvResult({ ...result, cves, cveSeverity, ...(flag ? { flag } : {}) });
      })
    );
  }

  return sorted;
}
