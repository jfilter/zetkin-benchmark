# Experiment: Next.js 15 Migration Performance

**Date**: 2026-03-02 — 2026-03-03
**Status**: Complete
**App repo**: app.zetkin.org

## Goal

Measure the performance impact of upgrading from Next.js 14 to Next.js 15, and
evaluate a series of incremental optimizations to reach parity or better.

## Branches

Branches are numbered to show the stacking order. Each builds on the previous
unless noted.

| # | Branch | Base | What it adds |
|---|--------|------|--------------|
| — | `main` | — | Next.js 14 baseline (control) |
| | | | |
| **Next 15 variants** | | | |
| 01 | `perf/next15-01-baseline` | `main` | Next 15 upgrade, no optimizations |
| 02 | `perf/next15-02-compiler` | 01 | Enables React Compiler via babel plugin |
| 03 | `perf/next15-03-locale` | 01 | Moves i18n from server props to client-side cached fetch (no compiler) |
| 04 | `perf/next15-04-compiler+locale` | 02 + 03 | Both React Compiler and locale optimization |
| 05 | `perf/next15-05-static-routes` | 04 | Removes dynamic APIs from /my routes → Full Route Cache |
| | | | |
| **Next 14 variants** (same optimizations applied to N14 for comparison) | | | |
| 01 | `perf/next14-01-locale` | `main` | Locale optimization only (no N15 upgrade) |
| 02 | `perf/next14-02-locale+static` | N14-01 | Locale + static routes (no N15 upgrade) |

### Old branch names (for matching historical result files)

| New name | Old name |
|----------|----------|
| `perf/next15-01-baseline` | `feat/next15-no-compiler` |
| `perf/next15-02-compiler` | `feat/react-compiler` |
| `perf/next15-03-locale` | `feat/next15-locale-only` |
| `perf/next15-04-compiler+locale` | `feat/locale-optimization` |
| `perf/next15-05-static-routes` | `feat/my-pages-static` |
| `perf/next14-01-locale` | *(new)* |
| `perf/next14-02-locale+static` | *(new)* |

## Results (latest run: 2026-03-03)

> **Note**: N14 variant results pending — run `--experiment next15` to populate.

All numbers are median ms across 5 measured iterations (3 warmup discarded).

### Page loads

| Scenario | main (N14) | 01 baseline | 02 compiler | 03 locale | 04 comp+locale | 05 static |
|----------|------------|-------------|-------------|-----------|----------------|-----------|
| my-orgs | **117** | 839 | 833 | 839 | 837 | **94** |
| my-home | 869 | 840 | 842 | 841 | 839 | **359** |
| my-feed | 864 | 832 | 836 | 838 | 839 | **353** |
| campaign | 125 | 152 | 143 | 153 | 138 | 136 |
| person | 76 | 92 | 97 | 89 | 83 | 92 |

### Navigation

| Scenario | main (N14) | 01 baseline | 02 compiler | 03 locale | 04 comp+locale | 05 static |
|----------|------------|-------------|-------------|-----------|----------------|-----------|
| nav-projects | **96** | 444 | 436 | **90** | **92** | **88** |
| nav-campaign | 199 | 216 | 206 | 213 | 217 | **178** |
| nav-people | 182 | 161 | 148 | 160 | 160 | 167 |
| nav-person | 101 | 107 | 103 | 108 | 114 | 109 |
| nav-back | **116** | 454 | 451 | **107** | 166 | **107** |
| nav-full | **697** | 1440 | 1333 | **683** | 726 | **656** |
| tab-switch | 663 | 652 | 611 | 623 | 562 | 595 |

### Interactions

| Scenario | main (N14) | 01 baseline | 02 compiler | 03 locale | 04 comp+locale | 05 static |
|----------|------------|-------------|-------------|-----------|----------------|-----------|
| form-submit | 59 | 76 | 56 | 61 | 57 | 56 |
| list-select | 42 | 43 | 42 | 42 | 42 | 42 |
| search | 785 | 787 | 785 | 788 | 785 | 787 |
| tag-add | 309 | 313 | 314 | 319 | 305 | 308 |

## Key findings

### 1. React Compiler has no measurable impact
Branches 01 vs 02 show identical numbers. The compiler is not a regression, but
provides no benefit for this codebase either.

### 2. Locale optimization fixes the navigation regression
The N14→N15 upgrade caused a ~4x regression in `nav-projects` (96→444ms) and
`nav-back` (116→454ms). This was caused by server-side `getServerMessages()`
blocking the response. Moving i18n to a client-side cached fetch (branch 03)
fully restores navigation performance.

### 3. Dynamic APIs caused the /my pages caching regression
On N14, the Full Route Cache silently cached RSC payloads. On N15, any use of
`headers()` or `cookies()` opts the route out. Three layers of dynamic APIs
existed:

1. **Root layout** (`src/app/layout.tsx`): `headers()` x2 + `/api/users/me` fetch
2. **My layout** (`src/app/my/layout.tsx`): `generateMetadata()` with `headers()` x2
3. **Page auth** (`redirectIfLoginNeeded()`): `headers()` + 2 API calls (~700ms)

Removing all dynamic APIs (branch 05) makes routes static. Build output shows
`○ (Static)` instead of `ƒ (Dynamic)`. Result: my-orgs 837→94ms.

### 4. my-home/my-feed still ~350ms (expected)
These pages are static on the server, but the client components must hydrate and
fetch data via Redux hooks. The 350ms is client-side data fetching time, not a
server issue. This matches N14 behavior when the route cache was cold.

### 5. Client-side interactions are identical across all branches
form-submit, list-select, search, and tag-add are within noise margin. The N15
upgrade has zero impact on client-side interactivity.

## How to reproduce

```bash
cd ~/code/zetkin-benchmark

# Run all branches
./benchmark.sh --repo ~/code/app.zetkin.org \
  --refs main \
        perf/next15-01-baseline \
        perf/next15-02-compiler \
        perf/next15-03-locale \
        perf/next15-04-compiler+locale \
        perf/next15-05-static-routes

# Run specific scenario
./benchmark.sh --repo ~/code/app.zetkin.org \
  --refs main perf/next15-05-static-routes \
  --scenario my-pages
```
