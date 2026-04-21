# Slop Check — Build Progress

Ordered by dependency: foundation → logic → UI → integration.

---

## Phase 1 — Foundation ✅

- [x] Replace default font in `app/layout.tsx` with JetBrains Mono (Google Fonts), update metadata (title, description)
- [x] Set up `app/globals.css`: CSS variables for color palette (`#0a0a0a` bg, `#ff4444` critical, `#ffaa00` warning, `#22ff88` clean), scanline overlay keyframe, staggered fade-in keyframe, base `body` styles (bg, color, font)
- [x] Create `lib/types.ts` with `Ecosystem`, `FlagType`, `ParsedPackage`, `ScanResult`, `NetworkEvent`, `NetworkLogger` types

---

## Phase 2 — Parsers (`lib/parsers/`) ✅

- [x] `parsePackageJson.ts` — parse `dependencies` + optional `devDependencies`; marks each with `isDev: boolean`; strip `^~>=`
- [x] `parseRequirementsTxt.ts` — skip `#` comments/blank lines; strip `==`, `>=`, `~=`, `!=`; handle extras like `flask[async]`
- [x] `parsePyprojectToml.ts` — extract `[project].dependencies` and `[tool.poetry.dependencies]`
- [x] `parseGemfile.ts` — extract `gem 'name'` lines, skip `source`/`ruby` lines
- [x] `parseGoMod.ts` — extract `require` block lines (rewritten without RegExp exec method to avoid security hook false positive)
- [x] `parseCargoToml.ts` — extract `[dependencies]` keys; handles `name = "1.0"` and `name = { version = "1.0", ... }` forms
- [x] `lib/parsers/index.ts` — auto-detect ecosystem from content heuristics; `ECOSYSTEM_META` record; `detectAndParse(content, hint, includeDevDeps)`

---

## Phase 3 — Checkers (`lib/checkers/`) ✅

- [x] `checkNpm.ts` — registry + downloads API; flags: nonexistent, recently_registered, low_downloads (<500/mo), suspicious_script (curl/wget/eval/exec/fetch in postinstall), outdated, low_adoption_latest (latest <14 days old)
- [x] `checkPypi.ts` — pypi.org/pypi/{pkg}/json + pypistats per-package; same flag set; outdated uses latest release upload_time as adoption proxy
- [x] `checkRubyGems.ts` — rubygems.org/api/v1/gems/{name}.json; checks existence, age, total downloads, version currency
- [x] `checkGo.ts` — proxy.golang.org/{module}/@v/list + .info endpoint; checks existence, age of first version, outdated version
- [x] `checkCargo.ts` — crates.io/api/v1/crates/{name}; checks existence, age, recent_downloads (<500), outdated/low_adoption_latest
- [x] `lib/checkers/index.ts` — routes by ecosystem: npm → checkNpm, pypi → checkPypi, rubygems → checkRubyGems, go → checkGo, cargo → checkCargo
- [x] `lib/cache.ts` — in-memory per-package cache (`Map<"ecosystem::name", ScanResult>`); devDeps scan reuses normal scan results automatically
- [x] `lib/scanner.ts` — `runScan(packages, { onResult, onNetworkEvent })`; batches 10 packages with 100ms delay; fires `onResult` per package (streaming); checks cache before fetching

---

## Phase 4 — Static UI Components ✅

- [x] `components/Nav.tsx` — sticky, transparent→bordered on scroll; mobile hamburger (☰ MENU / ✕ CLOSE); responsive
- [x] `components/Ticker.tsx` — CSS infinite marquee; hidden on mobile
- [x] `components/ScanReceipt.tsx` — terminal-box hero mock card
- [x] `components/Hero.tsx` — badge row, headline, CTA buttons, ScanReceipt, Ticker
- [x] `components/ProblemSection.tsx` — two-column layout with `LiveStats` real-time stats
- [x] `components/LiveStats.tsx` — fetches live data: npm CLI downloads (api.npmjs.org), PyPI top-10 package downloads (pypistats per-package sum), npm bulk downloads for 15 core packages; null stats hidden (no placeholder dashes)
- [x] `components/ChecksGrid.tsx` — 5 check cards in 3-col grid; 5th card gets `lg:col-span-2` to prevent empty 6th cell
- [x] `components/HowItWorks.tsx` — three-step PASTE / SCAN / REVIEW layout
- [x] `components/Faq.tsx` — accordion; 5 questions; open/close via local state
- [x] `components/Footer.tsx` — tagline and GitHub link
- [x] `components/AnimatedSection.tsx` — IntersectionObserver-based fade-in + slide-up; fires once on enter; wraps all page sections

---

## Phase 5 — Scanner UI Components ✅

- [x] `components/scanner/ScanInput.tsx` — textarea, format dropdown (AUTO-DETECT + npm/pypi/rubygems/go/cargo), `DETECTED: {file} — {label}` green badge on auto-detect, devDeps toggle (default: on), SCAN button
- [x] `components/scanner/ScanProgress.tsx` — live progress bar `SCANNING · N / M ████░░ X%`
- [x] `components/scanner/ResultsTable.tsx` — streams results live as they resolve; groups DEPENDENCIES / DEV DEPENDENCIES; per-flag labels; metadata pills (FILE, LATEST, DL, UPDATED, CREATED); staggered fade-in; export JSON + TXT (bright text)
- [x] `components/scanner/NetworkTrail.tsx` — collapsible per-request log: CACHE / status / package / label / URL / ms

---

## Phase 6 — Wire Up ✅

- [x] `app/page.tsx` — full section composition; all sections wrapped in `AnimatedSection`
- [x] `components/ScannerSection.tsx` — manages loading/progress/results/networkEvents state; calls `runScan`; renders ScanInput → ScanProgress → ResultsTable → NetworkTrail
- [x] Anchor `id` on each section for nav scroll links
- [x] `scroll-behavior: smooth` on `html` element
- [x] Staggered fade-in on ResultsTable rows (animationDelay capped at 400ms)
- [x] Global scrollbar hidden (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`)

---

## Phase 7 — Polish & Ship (In Progress)

- [x] Scanline overlay texture on hero section (CSS pseudo-element)
- [x] Responsive layout — mobile/tablet/desktop verified
- [x] Export JSON and TXT from ResultsTable
- [x] `--muted` lightened from `#555` to `#999` for readability across all muted text
- [x] Section entrance animations (IntersectionObserver, no layout jank)
- [ ] Error states: registry timeout, rate-limit 429, malformed response
- [ ] `next.config.ts` `output: 'export'` for Vercel static deploy
- [ ] OG tags, description, favicon in `layout.tsx`

---

## Extra (Beyond Design Doc)

| Feature | Detail |
|---|---|
| Streaming results | `onResult` fires per-package; UI updates live without waiting for full scan |
| Network trail | Transparent per-request log with URL, status, timing, cache hits |
| Per-package cache | `lib/cache.ts` — second scan with devDeps reuses all prior results automatically |
| Dev/prod separation | `isDev` flag on `ParsedPackage`; ResultsTable groups DEPENDENCIES vs DEV DEPENDENCIES |
| Outdated + low adoption | Two extra flag types: `outdated` and `low_adoption_latest` |
| Live stats | Real data fetched client-side from public APIs — no hardcoded numbers |
| RubyGems checker | Full checks via rubygems.org public API |
| Go checker | Existence + version via Go proxy (proxy.golang.org) |
| Cargo checker | Full checks via crates.io API including recent_downloads |
| Auto-detect badge | DETECTED manifest type shown in scan input on paste |
| AnimatedSection | IntersectionObserver fade-in on all sections; no animation library needed |
| ChecksGrid fix | 5th card spans 2 cols on desktop to eliminate empty 6th cell |
