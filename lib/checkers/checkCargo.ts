import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';

const LOW_DOWNLOADS_THRESHOLD = 500;
const RECENT_DAYS = 30;
const LOW_ADOPTION_DAYS = 14;

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

async function trackedFetch(url: string, pkg: string, label: string, log?: NetworkLogger): Promise<Response | null> {
  const t = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'slopcheck/1.0' } });
    log?.({ pkg, label, url, status: res.status, ok: res.ok, ms: Date.now() - t });
    return res;
  } catch {
    log?.({ pkg, label, url, ok: false, ms: Date.now() - t });
    return null;
  }
}

export async function checkCargo(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const registryUrl = API.cargo.page(pkg.name);

  const res = await trackedFetch(API.cargo.registry(pkg.name), pkg.name, 'crates.io registry', log);
  if (!res || !res.ok) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Crate not found on crates.io', registryUrl, meta: { exists: false } };
  }

  const data = await res.json() as Record<string, unknown>;
  const crate = data.crate as Record<string, unknown> | undefined;
  const latestVersion = crate?.max_stable_version as string | undefined ?? crate?.max_version as string | undefined;
  const createdAt = crate?.created_at as string | undefined;
  const updatedAt = crate?.updated_at as string | undefined;
  const totalDownloads = crate?.downloads as number | undefined;
  const recentDownloads = crate?.recent_downloads as number | undefined;

  const meta = { exists: true, createdAt, updatedAt, latestVersion, monthlyDownloads: recentDownloads };

  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Crate published only ${days} days ago`, registryUrl, meta };
  }
  if (recentDownloads !== undefined && recentDownloads < LOW_DOWNLOADS_THRESHOLD) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${recentDownloads.toLocaleString()} recent downloads (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  } else if (totalDownloads !== undefined && totalDownloads < LOW_DOWNLOADS_THRESHOLD && recentDownloads === undefined) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${totalDownloads.toLocaleString()} total downloads (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  }

  if (latestVersion && pkg.version && pkg.version !== latestVersion && updatedAt) {
    const latestAgeDays = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (latestAgeDays < LOW_ADOPTION_DAYS) {
      return { package: pkg, flag: 'low_adoption_latest', severity: 'medium', reason: `Latest v${latestVersion} is only ${latestAgeDays} days old — low adoption, your v${pkg.version} may be more stable`, registryUrl, meta };
    }
    return { package: pkg, flag: 'outdated', severity: 'medium', reason: `Using v${pkg.version}, latest is v${latestVersion} — consider upgrading`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
