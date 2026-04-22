import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';
import { fetchWithTimeout, TEN_MIN, ONE_HOUR } from '../fetch';

const SUSPICIOUS_KEYWORDS = ['curl', 'wget', 'eval', 'exec', 'fetch'];
const LOW_DOWNLOADS_THRESHOLD = 500;
const RECENT_DAYS = 30;
const LOW_ADOPTION_DAYS = 14;

type NpmRegistry = Record<string, unknown>;
type NpmDownloads = { downloads?: number };

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

function isSuspiciousScript(script: string): boolean {
  return SUSPICIOUS_KEYWORDS.some(kw => script.includes(kw));
}

export async function checkNpm(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const encodedName = pkg.name.startsWith('@') ? pkg.name.replace('/', '%2F') : pkg.name;
  const registryUrl = API.npm.page(pkg.name);

  const [registryResult, downloadsResult] = await Promise.allSettled([
    fetchWithTimeout<NpmRegistry>(API.npm.registry(encodedName), {
      timeout: 4000, ttl: TEN_MIN, log, logPkg: pkg.name, logLabel: 'npm registry',
    }),
    fetchWithTimeout<NpmDownloads>(API.npm.downloads(encodedName), {
      timeout: 2000, ttl: ONE_HOUR, log, logPkg: pkg.name, logLabel: 'npm downloads',
    }),
  ]);

  const registryData = registryResult.status === 'fulfilled' ? registryResult.value : null;
  const dlData = downloadsResult.status === 'fulfilled' ? downloadsResult.value : null;

  if (!registryData || !registryData.name) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Package not found on npm registry', registryUrl, meta: { exists: false } };
  }

  const time = registryData.time as Record<string, string> | undefined;
  const createdAt = time?.created;
  const updatedAt = time?.modified;
  const latestVersion = (registryData['dist-tags'] as Record<string, string> | undefined)?.latest;
  const versions = registryData.versions as Record<string, unknown> | undefined;
  const latestMeta = latestVersion && versions ? versions[latestVersion] as Record<string, unknown> : undefined;
  const scripts = latestMeta?.scripts as Record<string, string> | undefined;
  const postInstall = scripts?.postinstall ?? scripts?.install ?? '';
  const hasPostInstall = Boolean(postInstall && isSuspiciousScript(postInstall));
  const monthlyDownloads = dlData?.downloads;

  const meta = { exists: true, createdAt, updatedAt, latestVersion, monthlyDownloads, hasPostInstall, postInstallScript: postInstall || undefined };

  if (hasPostInstall) return { package: pkg, flag: 'suspicious_script', severity: 'high', reason: `Post-install script contains suspicious command: ${postInstall.slice(0, 80)}`, registryUrl, meta };
  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Package registered only ${days} days ago`, registryUrl, meta };
  }
  if (monthlyDownloads !== undefined && monthlyDownloads < LOW_DOWNLOADS_THRESHOLD) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${monthlyDownloads.toLocaleString()} downloads last month (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  }

  if (latestVersion && pkg.version && pkg.version !== latestVersion) {
    const latestPublishedAt = time?.[latestVersion];
    if (latestPublishedAt) {
      const latestAgeDays = Math.floor((Date.now() - new Date(latestPublishedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (latestAgeDays < LOW_ADOPTION_DAYS) {
        const dl = monthlyDownloads !== undefined ? ` |${monthlyDownloads.toLocaleString()} total dl/mo` : '';
        return { package: pkg, flag: 'low_adoption_latest', severity: 'medium', reason: `Latest v${latestVersion} is only ${latestAgeDays} days old -low adoption, your v${pkg.version} may be more stable${dl}`, registryUrl, meta };
      }
    }
    return { package: pkg, flag: 'outdated', severity: 'medium', reason: `Using v${pkg.version}, latest is v${latestVersion} -consider upgrading`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
