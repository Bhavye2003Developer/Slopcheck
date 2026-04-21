import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';
import { fetchWithTimeout, TEN_MIN, ONE_HOUR } from '../fetch';

const LOW_DOWNLOADS_THRESHOLD = 200;
const RECENT_DAYS = 30;
const LOW_ADOPTION_DAYS = 14;

type PypiData = Record<string, unknown>;
type PypiDownloads = { data?: { last_month?: number } };

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

export async function checkPypi(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const registryUrl = API.pypi.page(pkg.name);

  const [registryResult, downloadsResult] = await Promise.allSettled([
    fetchWithTimeout<PypiData>(API.pypi.registry(pkg.name), {
      timeout: 4000, ttl: TEN_MIN, log, logPkg: pkg.name, logLabel: 'PyPI registry',
    }),
    fetchWithTimeout<PypiDownloads>(API.pypi.downloads(pkg.name.toLowerCase()), {
      timeout: 2000, ttl: ONE_HOUR, log, logPkg: pkg.name, logLabel: 'PyPI downloads',
    }),
  ]);

  const pypiData = registryResult.status === 'fulfilled' ? registryResult.value : null;
  const dlData = downloadsResult.status === 'fulfilled' ? downloadsResult.value : null;

  if (!pypiData) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Package not found on PyPI', registryUrl, meta: { exists: false } };
  }

  const info = pypiData.info as Record<string, unknown> | undefined;
  const latestVersion = info?.version as string | undefined;

  const releases = pypiData.releases as Record<string, { upload_time?: string }[]> | undefined;
  let createdAt: string | undefined;
  let updatedAt: string | undefined;
  if (releases) {
    const dates = Object.values(releases).flat().map(r => r.upload_time).filter((d): d is string => Boolean(d)).sort();
    createdAt = dates[0];
    updatedAt = dates[dates.length - 1];
  }

  const monthlyDownloads = dlData?.data?.last_month;

  const meta = { exists: true, createdAt, updatedAt, latestVersion, monthlyDownloads };

  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Package first uploaded only ${days} days ago`, registryUrl, meta };
  }
  if (monthlyDownloads !== undefined && monthlyDownloads < LOW_DOWNLOADS_THRESHOLD) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${monthlyDownloads.toLocaleString()} downloads last month (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  }

  if (latestVersion && pkg.version && pkg.version !== latestVersion && updatedAt) {
    const latestAgeDays = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (latestAgeDays < LOW_ADOPTION_DAYS) {
      const dl = monthlyDownloads !== undefined ? ` |${monthlyDownloads.toLocaleString()} total dl/mo` : '';
      return { package: pkg, flag: 'low_adoption_latest', severity: 'medium', reason: `Latest v${latestVersion} is only ${latestAgeDays} days old -low adoption, your v${pkg.version} may be more stable${dl}`, registryUrl, meta };
    }
    return { package: pkg, flag: 'outdated', severity: 'medium', reason: `Using v${pkg.version}, latest is v${latestVersion} -consider upgrading`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
