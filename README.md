# Slop Check

**Scan AI-generated dependency manifests for hallucinated, malicious, and vulnerable packages — entirely in your browser.**

Slop Check was built to address a real and growing attack vector: AI coding assistants hallucinate package names, and threat actors register those names on public registries within hours — pre-loaded with malicious install scripts. Slop Check audits every package in your manifest before a single byte executes.

---

## What It Does

Paste any dependency manifest and Slop Check checks every package across five ecosystems in seconds:

- **Hallucination / nonexistent** — package doesn't exist on the registry at all
- **Typosquatting signals** — newly registered, suspiciously low downloads
- **Malicious install scripts** — postinstall scripts containing `curl`, `wget`, `eval`, `exec`, `fetch`
- **Recently registered** — package created less than 30 days ago
- **Low downloads** — npm < 500/month, PyPI < 200/month
- **Outdated / low adoption** — latest version has very few installs
- **Known CVEs** — cross-referenced against the OSV vulnerability database

All checks run client-side. No manifest is sent to any server.

---

## Supported Formats

| Format | Ecosystem | Status |
|---|---|---|
| `package.json` | npm | Live |
| `requirements.txt` | PyPI | Live |
| `pyproject.toml` | PyPI | Live |
| `Cargo.toml` | Cargo (Rust) | Live |
| `go.mod` | Go | Live |
| `Gemfile` | RubyGems | Live |

---

## How It Works

```
Paste manifest
      │
      ▼
Auto-detect ecosystem
      │
      ▼
Parse packages (name + version)
      │
      ▼
Batch registry checks (10 at a time, 100ms between batches)
      │
      ├── npm registry + downloads API
      ├── PyPI JSON + pypistats
      ├── crates.io API
      ├── Go module proxy
      └── RubyGems API
      │
      ▼
Stream results to UI as they resolve
      │
      ▼
Non-blocking CVE pass via OSV.dev (parallel, after registry checks)
      │
      ▼
Risk-ranked results table + 4-chart dashboard
```

Every HTTP request is logged in the **Network Trail** — you can see exactly which registry was hit, the response status, timing, and whether the result came from cache.

---

## Public APIs Used

All APIs are free, require no authentication, and are CORS-enabled.

| API | Purpose |
|---|---|
| `registry.npmjs.org/{pkg}` | npm package existence, version history, install scripts |
| `api.npmjs.org/downloads/point/last-month/{pkg}` | npm monthly download count |
| `pypi.org/pypi/{pkg}/json` | PyPI package existence and metadata |
| `pypistats.org/api/packages/{pkg}/recent` | PyPI recent download count |
| `rubygems.org/api/v1/gems/{name}.json` | RubyGems existence and download count |
| `proxy.golang.org/{module}/@v/list` | Go module existence and version list |
| `crates.io/api/v1/crates/{name}` | Cargo crate existence and download count |
| `api.osv.dev/v1/query` | CVE lookup via OSV vulnerability database |
| `services.nvd.nist.gov/rest/json/cves/2.0` | Recent critical CVEs for the threat intel feed |
| `hn.algolia.com/api/v1/search_by_date` | Latest security news from Hacker News |

---

## Tech Stack

- **Next.js 16** — App Router, file-based routing, `sitemap.ts`
- **React 19** — streaming UI updates, `startTransition` for non-blocking state
- **TypeScript** — strict mode throughout
- **Tailwind CSS v4** — utility classes, no component library
- **lz-string** — LZ compression for shareable report URLs
- **JetBrains Mono** — monospace font via Google Fonts

No backend. No database. No API proxy. Everything runs in the browser.

---

## Features

- **Streaming results** — each package result appears the moment its registry check resolves, no waiting for the full scan
- **4-chart dashboard** — severity ring, CVE exposure ring, risk scatter plot, age distribution — all cross-filterable by clicking
- **Network Trail** — collapsible log of every HTTP request made during the scan, with clickable URLs, status codes, and timing
- **Share via URL** — scan results compressed and encoded into a URL hash via lz-string; shareable link reconstructed on load
- **CVE deep-links** — each CVE links directly to NVD and OSV detail pages
- **Live threat intel** — security news feed pulling recent critical CVEs (NVD) and breach/incident stories (Hacker News), shown above the scanner
- **Per-package result cache** — rescan with dev dependencies toggled reuses all prior results instantly
- **Network meter** — live online/offline indicator in the nav bar
- **Export** — download results as JSON or plain text

---

## Running Locally

```bash
git clone https://github.com/Bhavye2003Developer/Slopcheck.git
cd Slopcheck
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run lint    # ESLint
```

---

## Built With

This project was built with **[Claude Code](https://claude.ai/code)** by Anthropic — an agentic coding tool that writes, edits, and ships code through natural conversation.

---

## License

MIT
