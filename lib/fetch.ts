import type { NetworkLogger } from './types';

const urlCache = new Map<string, { value: unknown; expiresAt: number }>();

export const TEN_MIN = 10 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;

export interface FetchOptions {
  timeout: number;
  ttl?: number;
  cacheKey?: string;
  fetchOptions?: RequestInit;
  parseAs?: 'json' | 'text';
  log?: NetworkLogger;
  logLabel?: string;
  logPkg?: string;
}

export async function fetchWithTimeout<T>(url: string, options: FetchOptions): Promise<T | null> {
  const {
    timeout,
    ttl = TEN_MIN,
    cacheKey = url,
    fetchOptions,
    parseAs = 'json',
    log,
    logLabel = '',
    logPkg = '',
  } = options;

  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    log?.({ pkg: logPkg, label: logLabel, url, cached: true });
    return cached.value as T;
  }

  const controller = new AbortController();
  const t = Date.now();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timer);
    log?.({ pkg: logPkg, label: logLabel, url, status: res.status, ok: res.ok, ms: Date.now() - t });
    if (!res.ok) return null;
    const value = (parseAs === 'text' ? await res.text() : await res.json()) as T;
    urlCache.set(cacheKey, { value, expiresAt: Date.now() + ttl });
    return value;
  } catch {
    clearTimeout(timer);
    log?.({ pkg: logPkg, label: logLabel, url, ok: false, ms: Date.now() - t });
    return null;
  }
}
