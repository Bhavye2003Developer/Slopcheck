import type { ScanResult } from './types';

const cache = new Map<string, ScanResult[]>();

export function getCached(content: string, ecosystem: string, includeDevDeps: boolean): ScanResult[] | null {
  return cache.get(`${ecosystem}::${includeDevDeps}::${content}`) ?? null;
}

export function setCached(content: string, ecosystem: string, includeDevDeps: boolean, results: ScanResult[]): void {
  cache.set(`${ecosystem}::${includeDevDeps}::${content}`, results);
}
