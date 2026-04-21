# Slop Check — Build Progress

Ordered by dependency: foundation → logic → UI → integration.

---

## Phase 1 — Foundation

- [x] Replace default font in `app/layout.tsx` with JetBrains Mono (Google Fonts), update metadata (title, description)
- [x] Set up `app/globals.css`: CSS variables for color palette (`#0a0a0a` bg, `#ff4444` critical, `#ffaa00` warning, `#22ff88` clean), scanline overlay keyframe, staggered fade-in keyframe, base `body` styles (bg, color, font)
- [x] Create `lib/types.ts` with `Ecosystem`, `FlagType`, `ParsedPackage`, `ScanResult` types (exact shapes from design doc §4.3)

---

## Phase 2 — Parsers (`lib/parsers/`)

- [x] `parsePackageJson.ts` — parse `dependencies` (and optionally `devDependencies`) into `ParsedPackage[]`; strip `^~>=` from versions
- [x] `parseRequirementsTxt.ts` — skip `#` comments and blank lines; strip `==`, `>=`, `~=`, `!=` pins; handle extras like `flask[async]`
- [x] `parsePyprojectToml.ts` — extract `[project].dependencies` and `[tool.poetry.dependencies]` arrays
- [x] `parseGemfile.ts` — extract `gem 'name'` lines, skip `source`/`ruby` lines (stub: no registry check in v1)
- [x] `parseGoMod.ts` — extract `require` block lines (stub: no registry check in v1)
- [x] `parseCargoToml.ts` — extract `[dependencies]` keys (stub: no registry check in v1)
- [x] `lib/parsers/index.ts` — auto-detect ecosystem from content heuristics; export `detectAndParse(content, hint?) → ParsedPackage[]`

---

## Phase 3 — Checkers (`lib/checkers/`)

- [x] `checkNpm.ts` — fetch `registry.npmjs.org/{pkg}` + downloads API; return `ScanResult` with exists/createdAt/monthlyDownloads/postInstall flags
- [x] `checkPypi.ts` — fetch `pypi.org/pypi/{pkg}/json` + pypistats downloads; return `ScanResult` with same shape
- [x] `lib/checkers/index.ts` — `checkPackage(pkg: ParsedPackage): Promise<ScanResult>`; route by ecosystem; return "coming soon" result for rubygems/go/cargo
- [x] `lib/scanner.ts` — `runScan(packages: ParsedPackage[], onProgress): Promise<ScanResult[]>`; batch 10 at a time with 100ms delay; call `onProgress(done, total)` per batch; sort results by severity on completion

---

## Phase 4 — Static UI Components

- [x] `components/Nav.tsx` — sticky, transparent→bordered on scroll, wordmark "SLOPCHECK." left, anchor links `[01]–[04]` + GitHub right
- [x] `components/Ticker.tsx` — CSS `marquee` / `animation: scroll` infinite loop; accepts `items: string[]`; hidden on mobile
- [x] `components/ScanReceipt.tsx` — static terminal-box card with hardcoded fake scan data (design doc hero mock)
- [x] `components/Hero.tsx` — status badge row, headline, subhead, CTA buttons, `<ScanReceipt />`, `<Ticker />` below
- [x] `components/ProblemSection.tsx` — `[01]` two-column layout; three large stat numbers (19.7%, ~20MIN, 30,000+) with labels
- [x] `components/ChecksGrid.tsx` — `[02]` responsive card grid; 4 check cards (nonexistent, newly registered, low downloads, post-install, legit)
- [x] `components/HowItWorks.tsx` — `[03]` three-step horizontal layout (PASTE / SCAN / REVIEW)
- [x] `components/Faq.tsx` — `[04]` accordion; 5 questions from design doc; open/close via local state
- [x] `components/Footer.tsx` — single footer block with tagline and GitHub link

---

## Phase 5 — Scanner UI Components

- [ ] `components/scanner/ScanInput.tsx` — textarea paste area, format dropdown (auto-detect + manual override), devDependencies toggle, SCAN button; controlled component; emits `onScan(content, ecosystem)`
- [ ] `components/scanner/ScanProgress.tsx` — progress bar with `SCANNING · N / M packages checked ████░░ X%`; accepts `done` and `total` props
- [ ] `components/scanner/ResultsTable.tsx` — table with columns: Package · Status · Reason · Registry Link; sorted by severity (critical → high → medium → clean); summary line (`N critical · N warnings · N clean`); export JSON and plain text buttons

---

## Phase 6 — Wire Up

- [ ] Create `app/page.tsx` — compose all section components in order: `<Nav>`, `<Hero>` (with embedded scanner or scroll-to), `<ProblemSection>`, `<ChecksGrid>`, `<HowItWorks>`, `<Faq>`, `<Footer>`
- [ ] Embed scanner in page — place `<ScanInput>` + `<ScanProgress>` + `<ResultsTable>` between Hero and Problem (or as a full-width section); wire `onScan` → `runScan` → state → render results
- [ ] Add `id` anchors to each section so nav links scroll correctly
- [ ] Add staggered fade-in animation to `ResultsTable` rows on results load

---

## Phase 7 — Polish & Ship

- [ ] Add scanline overlay texture to hero section via CSS pseudo-element
- [ ] Responsive pass: verify mobile (single column, ticker hidden), tablet (two-column grid), desktop (full layout)
- [ ] Export functionality: JSON download and plain-text download from `ResultsTable`
- [ ] Handle error states in checkers: registry timeout, rate-limit 429, malformed response
- [ ] Update `next.config.ts` with `output: 'export'` for Vercel static deploy
- [ ] Replace placeholder metadata in `layout.tsx` (OG tags, description, favicon)
