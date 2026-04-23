# Slop Check — Build Progress

Ordered by dependency: foundation → logic → UI → integration.

---

## Phase 1 — Foundation ✅

- [x] `app/layout.tsx` — JetBrains Mono via Google Fonts; metadata title + description
- [x] `app/globals.css` — CSS variables (`--bg #0a0a0a`, `--fg`, `--critical #ff4444`, `--warning #ffaa00`, `--clean #22ff88`, `--muted`, `--border`); scanline overlay keyframe; staggered fade-in keyframe; base body styles; global scrollbar hidden; `word-spacing: -1.5px` on `p`/`li` to reduce monospace word gaps; `scroll-behavior: smooth` on `html`
- [x] `lib/types.ts` — `Ecosystem`, `FlagType`, `Severity`, `ParsedPackage`, `ScanResult`, `NetworkEvent`, `NetworkLogger`, `CVEEntry` types

---

## Phase 2 — Parsers (`lib/parsers/`) ✅

- [x] `parsePackageJson.ts` — parses `dependencies` + optional `devDependencies`; marks `isDev: boolean`; strips `^~>=`
- [x] `parseRequirementsTxt.ts` — skips `#` comments and blank lines; strips `==`, `>=`, `~=`, `!=`; handles extras like `flask[async]`
- [x] `parsePyprojectToml.ts` — extracts `[project].dependencies` and `[tool.poetry.dependencies]`
- [x] `parseGemfile.ts` — extracts `gem 'name'` lines; skips `source`/`ruby` directives
- [x] `parseGoMod.ts` — extracts `require` block lines via line-by-line state machine (no RegExp exec, avoids security hook false positives)
- [x] `parseCargoToml.ts` — extracts `[dependencies]` keys; handles both `name = "1.0"` and `name = { version = "1.0", ... }` forms
- [x] `lib/parsers/index.ts` — auto-detect ecosystem from content heuristics; `ECOSYSTEM_META` record; `detectAndParse(content, hint, includeDevDeps)` unified entry point

---

## Phase 3 — Checkers (`lib/checkers/`) ✅

All checkers use `fetchWithTimeout` (AbortController + URL cache + TTL) for reliability.

- [x] `checkNpm.ts` — parallel registry + downloads fetch; flags: `nonexistent` (404 or missing `.name`), `recently_registered` (<30 days), `low_downloads` (<500/mo), `suspicious_script` (postinstall contains curl/wget/eval/exec/fetch), `outdated`, `low_adoption_latest` (latest version <14 days old); defensive check on response body to catch 200-with-error-body edge case
- [x] `checkPypi.ts` — pypi.org/pypi/{pkg}/json + pypistats recent endpoint; same flag set; `info` field checked before null guard to handle malformed 200 responses; outdated uses latest release `upload_time` as adoption proxy
- [x] `checkRubyGems.ts` — rubygems.org/api/v1/gems/{name}.json; existence, age, total downloads, version currency
- [x] `checkGo.ts` — proxy.golang.org/{module}/@v/list + .info endpoint; parallel info fetches for version list; secondary timeout tier at 2500ms; URL-cached responses
- [x] `checkCargo.ts` — crates.io/api/v1/crates/{name}; existence, age, `recent_downloads` (<500), outdated/low_adoption_latest
- [x] `checkOsv.ts` — OSV.dev API (`https://api.osv.dev/v1/query`) POST per package; normalizes severity from CVSS score or database_specific field; extracts fixed version from affected ranges; accepts `NetworkLogger` so OSV requests appear in Network Trail; skipped entirely for nonexistent packages
- [x] `lib/checkers/index.ts` — routes by ecosystem: npm → checkNpm, pypi → checkPypi, rubygems → checkRubyGems, go → checkGo, cargo → checkCargo
- [x] `lib/api.ts` — central registry of all API endpoint URLs (npm, PyPI, RubyGems, Go proxy, Crates.io, OSV)
- [x] `lib/fetch.ts` — `fetchWithTimeout<T>()` with AbortController timeout, URL cache (Map with TTL), optional `NetworkLogger` integration, `logPkg`/`logLabel` for trail entries; handles JSON and text parsing
- [x] `lib/cache.ts` — in-memory per-package result cache (`Map<"ecosystem::name", ScanResult>`); devDeps scan reuses normal scan results automatically

---

## Phase 4 — Scan Orchestrator ✅

- [x] `lib/scanner.ts` — `runScan(packages, callbacks)` with `onResult`, `onNetworkEvent`, `onOsvResult` callbacks; batches 10 packages with 100ms delay between batches; fires `onResult` per package for streaming UI updates; checks per-package cache before fetching; OSV runs as a non-blocking second pass via `Promise.allSettled` after registry checks complete; `computeCveSeverity()` maps CVE list to top severity; OSV network events forwarded to `onNetworkEvent` so they appear in Network Trail; skips OSV for packages where `meta.exists === false`

---

## Phase 5 — Static UI Components ✅

- [x] `components/Nav.tsx` — sticky transparent→bordered on scroll; center-slot `NetworkMeter` component (green/red dot + LIVE/OFFLINE, reads `navigator.onLine`, reacts to online/offline events, SSR-safe via null initial state + `startTransition`); desktop links + mobile hamburger; responsive
- [x] `components/Ticker.tsx` — CSS infinite marquee ticker; `tracking-wider` (not widest) to reduce word gaps in monospace
- [x] `components/ScanReceipt.tsx` — terminal-box hero mock card showing sample scan output
- [x] `components/Hero.tsx` — badge row (ID, STATUS, PKG-CHECKS, LATENCY, SOURCE showing all 5 ecosystems); headline; CTA buttons (SCAN NOW anchor, VIEW ON GITHUB); ScanReceipt; Ticker
- [x] `components/ProblemSection.tsx` — two-column layout with slopsquatting threat copy; embeds `LiveStats`
- [x] `components/LiveStats.tsx` — fetches live data client-side: npm CLI downloads (api.npmjs.org), PyPI top-10 package downloads (pypistats per-package sum), npm bulk downloads for 15 core packages; null stats hidden (no placeholder dashes)
- [x] `components/ChecksGrid.tsx` — 5 check cards in 3-col grid; 5th card `lg:col-span-2` to prevent empty 6th cell
- [x] `components/HowItWorks.tsx` — three-step PASTE / SCAN / REVIEW layout
- [x] `components/Faq.tsx` — accordion; 6 questions; reflects all 5 live ecosystems and OSV/CVE scanning
- [x] `components/Footer.tsx` — tagline and GitHub link
- [x] `components/AnimatedSection.tsx` — IntersectionObserver fade-in + slide-up; fires once on enter; no animation library
- [x] `components/SecurityNews.tsx` — dual-source live threat feed: NVD CVE API v2 (last 7 days, CRITICAL/HIGH filtered) + HN Algolia `search_by_date` (security/breach/hack stories, >10 points, newest-first, no date cap); both fetched in parallel via `Promise.allSettled`; merged and sorted newest-first, up to 20 items; `[NVD]` / `[HN]` source tags per row; instant skeleton shown on mount (no layout shift); scrollable at 480px max-height with thin scrollbar; green LIVE badge; mobile-safe two-line card layout (label truncates, no fixed `minWidth` overflow); silent-fail — returns null if both APIs unreachable; React 19 compliant (`startTransition` in async callbacks)

---

## Phase 6 — Scanner UI Components ✅

- [x] `components/scanner/ScanInput.tsx` — textarea; format dropdown (AUTO-DETECT + npm/pypi/rubygems/go/cargo); `DETECTED: {file} — {label}` green badge on auto-detect; devDeps toggle (default: on); SCAN button
- [x] `components/scanner/ScanProgress.tsx` — live progress bar `SCANNING · N / M ████░░ X%`
- [x] `components/scanner/ResultsTable.tsx` — streams results live as they resolve; groups DEPENDENCIES / DEV DEPENDENCIES with sticky headers; per-flag labels; metadata pills (FILE, LATEST, DL, UPDATED, CREATED); expandable CVE panel per package (CVE ID, severity, CVSS score, summary, fixed version, reported date, links to NVD and OSV); staggered fade-in (animationDelay capped at 400ms); internal scroll; export JSON + TXT
- [x] `components/scanner/NetworkTrail.tsx` — collapsible per-request log: CACHE / status code / package name / label / URL / timing in ms; HTTP URLs are clickable `<a>` links opening in new tab (hover brightens opacity); cache entries shown as plain text; OSV/CVE requests appear alongside registry checks with label `osv cve`
- [x] `components/scanner/ScanCharts.tsx` — four-chart dashboard rendered after scan; cross-chart filter system (`ChartFilter` union type drives `matchesFilter()`); RESET button per card clears filter:
  - **Severity Ring** — SVG donut with segments per severity level (critical/high/medium/clean/unsupported); click segment filters results table
  - **CVE Exposure Ring** — SVG donut showing CVE severity distribution from OSV pass; shows "OSV scan in progress..." while pending, "No packages to scan." if all nonexistent
  - **Risk Scatter** — SVG scatter plot: X = monthly downloads (log scale), Y = package age in days; each dot colored by severity; click dot filters to that package; wraps in `overflowX: auto` with `width: max(100%, 600px)` for mobile scroll
  - **Age Distribution** — SVG bar chart bucketing packages into <30d / 30–180d / 180d–2yr / 2yr+ age ranges; click bar filters by age bucket

---

## Phase 7 — Wire Up ✅

- [x] `app/page.tsx` — full section composition; `SecurityNews` between Hero and ScannerSection; all sections wrapped in `AnimatedSection`
- [x] `components/ScannerSection.tsx` — manages scan state (loading, progress, results, networkEvents, chartFilter); calls `runScan` with all three callbacks; renders ScanInput → ScanProgress → ScanCharts → ResultsTable → NetworkTrail; chart filter wired to ResultsTable
- [x] Anchor `id` on each section for nav scroll links
- [x] `app/not-found.tsx` — custom 404 page matching terminal dark aesthetic with nav/footer

---

## Phase 8 — Share & CVE Deep-Links ✅

- [x] **Share button** — compresses scan results to URL hash via `lz-string`; one-click copy; report reconstructed from hash on page load
- [x] **Dismissible share banner** — shown on mount when URL hash contains encoded report; "SHARED REPORT" label + dismiss button
- [x] **CVE deep-links** — each CVE entry in the expanded panel links to `nvd.nist.gov/vuln/detail/{id}` (NVD) and `osv.dev/vulnerability/{id}` (OSV); opens in new tab
- [x] `lz-string` dependency — installed for URL-safe LZ compression of JSON results

---

## Phase 9 — Bug Fixes & Polish ✅

- [x] **Nonexistent package validation** — defensive field-presence check (`registryData.name` for npm, `pypiData.info` for PyPI) catches 200-with-error-body API responses that would otherwise fall through to 'clean'
- [x] **OSV skip for nonexistent packages** — `scanner.ts` guards `if (!result.meta.exists) return` before OSV call; prevents empty-array CVE result being computed as `CLEAN`
- [x] **CVE donut "No packages to scan"** — `ScanCharts` checks `scannable.length === 0` (packages with `meta.exists`) before checking `scanned.length === 0`; shows appropriate message instead of perpetual "OSV scan in progress..."
- [x] **Mobile scatter chart** — `overflowX: auto` wrapper + `width: max(100%, 600px)` on SVG; horizontally scrollable on small screens
- [x] **FAQ accuracy** — updated to reflect all 5 ecosystems live; added OSV/CVE scanning mention
- [x] **Word gaps** — `word-spacing: -1.5px` on `p`/`li` in globals.css; `tracking-wider` on Ticker to reduce visual word gap in monospace font
- [x] **React 19 lint compliance** — `useMemo` for derived state; `startTransition` wrapping all `setState` calls inside async `useEffect` callbacks

---

## Extra Features (Beyond Original Design Doc)

| Feature | Detail |
|---|---|
| Streaming results | `onResult` fires per-package; UI updates live without waiting for full scan |
| Network Trail with links | Per-request log (URL, status, timing, cache hits); HTTP URLs are clickable links |
| OSV in Network Trail | CVE lookup requests appear in trail with `osv cve` label alongside registry checks |
| Per-package result cache | `lib/cache.ts` — second scan with devDeps reuses all prior results automatically |
| Dev/prod separation | `isDev` flag; ResultsTable groups DEPENDENCIES vs DEV DEPENDENCIES with sticky headers |
| Outdated + low adoption flags | Two extra flag types beyond design doc: `outdated` and `low_adoption_latest` |
| Live stats | Real data fetched client-side from public APIs in ProblemSection — no hardcoded numbers |
| RubyGems checker | Full checks via rubygems.org public API |
| Go checker | Existence + version via Go module proxy (proxy.golang.org) |
| Cargo checker | Full checks via crates.io API including recent_downloads |
| Auto-detect badge | Green `DETECTED` badge shown in scan input on paste with format name |
| AnimatedSection | IntersectionObserver fade-in on all sections; no animation library |
| Four-chart dashboard | Severity ring, CVE ring, risk scatter, age distribution — all cross-filterable |
| Share via URL hash | LZ-compressed results encoded in URL; report decoded on load with dismissible banner |
| CVE deep-links | Per-CVE links to NVD and OSV detail pages |
| Custom 404 page | Terminal aesthetic matching rest of site |
| Security news feed | Dual-source: NVD CVEs + HN breach/incident news; parallel fetch, instant skeleton, scrollable |
| Network meter in nav | Green/red dot + LIVE/OFFLINE using `navigator.onLine` + event listeners; SSR-safe |
| OSV skipped for nonexistent | Prevents hallucinated package names from getting a false CLEAN CVE result |
| CVE donut edge case | Correctly shows "No packages to scan" when all packages are nonexistent |
| Nonexistent pkg validation | Field-presence checks catch 200-with-error-body API responses |

---

## Planned / Not Yet Built

| Feature | Notes |
|---|---|
| Typosquat detection | Dynamic: generate edit-distance-1 candidates per package name, fetch their download counts, flag if candidate has 1000x more downloads. No hardcoded list. |
| Threat score dial | Animated gauge (0–100) counting up after scan — screenshot-worthy reveal moment |
| Badge generator | `![Slop Check](...)` shield badge for READMEs — viral growth loop |
| Error states | Registry timeout, rate-limit 429, malformed response UI feedback |
| OG tags + favicon | `layout.tsx` meta tags for link previews |
| `output: 'export'` | Vercel static deploy config in `next.config.ts` |
