import type { ParsedPackage, ScanResult, Severity, NetworkLogger, NetworkEvent } from './types';
import { checkPackage } from './checkers';
import { getPackageCached, setPackageCached } from './cache';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, clean: 3, unsupported: 4 };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface ScanCallbacks {
  onResult?: (result: ScanResult, done: number, total: number) => void;
  onNetworkEvent?: (event: NetworkEvent) => void;
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

  return results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
