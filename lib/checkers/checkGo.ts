import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';
import { fetchWithTimeout, TEN_MIN } from '../fetch';

const RECENT_DAYS = 30;

type GoInfo = { Time?: string };

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

export async function checkGo(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const encodedModule = encodeURIComponent(pkg.name);
  const registryUrl = API.go.page(pkg.name);

  const listText = await fetchWithTimeout<string>(API.go.list(encodedModule), {
    timeout: 4000, ttl: TEN_MIN, parseAs: 'text', log, logPkg: pkg.name, logLabel: 'Go proxy list',
  });

  if (!listText) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Module not found on Go proxy', registryUrl, meta: { exists: false } };
  }

  const versions = listText.trim().split('\n').filter(Boolean);
  const latestVersion = versions[versions.length - 1] ?? undefined;
  const firstVersion = versions[0];
  const hasDistinctFirst = Boolean(firstVersion && firstVersion !== latestVersion);

  const infoRequests: Array<[string, string]> = [];
  if (latestVersion) {
    infoRequests.push([API.go.info(encodedModule, encodeURIComponent(latestVersion)), 'Go proxy info']);
  }
  if (hasDistinctFirst && firstVersion) {
    infoRequests.push([API.go.info(encodedModule, encodeURIComponent(firstVersion)), 'Go proxy first version']);
  }

  const infoResults = await Promise.allSettled(
    infoRequests.map(([url, label]) =>
      fetchWithTimeout<GoInfo>(url, { timeout: 2500, ttl: TEN_MIN, log, logPkg: pkg.name, logLabel: label })
    )
  );

  const latestInfoResult = infoResults[0];
  const firstInfoResult = hasDistinctFirst ? infoResults[1] : infoResults[0];

  const updatedAt = latestInfoResult?.status === 'fulfilled' ? latestInfoResult.value?.Time : undefined;
  const createdAt = firstInfoResult?.status === 'fulfilled' ? firstInfoResult.value?.Time : undefined;

  const meta = { exists: true, createdAt, updatedAt, latestVersion };

  if (updatedAt && isRecent(updatedAt) && versions.length === 1) {
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Module first published only ${days} days ago`, registryUrl, meta };
  }

  if (latestVersion && pkg.version && pkg.version !== latestVersion) {
    return { package: pkg, flag: 'outdated', severity: 'medium', reason: `Using ${pkg.version}, latest is ${latestVersion} -consider upgrading`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
