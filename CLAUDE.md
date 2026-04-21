# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # eslint
```

No test suite yet.

## Project

**Slop Check** — browser-based tool that scans AI-generated dependency manifests for hallucinated/malicious packages. All registry checks run client-side (no server proxy). Supports npm + PyPI in v1; parsers for RubyGems/Go/Cargo planned but registry checks are "coming soon."

Stack: Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4 · no animation libraries.

## Planned Architecture

The design doc (`slopcheck-design-doc-1.md`) defines the full structure. Key modules not yet built:

- `components/scanner/` — `ScanInput`, `ScanProgress`, `ResultsTable`
- `lib/parsers/` — one file per ecosystem (parsePackageJson, parseRequirementsTxt, etc.)
- `lib/checkers/` — `checkNpm.ts`, `checkPypi.ts`
- `lib/types.ts` — shared `ParsedPackage`, `ScanResult`, `FlagType` types

## Scan Flow

```
paste → auto-detect ecosystem → parse → Promise.all(checkPackage[]) → sort by severity → render
```

Registry checks order per package: existence → age → downloads → post-install scripts. Batch in groups of 10 with 100ms delay between batches to avoid 429s.

## API Endpoints (all CORS-enabled, no auth)

| Check | URL |
|---|---|
| npm existence + scripts | `https://registry.npmjs.org/{package}` |
| npm downloads | `https://api.npmjs.org/downloads/point/last-month/{package}` |
| PyPI existence | `https://pypi.org/pypi/{package}/json` |
| PyPI downloads | `https://pypistats.org/api/packages/{package}/recent` |

## Flag Thresholds

- Nonexistent: 404 → Critical
- Recently registered: created < 30 days → High
- Low downloads: npm < 500/month, PyPI < 200/month → Medium
- Suspicious post-install: script contains `curl`, `wget`, `exec`, `fetch`, `eval` → High

## UI

Dark terminal aesthetic: `#0a0a0a` bg, amber/red/green accents, JetBrains Mono throughout. Staggered fade-in on scan results. See design doc sections 3.1–3.4 for full layout spec.