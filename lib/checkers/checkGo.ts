import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';

const RECENT_DAYS = 30;

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

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

export async function checkGo(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const encodedModule = encodeURIComponent(pkg.name);
  const registryUrl = API.go.page(pkg.name);

  // Check version list from Go proxy
  const listRes = await trackedFetch(API.go.list(encodedModule), pkg.name, 'Go proxy list', log);
  if (!listRes || !listRes.ok) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Module not found on Go proxy', registryUrl, meta: { exists: false } };
  }

  const listText = await listRes.text();
  const versions = listText.trim().split('\n').filter(Boolean);
  const latestVersion = versions[versions.length - 1] ?? undefined;

  // Try to get info for latest version to get timestamps
  let createdAt: string | undefined;
  let updatedAt: string | undefined;
  if (latestVersion) {
    const infoRes = await trackedFetch(
      API.go.info(encodedModule, encodeURIComponent(latestVersion)),
      pkg.name, 'Go proxy info', log
    );
    if (infoRes?.ok) {
      const info = await infoRes.json() as { Time?: string };
      updatedAt = info.Time;
    }
  }

  // Try to get earliest version info for createdAt
  const firstVersion = versions[0];
  if (firstVersion && firstVersion !== latestVersion) {
    const firstInfoRes = await trackedFetch(
      API.go.info(encodedModule, encodeURIComponent(firstVersion)),
      pkg.name, 'Go proxy first version', log
    );
    if (firstInfoRes?.ok) {
      const info = await firstInfoRes.json() as { Time?: string };
      createdAt = info.Time;
    }
  } else {
    createdAt = updatedAt;
  }

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
