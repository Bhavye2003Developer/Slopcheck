import type { ParsedPackage, ScanResult, Severity } from './types';
import { checkPackage } from './checkers';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  clean: 3,
  unsupported: 4,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runScan(
  packages: ParsedPackage[],
  onProgress?: (done: number, total: number) => void
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const total = packages.length;
  let done = 0;

  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(pkg => checkPackage(pkg)));
    results.push(...batchResults);
    done += batchResults.length;
    onProgress?.(done, total);
    if (i + BATCH_SIZE < packages.length) await sleep(BATCH_DELAY_MS);
  }

  return results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
