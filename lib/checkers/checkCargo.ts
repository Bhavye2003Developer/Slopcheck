import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';
import { fetchWithTimeout, TEN_MIN } from '../fetch';

const LOW_DOWNLOADS_THRESHOLD = 500;
const RECENT_DAYS = 30;
const LOW_ADOPTION_DAYS = 14;

type CargoData = { crate?: Record<string, unknown> };

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

export async function checkCargo(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const registryUrl = API.cargo.page(pkg.name);

  const data = await fetchWithTimeout<CargoData>(API.cargo.registry(pkg.name), {
    timeout: 4000,
    ttl: TEN_MIN,
    fetchOptions: { headers: { 'User-Agent': 'hookcheck/1.0' } },
    log,
    logPkg: pkg.name,
    logLabel: 'crates.io registry',
  });

  if (!data) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Crate not found on crates.io', registryUrl, meta: { exists: false } };
  }

  const crate = data.crate;
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
      return { package: pkg, flag: 'low_adoption_latest', severity: 'medium', reason: `Latest v${latestVersion} is only ${latestAgeDays} days old -low adoption, your v${pkg.version} may be more stable`, registryUrl, meta };
    }
    return { package: pkg, flag: 'outdated', severity: 'medium', reason: `Using v${pkg.version}, latest is v${latestVersion} -consider upgrading`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
