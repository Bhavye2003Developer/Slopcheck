# SLOP CHECK — Design Document
**Version:** 0.1  
**Status:** Pre-build  
**Stack:** Next.js 15 · TypeScript · Client-side only

---

## 1. Product Overview

**Slop Check** is a free, no-account, browser-based tool that scans AI-generated dependency files for hallucinated, suspicious, or malicious packages.

Paste a `package.json`, `requirements.txt`, or any supported manifest. Slop Check hits the public npm and PyPI registries directly from your browser and returns a risk-ranked report in seconds.

### Problem Statement

AI coding assistants hallucinate package names at a rate of ~20% across all models. Attackers monitor these hallucinations, register the invented names on npm/PyPI, and wait. Every `npm install` from an AI-generated file is a potential supply chain attack.

Existing tools (Snyk, Socket.dev, Aikido) solve this — but require an account, a connected repo, and a CI/CD pipeline. There is no tool that does this in a single browser tab with zero setup.

That is what Slop Check is.

### Target Users

- Solo developers and vibe coders using Cursor, Bolt, Lovable, Claude Code
- Developers reviewing AI-generated PRs
- Security-conscious engineers who want a fast gut-check before installing

### Non-Goals

- Not a full SCA (Software Composition Analysis) platform
- Not a CVE scanner
- Not a CI/CD integration (v1)
- Not a code scanner — only manifest files

---

## 2. Feature Spec

### 2.1 Supported File Formats

| File | Ecosystem |
|---|---|
| `package.json` | npm (Node.js) |
| `requirements.txt` | PyPI (Python) |
| `pyproject.toml` | PyPI (Python) |
| `Gemfile` | RubyGems |
| `go.mod` | Go modules |
| `Cargo.toml` | Rust (crates.io) |

### 2.2 Checks Performed

**Per package, in order of severity:**

| Flag | Condition | Severity |
|---|---|---|
| ❌ Nonexistent | Package not found on registry (404) | Critical |
| ⚠️ Recently registered | Created < 30 days ago | High |
| ⚠️ Low downloads | Below ecosystem threshold (npm: <500/month, PyPI: <200/month) | Medium |
| ⚠️ Suspicious post-install | `scripts.postinstall` contains `curl`, `wget`, `exec`, `fetch`, `eval` | High |
| ✅ Legit | Passes all checks | Clear |

> **Note on typosquats:** Dropped as an explicit check in v1. The nonexistent + low downloads + recently registered triangle already catches the vast majority of slopsquat attacks. A real typosquat that passes all three checks is indistinguishable from a legitimate low-popularity package at scan time. Revisit in v2 using the npm search API for dynamic fuzzy matching rather than a hardcoded list.

### 2.3 APIs Used

All requests made client-side. No server proxy. No auth required.

| Registry | Endpoint | Data |
|---|---|---|
| npm existence | `https://registry.npmjs.org/{package}` | exists, created date, scripts |
| npm downloads | `https://api.npmjs.org/downloads/point/last-month/{package}` | monthly downloads |
| PyPI existence | `https://pypi.org/pypi/{package}/json` | exists, upload date |
| PyPI downloads | `https://pypistats.org/api/packages/{package}/recent` | recent downloads |

All four endpoints have CORS enabled and are free with no rate-limit auth.

### 2.4 Parser Rules

- Strip version pins (`package@1.2.3` → `package`)
- Strip leading `^`, `~`, `>=`, `==`
- Handle scoped npm packages (`@org/package` → query as-is, URL-encode the `/`)
- Skip comment lines (`#` in requirements.txt)
- Skip `devDependencies` toggle (user-facing option)
- Skip empty lines and blank entries

### 2.5 Output

- Results sorted: ❌ first, then ⚠️ by severity, then ✅
- Each flagged package shows: flag type, reason, registry link, suggested alternative (where applicable)
- Summary line: `3 critical · 2 warnings · 12 clean`
- Export as JSON or plain text

---

## 3. UI/UX Spec

### 3.1 Aesthetic Direction

**Inspired by VibeEval** — brutalist dark terminal, monospace throughout, numbered sections `[01]`, `[02]`, technical metadata displayed as status badges. Diverges with:

- **Color palette:** Black background (`#0a0a0a`), with **amber/red warning accents** (`#ff4444` critical, `#ffaa00` warning, `#22ff88` clean) instead of VibeEval's neutral whites. Threat-appropriate.
- **Typography:** `JetBrains Mono` as the sole typeface. Everything monospace — headers, body, labels.
- **Texture:** Subtle scanline overlay on the hero. Faint grid lines on section backgrounds.
- **Motion:** Scan result rows reveal with a staggered fade-in, simulating a live terminal scan. Progress counter animates per-package.

### 3.2 Page Sections

#### NAV
```
SLOPCHECK.                    [01] PROBLEM  [02] CHECKS  [03] HOW  [04] FAQ    GITHUB →
```
Sticky. No logo mark — wordmark only, all caps. Borderless, transparent until scroll.

---

#### HERO

Status badge row:
```
ID/ SLC-0X1    STATUS · LIVE    PKG-CHECKS/ 5    LATENCY/ ~2S    SOURCE/ NPM × PYPI
```

Headline (large, aggressive):
```
THIS IS WHAT AI
GAVE YOU. →
```

Subhead:
```
19.7% of AI-suggested packages don't exist.
Attackers register the names. You install the malware.
Paste your manifest. Find out in 2 seconds.
```

CTA buttons:
```
[ SCAN NOW → ]    [ VIEW ON GITHUB ↗ ]
```

Below CTA — a fake scan receipt card (terminal-style):

```
┌─ SCAN RECEIPT ──────────────────────────────────────┐
│ FILE     requirements.txt                           │
│ PACKAGES 14 scanned                                 │
│ TIME     1.8s                                       │
├─────────────────────────────────────────────────────┤
│ ❌  CRITICAL   crypto-utils          NOT ON PYPI    │
│ ❌  CRITICAL   flask-helpers         NOT ON PYPI    │
│ ⚠️  HIGH       data-frame-utils      12 DAYS OLD    │
│ ⚠️  HIGH       pip-utils             43 DOWNLOADS   │
│ ✅  CLEAN      numpy                               │
│ ✅  CLEAN      flask                               │
│ ✅  CLEAN      sqlalchemy            + 8 more…     │
└─────────────────────────────────────────────────────┘
```

Scrolling ticker below hero (VibeEval-style):
```
CRYPTO-UTILS NOT FOUND · FLASK-HELPERS NOT FOUND · DATA-FRAME-UTILS 12 DAYS OLD · PIP-UTILS 43 DOWNLOADS · AI-UTILS NOT FOUND ·
```

---

#### [01] PROBLEM

Two-column layout: left is section label + headline, right is body copy.

Headline: `THE SLOPSQUATTING THREAT`

Stats displayed as large monospace numbers with labels:
```
19.7%     ~20MIN     30,000+
of AI pkgs  to register   downloads
don't exist  a fake name   huggingface-cli got
                           before takedown
```

Body: brief explanation of the hallucination → registration → install attack chain.

---

#### [02] WHAT WE CHECK

Six check types displayed as a grid of cards, each with:
- Flag icon (❌ / ⚠️ / ✅)
- Check name in caps
- One-line description
- Example

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ ❌ NONEXISTENT   │  │ ⚠️ NEWLY REGISTERED│  │ ⚠️ LOW DOWNLOADS  │
│ Package returns  │  │ Created <30 days  │  │ Below ecosystem  │
│ 404 on registry  │  │ ago               │  │ download floor   │
│ e.g. crypto-utils│  │ e.g. ml-utils-py  │  │ e.g. node-fetch2 │
└──────────────────┘  └──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐
│ ⚠️ POST-INSTALL  │  │ ✅ LEGIT          │
│ Script calls curl│  │ Exists, old      │
│ wget exec eval   │  │ enough, trusted  │
│ or remote fetch  │  │ download volume  │
└──────────────────┘  └──────────────────┘
```

---

#### [03] HOW IT WORKS

Three-step layout, numbered, horizontal on desktop:

```
01 /                    02 /                    03 /
PASTE                   SCAN                    REVIEW
Drop your               We hit npm +            Results ranked
package.json or         PyPI directly           by severity.
requirements.txt        from your browser.      Export or fix.
into the box.           No server. No logs.
```

---

#### [04] FAQ

Accordion-style. Questions in caps, answers in regular weight.

Questions:
- `DOES THIS SEND MY FILE ANYWHERE?`
- `WHAT FILE FORMATS ARE SUPPORTED?`
- `HOW IS THE DOWNLOAD THRESHOLD DETERMINED?`
- `CAN THIS CATCH MALICIOUS PACKAGES THAT DO EXIST?`
- `IS THIS OPEN SOURCE?`

---

#### FOOTER

```
SLOPCHECK · FREE · OPEN SOURCE · MIT LICENSE
NO ACCOUNT · NO SERVER · NO TRACKING

Built by [name] · GitHub →
```

---

### 3.3 Scan Input Component (Main UI)

The paste area is the core interaction. Styled as a terminal window:

```
┌─ PASTE MANIFEST ──────────────────── [package.json ▾] ──┐
│                                                          │
│  Paste contents here...                                  │
│                                                          │
│                                                          │
│                                              [ SCAN → ]  │
└──────────────────────────────────────────────────────────┘
```

- File format dropdown (auto-detected from content, overridable)
- Option: `[ ] Include devDependencies`
- `SCAN →` button triggers parallel fetches with live progress

**During scan:**
```
SCANNING · 6 / 14 packages checked ████████░░░░░░░  43%
```

**After scan:**
Results table with sortable columns: Package · Status · Reason · Registry Link

---

### 3.4 Responsive Behavior

- Mobile: single column, ticker hidden, stat cards stack vertically
- Tablet: two-column check grid
- Desktop: full three-column layouts, sticky nav, side-by-side hero

---

## 4. Tech Stack

### 4.1 Framework

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Static export capable, fast, TypeScript first |
| Language | TypeScript strict mode | Type safety on API responses and parser logic |
| Styling | Tailwind CSS v4 | Utility classes, no runtime CSS |
| Fonts | JetBrains Mono (Google Fonts) | Monospace, legible, free |
| Animations | CSS keyframes + Tailwind `animate-*` | No JS animation library needed for this scope |
| Deployment | Vercel (static export) | Free, instant, CDN |

### 4.2 Project Structure

```
slopcheck/
├── app/
│   ├── layout.tsx          # Root layout, font config, metadata
│   ├── page.tsx            # Landing page (all sections)
│   └── globals.css         # CSS variables, keyframes, base styles
├── components/
│   ├── Nav.tsx
│   ├── Hero.tsx
│   ├── ScanReceipt.tsx     # Fake receipt card in hero
│   ├── Ticker.tsx          # Scrolling marquee
│   ├── ProblemSection.tsx
│   ├── ChecksGrid.tsx
│   ├── HowItWorks.tsx
│   ├── Faq.tsx
│   ├── Footer.tsx
│   └── scanner/
│       ├── ScanInput.tsx   # Paste area + format select
│       ├── ScanProgress.tsx
│       └── ResultsTable.tsx
├── lib/
│   ├── parsers/
│   │   ├── parsePackageJson.ts
│   │   ├── parseRequirementsTxt.ts
│   │   ├── parsePyprojectToml.ts
│   │   ├── parseGemfile.ts
│   │   ├── parseGoMod.ts
│   │   └── parseCargoToml.ts
│   ├── checkers/
│   │   ├── checkNpm.ts
│   │   └── checkPypi.ts
│   └── types.ts            # Shared types: Package, ScanResult, Flag
└── public/
```

### 4.3 Key Types

```typescript
type Ecosystem = 'npm' | 'pypi' | 'rubygems' | 'go' | 'cargo';

type FlagType =
  | 'nonexistent'
  | 'recently_registered'
  | 'low_downloads'
  | 'suspicious_script'
  | 'clean';

interface ParsedPackage {
  name: string;
  version: string | null;
  ecosystem: Ecosystem;
  raw: string;
}

interface ScanResult {
  package: ParsedPackage;
  flag: FlagType;
  severity: 'critical' | 'high' | 'medium' | 'clean';
  reason: string;
  registryUrl: string;
  suggestion?: string;
  meta: {
    exists: boolean;
    createdAt?: string;
    monthlyDownloads?: number;
    hasPostInstall?: boolean;
    postInstallScript?: string;
  };
}
```

### 4.4 Scan Flow

```
user pastes content
    → auto-detect ecosystem (or user selects)
    → parse into ParsedPackage[]
    → Promise.all(packages.map(checkPackage))
        → per package: checkExistence → checkAge → checkDownloads → checkScripts
    → collect ScanResult[]
    → sort by severity
    → render ResultsTable
```

Rate limiting: batch in groups of 10 with 100ms delay between batches to avoid 429s from registries.

---

## 5. Scope

### In Scope (v1)

- Landing page with all sections
- Paste-and-scan UI
- npm + PyPI checks (existence, age, downloads, post-install scripts)
- Export as JSON / plain text
- Open source, MIT, deployed on Vercel

### Out of Scope (v1)

- RubyGems, Go, Cargo checks (parsers yes, registry checks no — show "coming soon")
- GitHub repo analysis
- CI/CD integration / GitHub Action
- Browser extension
- Accounts or saved scans
- CVE / known vulnerability checks
- Continuous monitoring
- API endpoint for programmatic access

### Possible v2

- Typosquat detection via npm search API (dynamic fuzzy match, no hardcoded list)
- GitHub Action: `slopcheck scan` in CI
- CLI: `npx slopcheck requirements.txt`
- Browser extension that intercepts copy-paste of AI-generated code
- Public API (rate-limited, free)

---
