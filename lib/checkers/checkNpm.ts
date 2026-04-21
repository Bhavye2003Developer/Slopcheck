import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';

const SUSPICIOUS_KEYWORDS = ['curl', 'wget', 'eval', 'exec', 'fetch'];
const LOW_DOWNLOADS_THRESHOLD = 500;
const RECENT_DAYS = 30;

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

function isSuspiciousScript(script: string): boolean {
  return SUSPICIOUS_KEYWORDS.some(kw => script.includes(kw));
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

export async function checkNpm(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const encodedName = pkg.name.startsWith('@') ? pkg.name.replace('/', '%2F') : pkg.name;
  const registryUrl = `https://www.npmjs.com/package/${pkg.name}`;

  const res = await trackedFetch(`https://registry.npmjs.org/${encodedName}`, pkg.name, 'npm registry', log);
  if (!res || !res.ok) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Package not found on npm registry', registryUrl, meta: { exists: false } };
  }

  const registryData = await res.json() as Record<string, unknown>;
  const time = registryData.time as Record<string, string> | undefined;
  const createdAt = time?.created;
  const updatedAt = time?.modified;
  const latestVersion = (registryData['dist-tags'] as Record<string, string> | undefined)?.latest;
  const versions = registryData.versions as Record<string, unknown> | undefined;
  const latestMeta = latestVersion && versions ? versions[latestVersion] as Record<string, unknown> : undefined;
  const scripts = latestMeta?.scripts as Record<string, string> | undefined;
  const postInstall = scripts?.postinstall ?? scripts?.install ?? '';
  const hasPostInstall = Boolean(postInstall && isSuspiciousScript(postInstall));

  let monthlyDownloads: number | undefined;
  const dlRes = await trackedFetch(`https://api.npmjs.org/downloads/point/last-month/${encodedName}`, pkg.name, 'npm downloads', log);
  if (dlRes?.ok) {
    const dlData = await dlRes.json() as { downloads?: number };
    monthlyDownloads = dlData.downloads;
  }

  const meta = { exists: true, createdAt, updatedAt, latestVersion, monthlyDownloads, hasPostInstall, postInstallScript: postInstall || undefined };

  if (hasPostInstall) return { package: pkg, flag: 'suspicious_script', severity: 'high', reason: `Post-install script contains suspicious command: ${postInstall.slice(0, 80)}`, registryUrl, meta };
  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Package registered only ${days} days ago`, registryUrl, meta };
  }
  if (monthlyDownloads !== undefined && monthlyDownloads < LOW_DOWNLOADS_THRESHOLD) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${monthlyDownloads.toLocaleString()} downloads last month (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  }
  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
