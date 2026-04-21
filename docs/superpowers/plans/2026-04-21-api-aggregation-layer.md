# API Aggregation Layer Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five copy-pasted `trackedFetch` implementations with a single `fetchWithTimeout` utility that enforces per-endpoint timeouts, in-browser URL caching with TTL, and parallel fetching via `Promise.allSettled`.

**Architecture:** A new `lib/fetch.ts` owns all fetch I/O — AbortController timeouts, a module-scoped URL cache with TTL, and logging. Each checker imports `fetchWithTimeout` and fires its endpoints in parallel using `Promise.allSettled`, with optional endpoints resolving to `null` on failure rather than blocking.

**Tech Stack:** TypeScript strict, Next.js 16, browser `fetch` + `AbortController`. No new dependencies.

> **Note:** This project has no test suite (see CLAUDE.md). Verification steps use `npm run lint` and `npm run build` in place of test runs.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/fetch.ts` | Create | `fetchWithTimeout`, URL cache, TTL constants |
| `lib/checkers/checkNpm.ts` | Modify | Remove local `trackedFetch`, parallel registry + downloads |
| `lib/checkers/checkPypi.ts` | Modify | Same |
| `lib/checkers/checkRubyGems.ts` | Modify | Registry only, no downloads |
| `lib/checkers/checkCargo.ts` | Modify | Preserve `User-Agent` header via `fetchOptions` |
| `lib/checkers/checkGo.ts` | Modify | List critical, two info fetches parallel/secondary |

---

## Task 1: Create lib/fetch.ts

**Files:**
- Create: `lib/fetch.ts`

- [ ] **Step 1: Write lib/fetch.ts**

```typescript
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
    const res = await fetch(url, { signal: controller.signal, ...fetchOptions });
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors on `lib/fetch.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/fetch.ts
git commit -m "feat: add fetchWithTimeout utility with AbortController, URL cache, and TTL"
```

---

## Task 2: Refactor checkNpm.ts

**Files:**
- Modify: `lib/checkers/checkNpm.ts`

- [ ] **Step 1: Replace the entire file contents**

```typescript
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

  if (!registryData) {
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/checkers/checkNpm.ts
git commit -m "refactor: checkNpm -- parallel fetch, AbortController timeouts, URL cache"
```

---

## Task 3: Refactor checkPypi.ts

**Files:**
- Modify: `lib/checkers/checkPypi.ts`

- [ ] **Step 1: Replace the entire file contents**

```typescript
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/checkers/checkPypi.ts
git commit -m "refactor: checkPypi -- parallel fetch, AbortController timeouts, URL cache"
```

---

## Task 4: Refactor checkRubyGems.ts

**Files:**
- Modify: `lib/checkers/checkRubyGems.ts`

- [ ] **Step 1: Replace the entire file contents**

RubyGems has no downloads endpoint — single critical registry fetch only.

```typescript
import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { API } from '../api';
import { fetchWithTimeout, TEN_MIN } from '../fetch';

const LOW_DOWNLOADS_THRESHOLD = 1000;
const RECENT_DAYS = 30;
const LOW_ADOPTION_DAYS = 14;

type RubyGemsData = Record<string, unknown>;

function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) < RECENT_DAYS;
}

export async function checkRubyGems(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  const registryUrl = API.rubygems.page(pkg.name);

  const data = await fetchWithTimeout<RubyGemsData>(API.rubygems.registry(pkg.name), {
    timeout: 4000, ttl: TEN_MIN, log, logPkg: pkg.name, logLabel: 'RubyGems registry',
  });

  if (!data) {
    return { package: pkg, flag: 'nonexistent', severity: 'critical', reason: 'Gem not found on RubyGems', registryUrl, meta: { exists: false } };
  }

  const latestVersion = data.version as string | undefined;
  const createdAt = data.created_at as string | undefined;
  const updatedAt = data.version_created_at as string | undefined;
  const totalDownloads = data.downloads as number | undefined;
  const versionDownloads = data.version_downloads as number | undefined;

  const meta = { exists: true, createdAt, updatedAt, latestVersion, monthlyDownloads: versionDownloads };

  if (createdAt && isRecent(createdAt)) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { package: pkg, flag: 'recently_registered', severity: 'high', reason: `Gem registered only ${days} days ago`, registryUrl, meta };
  }
  if (totalDownloads !== undefined && totalDownloads < LOW_DOWNLOADS_THRESHOLD) {
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/checkers/checkRubyGems.ts
git commit -m "refactor: checkRubyGems -- fetchWithTimeout, AbortController timeout, URL cache"
```

---

## Task 5: Refactor checkCargo.ts

**Files:**
- Modify: `lib/checkers/checkCargo.ts`

- [ ] **Step 1: Replace the entire file contents**

crates.io requires `User-Agent: slopcheck/1.0` — pass via `fetchOptions`.

```typescript
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
    fetchOptions: { headers: { 'User-Agent': 'slopcheck/1.0' } },
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/checkers/checkCargo.ts
git commit -m "refactor: checkCargo -- fetchWithTimeout, AbortController timeout, URL cache"
```

---

## Task 6: Refactor checkGo.ts

**Files:**
- Modify: `lib/checkers/checkGo.ts`

- [ ] **Step 1: Replace the entire file contents**

Go proxy requires a sequential dependency: the list endpoint resolves first (critical, 4000ms), then the two version info fetches fire in parallel (secondary, 2500ms each). The list returns plain text, not JSON — use `parseAs: 'text'`.

When there is only one version (`firstVersion === latestVersion`), only one info fetch is made. The `createdAt` and `updatedAt` both reference that single result.

```typescript
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

  // Build info fetch list: latest always first, first-version second only if distinct
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
  // For single-version modules, reuse the same result for createdAt
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/checkers/checkGo.ts
git commit -m "refactor: checkGo -- parallel info fetches, secondary tier 2500ms, URL cache"
```

---

## Task 7: Final build verification

**Files:** none — verification only

- [ ] **Step 1: Run full production build**

Run: `npm run build`
Expected: exits 0, no TypeScript errors, no import errors

- [ ] **Step 2: Confirm no fetch calls outside lib/fetch.ts**

Run: `grep -rn "await fetch(" lib/checkers/`
Expected: no output — all direct `fetch` calls have been removed from checkers

- [ ] **Step 3: Commit if build is clean**

If build passes without changes, no commit needed. If the build surfaces a type error, fix it, then:

```bash
git add lib/
git commit -m "fix: resolve type errors surfaced by build"
```
