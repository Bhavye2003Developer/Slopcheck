import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';

const LOW_DOWNLOADS_THRESHOLD = 200;
const RECENT_DAYS = 30;
const LOW_ADOPTION_DAYS = 14;

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

async function trackedFetch(url: string, pkg: string, label: string, log?: NetworkLogger): Promise<Response | null> {
  const t = Date.now();
  try {
    const res = await fetch(url);
    log?.({ pkg, label, url, status: res.status, ok: res.ok, ms: Date.now() - t });
    return res;
  } catch {
    log?.({ pkg, label, url, ok: false, ms: Date.now() - t });
    return null;
  }
}

export async function checkPypi(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const registryUrl = API.pypi.page(pkg.name);

  const res = await trackedFetch(API.pypi.registry(pkg.name), pkg.name, 'PyPI registry', log);
  if (!res || !res.ok) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Package not found on PyPI', registryUrl, meta: { exists: false } };
  }

  const pypiData = await res.json() as Record<string, unknown>;
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

  let monthlyDownloads: number | undefined;
  const dlRes = await trackedFetch(API.pypi.downloads(pkg.name.toLowerCase()), pkg.name, 'PyPI downloads', log);
  if (dlRes?.ok) {
    const dlData = await dlRes.json() as { data?: { last_month?: number } };
    monthlyDownloads = dlData.data?.last_month;
  }

  const meta = { exists: true, createdAt, updatedAt, latestVersion, monthlyDownloads };

  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Package first uploaded only ${days} days ago`, registryUrl, meta };
  }
  if (monthlyDownloads !== undefined && monthlyDownloads < LOW_DOWNLOADS_THRESHOLD) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${monthlyDownloads.toLocaleString()} downloads last month (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  }

  // Outdated version check — use latest release upload time as adoption proxy
  if (latestVersion && pkg.version && pkg.version !== latestVersion && updatedAt) {
    const latestAgeDays = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (latestAgeDays < LOW_ADOPTION_DAYS) {
      const dl = monthlyDownloads !== undefined ? ` · ${monthlyDownloads.toLocaleString()} total dl/mo` : '';
      return { package: pkg, flag: 'low_adoption_latest', severity: 'medium', reason: `Latest v${latestVersion} is only ${latestAgeDays} days old — low adoption, your v${pkg.version} may be more stable${dl}`, registryUrl, meta };
    }
    return { package: pkg, flag: 'outdated', severity: 'medium', reason: `Using v${pkg.version}, latest is v${latestVersion} — consider upgrading`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
