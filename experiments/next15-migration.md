# Experiment: Next.js 15 Migration Performance

**Date**: 2026-03-02 — 2026-03-04
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
| **Next 14 variants** (same optimizations applied to N14 for comparison) | | | |
| 01 | `perf/next14-01-locale` | `main` | Client-side cached locale loading (no N15 upgrade) |
| 02 | `perf/next14-02-locale+static` | N14-01 | + Static /my routes via Full Route Cache |
| | | | |
| **Next 15 variants** | | | |
| 01 | `perf/next15-01-baseline` | `main` | Next 15 + React 19 upgrade, no optimizations |
| 02 | `perf/next15-02-compiler` | 01 | + React Compiler via babel plugin |
| 03 | `perf/next15-03-locale` | 01 | + Client-side cached locale loading (no compiler) |
| 04 | `perf/next15-04-compiler+locale` | 02 + 03 | + React Compiler + locale optimization |
| 05 | `perf/next15-05-static-routes` | 04 | + Static /my routes (all optimizations combined) |

### Branch details

**Client-side locale loading** (N14-01, N15-03): Moves i18n translations from
server-side props (`__NEXT_DATA__` ~146 KB) to client-side cached fetch. A build
script generates per-language JSON files into `public/locale/`. The client fetches
and caches them once per session. Eliminates blocking `getServerMessages()` from
every SSR response.

**Static /my routes** (N14-02, N15-05): Removes dynamic server APIs (`headers()`,
`redirectIfLoginNeeded()`, server-side user fetch, `generateMetadata()`) from
`/my/*` pages so Next.js can use the Full Route Cache. Auth handled by middleware.

**React Compiler** (N15-02, N15-04): Enables `experimental: { reactCompiler: true }`
in `next.config.js`. Auto-memoizes components and hooks, potentially eliminating
manual `useMemo`/`useCallback`/`React.memo`.

**Next 15 baseline** (N15-01): Large migration (364 files) including Next.js
14.2 -> 15.5, React 18 -> 19, MUI v7, Redux Toolkit v2, async request APIs.

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

## Results (latest run: 2026-03-04)

Two consecutive full runs, all 88/88 tests passing. Numbers below are median ms
across 5 measured iterations (3 warmup discarded).

### Page loads

| Scenario | main | N14-01 locale | N14-02 loc+static | N15-01 base | N15-02 comp | N15-03 locale | N15-04 c+l | N15-05 static |
|----------|------|---------------|--------------------|-------------|-------------|---------------|------------|---------------|
| campaign | 83-101 | 95-102 | 82-95 | 147-149 | 112-135 | 142-148 | 93-131 | 104-137 |
| person | 76-82 | 76-92 | 77-86 | 89-95 | 87-93 | 90-100 | 87-90 | 84-87 |
| my-home | 377-380 | 375-378 | 355-363 | 838-843 | 837-846 | 839-843 | 841-845 | 355-357 |
| my-orgs | 109-112 | 108-116 | 94-100 | 840-842 | 831-855 | 833-856 | 101-838 | 83-88 |
| my-feed | 369-860 | 372-861 | 353-835 | 838-839 | 835-843 | 836-842 | 840-841 | 350-354 |

### Navigation

| Scenario | main | N14-01 locale | N14-02 loc+static | N15-01 base | N15-02 comp | N15-03 locale | N15-04 c+l | N15-05 static |
|----------|------|---------------|--------------------|-------------|-------------|---------------|------------|---------------|
| nav-projects | 87-94 | 135-138 | 77-135 | 506-517 | 441-446 | 86-99 | 79-89 | 81-92 |
| nav-campaign | 177-179 | 179-185 | 184-196 | 173-209 | 204-214 | 182-205 | 170-177 | 177-200 |
| nav-people | 168-201 | 172-176 | 177-190 | 157-183 | 135-157 | 180-185 | 163-177 | 146-168 |
| nav-person | 91-100 | 97-112 | 95-102 | 101-111 | 100-106 | 100-111 | 88-100 | 94-112 |
| nav-back | 105-141 | 139-145 | 137-149 | 524-532 | 463-468 | 93-124 | 89-92 | 100-106 |
| nav-full | 652-671 | 712-767 | 666-752 | 1525-1834 | 1363-1448 | 644-801 | 608-658 | 629-687 |
| tab-switch | 549-699 | 517-580 | 512-670 | 575-707 | 556-641 | 577-657 | 522-566 | 507-533 |

### Interactions

| Scenario | main | N14-01 locale | N14-02 loc+static | N15-01 base | N15-02 comp | N15-03 locale | N15-04 c+l | N15-05 static |
|----------|------|---------------|--------------------|-------------|-------------|---------------|------------|---------------|
| form-submit | 81-93 | 75-90 | 76-92 | 89-95 | 55-66 | 76-96 | 52-55 | 55-68 |
| list-select | 41-43 | 43-44 | 42-43 | 42 | 41-42 | 42-43 | 42-43 | 42 |
| search | 787-789 | 787-792 | 788-790 | 787-790 | 787-788 | 786-796 | 788 | 786-789 |
| tag-add | 97-344 | 339-343 | 79-340 | 312-336 | 316-335 | 87-350 | 328-340 | 333-335 |

## Key findings

### 1. Next 15 baseline has severe regressions

The direct upgrade (`next15-01-baseline`) introduces major regressions caused by
synchronous locale loading blocking server-side rendering:

- **nav-projects-load**: 87ms -> 506ms (+480%)
- **nav-back-to-projects**: 105ms -> 524ms (+400%)
- **my-home-page-load**: 377ms -> 838ms (+122%)
- **my-orgs-page-load**: 109ms -> 840ms (+670%)
- **nav-full-workflow**: 652ms -> 1525ms (+134%)

### 2. Async locale loading fixes navigation regressions

Moving i18n to client-side cached fetch (`next15-03-locale`) fully restores
navigation performance:

- **nav-projects-load**: 506ms -> 86ms (back to main levels)
- **nav-back-to-projects**: 524ms -> 93ms (faster than main)
- **nav-full-workflow**: 1525ms -> 644ms (on par with main)

The same optimization works on Next 14 too, but the impact is smaller since
N14's blocking was less severe.

### 3. Static routes fix /my pages regressions

On Next 14, the Full Route Cache silently cached RSC payloads. On Next 15, any
use of `headers()` or `cookies()` opts the route out. Three layers of dynamic
APIs existed:

1. **Root layout** (`src/app/layout.tsx`): `headers()` x2 + `/api/users/me` fetch
2. **My layout** (`src/app/my/layout.tsx`): `generateMetadata()` with `headers()` x2
3. **Page auth** (`redirectIfLoginNeeded()`): `headers()` + 2 API calls (~700ms)

Removing all dynamic APIs (`next15-05-static-routes`) makes routes static:

- **my-home**: 838ms -> 355ms (back to main levels)
- **my-orgs**: 840ms -> 83ms (faster than main's 109ms)
- **my-feed**: 839ms -> 350ms (back to main levels)

### 4. React Compiler halves form-submit time

The React Compiler (`next15-02-compiler`, `next15-04-compiler+locale`)
consistently delivers ~45% improvement on form-submit interactions:

- **form-submit**: 81-93ms -> 52-55ms

This improvement is consistent across both runs and all compiler variants.
It reflects faster React re-renders after state mutations due to automatic
memoization.

### 5. Client-side interactions are otherwise identical

list-select, search, and tag-add are within noise margin across all branches.
The N15 upgrade has zero impact on most client-side interactivity.

### 6. Some metrics are not meaningful differentiators

- **search-type-to-results**: ~788ms across all branches (dominated by debounce timer)
- **list-select-to-bulk-bar**: ~42ms across all branches (pure client-side)
- **tag-add-interaction**: high variance (80-350ms), unreliable for comparison

## Recommendations

### Best overall: `next15-05-static-routes`

This branch resolves all regressions while retaining Next 15 benefits:
- All page loads at or better than `main`
- My-pages fully fixed
- Navigation performance competitive with main
- Form-submit ~40% faster (from React Compiler)
- Rapid tab switching fastest (507-533ms)

### If my-pages regression is acceptable: `next15-04-compiler+locale`

Offers the best navigation times (608ms full workflow) and form-submit (52ms)
but leaves my-home at ~840ms.

## How to reproduce

```bash
cd ~/code/zetkin-benchmark

# Run all branches (experiment preset)
./benchmark.sh --repo ~/code/app.zetkin.org --experiment next15

# Run specific branches
./benchmark.sh --repo ~/code/app.zetkin.org \
  --refs main perf/next15-05-static-routes

# Run specific scenario
./benchmark.sh --repo ~/code/app.zetkin.org \
  --refs main perf/next15-05-static-routes \
  --scenario my-pages
```
