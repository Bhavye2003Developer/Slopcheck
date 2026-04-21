# API Aggregation Layer Refactor — Design Spec

**Date:** 2026-04-21
**Approach:** A — Centralized fetch utility, checkers stay orchestrators

---

## Problem

The current checker layer has five problems:

1. `trackedFetch` is copy-pasted into every checker (5 copies) with no shared behavior.
2. No timeouts — a slow PyPIStats or Go proxy response blocks the entire scan indefinitely.
3. No URL-level cache with TTL — only full ScanResult objects are cached, with no expiry.
4. Fetches within each checker are sequential (registry → downloads), adding unnecessary latency.
5. No endpoint tier classification — a failed optional download stat can surface as an unhandled error path.

---

## Goals

- Single `fetchWithTimeout` utility all API calls go through — nothing calls `fetch` directly.
- Per-endpoint timeouts enforced via AbortController, tiered by reliability.
- In-browser URL-level cache (module-scope Map, TTL-based) for registry metadata and download counts.
- Parallel fetches within each checker via `Promise.allSettled`.
- Optional endpoints (download counts) always resolve to `null` on failure — never block or throw.
- Diff confined to `lib/fetch.ts` (new) and `lib/checkers/check*.ts` (modified). Nothing else changes.

---

## Section 1 — lib/fetch.ts

### URL Cache

A module-scoped `Map<string, { value: unknown; expiresAt: number }>`. Per-tab, resets on refresh. No localStorage, no server state.

Two TTL constants exported for callers:

```ts
export const TEN_MIN = 10 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;
```

### fetchWithTimeout

```ts
fetchWithTimeout<T>(url: string, options: FetchOptions): Promise<T | null>
```

`FetchOptions`:
- `timeout: number` — ms before AbortController fires
- `ttl?: number` — ms until cache entry expires (defaults to `TEN_MIN`)
- `cacheKey?: string` — defaults to the URL itself
- `fetchOptions?: RequestInit` — forwarded to `fetch` (e.g. `User-Agent` header for crates.io)

Behavior:
1. Check cache — if hit and not expired, return cached value immediately.
2. Create `AbortController`, attach `setTimeout` that calls `abort()` after `timeout` ms.
3. Call `fetch(url, { signal, ...fetchOptions })`.
4. On success (2xx) — parse JSON, store in cache with `expiresAt = now + ttl`, clear timeout, return value.
5. On any error (network failure, abort, non-2xx) — clear timeout, return `null`. Never throws.

Return type is `T | null`. The caller decides what `null` means based on the endpoint tier.

### Cache keying

Default key is the URL. The `cacheKey` override exists for future cases where the same resource is reachable via multiple URLs — not needed now but costs nothing to support.

---

## Section 2 — Endpoint Tiers

| Tier | Endpoints | Timeout | On null |
|---|---|---|---|
| critical | npm registry, PyPI registry, RubyGems registry, crates.io registry, Go proxy list | 4000ms | Return `nonexistent` result — scan stops here |
| secondary | Go proxy info (version timestamps, two fetches) | 2500ms | `undefined` — skip checks that need timestamp data |
| optional | npm downloads API, PyPIStats | 2000ms | `null` — skip downloads check, rest of logic proceeds |

### Parallel fetch pattern inside each checker

```ts
const [registryResult, downloadsResult] = await Promise.allSettled([
  fetchWithTimeout<RegistryShape>(registryUrl, { timeout: 4000, ttl: TEN_MIN }),
  fetchWithTimeout<DownloadsShape>(downloadsUrl, { timeout: 2000, ttl: ONE_HOUR }),
]);

const registryData = registryResult.status === 'fulfilled' ? registryResult.value : null;
const downloads = downloadsResult.status === 'fulfilled' ? downloadsResult.value : null;
```

Critical endpoint `null` → early return `nonexistent`. Optional `null` → skip that check, continue.

### Go special case

Go proxy requires a sequential dependency: the list endpoint (critical, 4000ms) must resolve before the two info fetches (secondary, 2500ms each) can fire, because the version strings come from the list response. The two info fetches (latest version, first version) fire in parallel with each other after the list resolves.

---

## Section 3 — Cache TTL Assignment

| Endpoint | TTL |
|---|---|
| npm registry | `TEN_MIN` |
| PyPI registry | `TEN_MIN` |
| RubyGems registry | `TEN_MIN` |
| crates.io registry | `TEN_MIN` |
| Go proxy list | `TEN_MIN` |
| Go proxy info | `TEN_MIN` |
| npm downloads API | `ONE_HOUR` |
| PyPIStats | `ONE_HOUR` |

The existing `lib/cache.ts` ScanResult-level cache is unchanged. It operates above the URL cache — if the same package name appears twice in a manifest, the full check is skipped entirely. The two cache layers coexist without conflict.

---

## Section 4 — Files Changed

### New

- `lib/fetch.ts` — `fetchWithTimeout`, URL cache map, `TEN_MIN`, `ONE_HOUR`

### Modified

- `lib/checkers/checkNpm.ts` — remove local `trackedFetch`, import `fetchWithTimeout`, parallelize registry + downloads, apply tier timeouts
- `lib/checkers/checkPypi.ts` — same
- `lib/checkers/checkRubyGems.ts` — same (registry only, no downloads endpoint)
- `lib/checkers/checkCargo.ts` — same, preserve `User-Agent: slopcheck/1.0` via `fetchOptions`
- `lib/checkers/checkGo.ts` — list critical (4000ms), two info fetches secondary (2500ms) and parallel

### Untouched

- `lib/api.ts` — URL constants unchanged
- `lib/cache.ts` — ScanResult cache unchanged
- `lib/checkers/index.ts` — dispatch switch unchanged
- `lib/scanner.ts` — batch/sort/callback logic unchanged
- `lib/types.ts` — no shape changes
- All parsers (`lib/parsers/`)
- All UI components (`app/`, `components/`)

---

## Non-Goals

- OSV CVE integration — out of scope for this refactor
- ScanResult shape changes — optional fields remain flat in `meta`, no `core/optional` sub-objects
- localStorage or server-side caching
- Changes to batching logic in `scanner.ts`
