import type { ParsedPackage, ScanResult } from '../types';

const LOW_DOWNLOADS_THRESHOLD = 200;
const RECENT_DAYS = 30;

function isRecent(dateStr: string): boolean {
  const created = new Date(dateStr);
  const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < RECENT_DAYS;
}

export async function checkPypi(pkg: ParsedPackage): Promise<ScanResult> {
  const registryUrl = `https://pypi.org/project/${pkg.name}`;

  let pypiData: Record<string, unknown>;
  try {
    const res = await fetch(`https://pypi.org/pypi/${pkg.name}/json`);
    if (!res.ok) {
      return {
        package: pkg,
        flag: 'nonexistent',
        severity: 'critical',
        reason: 'Package not found on PyPI',
        registryUrl,
        meta: { exists: false },
      };
    }
    pypiData = await res.json() as Record<string, unknown>;
  } catch {
    return {
      package: pkg,
      flag: 'nonexistent',
      severity: 'critical',
      reason: 'Failed to reach PyPI',
      registryUrl,
      meta: { exists: false },
    };
  }

  // Earliest upload date across all releases
  const releases = pypiData.releases as Record<string, { upload_time?: string }[]> | undefined;
  let createdAt: string | undefined;
  if (releases) {
    const dates = Object.values(releases)
      .flat()
      .map(r => r.upload_time)
      .filter((d): d is string => Boolean(d))
      .sort();
    createdAt = dates[0];
  }

  // Downloads via pypistats
  let monthlyDownloads: number | undefined;
  try {
    const dlRes = await fetch(`https://pypistats.org/api/packages/${pkg.name.toLowerCase()}/recent`);
    if (dlRes.ok) {
      const dlData = await dlRes.json() as { data?: { last_month?: number } };
      monthlyDownloads = dlData.data?.last_month;
    }
  } catch { /* non-fatal */ }

  const meta = { exists: true, createdAt, monthlyDownloads };

  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Package first uploaded only ${days} days ago`, registryUrl, meta };
  }
  if (monthlyDownloads !== undefined && monthlyDownloads < LOW_DOWNLOADS_THRESHOLD) {
    return { package: pkg, flag: 'low_downloads', severity: 'medium', reason: `Only ${monthlyDownloads.toLocaleString()} downloads last month (threshold: ${LOW_DOWNLOADS_THRESHOLD})`, registryUrl, meta };
  }

  return { package: pkg, flag: 'clean', severity: 'clean', reason: 'Passes all checks', registryUrl, meta };
}
