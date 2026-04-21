import type { ScanResult } from './types';

// Per-package cache keyed by ecosystem::name so devDep scans reuse prior results
const packageCache = new Map<string, ScanResult>();

function pkgKey(ecosystem: string, name: string): string {
  return `${ecosystem}::${name}`;
}

export function getPackageCached(ecosystem: string, name: string): ScanResult | null {
  return packageCache.get(pkgKey(ecosystem, name)) ?? null;
}

export function setPackageCached(result: ScanResult): void {
  packageCache.set(pkgKey(result.package.ecosystem, result.package.name), result);
}
