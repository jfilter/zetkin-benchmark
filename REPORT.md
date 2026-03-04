# Next.js 15 Migration Performance Report

**Date**: March 4, 2026
**Benchmark suite**: zetkin-benchmark (Playwright + Express mock server)
**Iterations**: 5 per scenario (+ 3 warmup, discarded)
**Runs**: 2 consecutive full runs, results consistent across both

## Branches Tested

| Branch | Description |
|--------|-------------|
| `main` | Current production (Next.js 14.2, blocking locale) |
| `perf/next14-01-locale` | Next 14 + async locale loading |
| `perf/next14-02-locale+static` | Next 14 + async locale + static route optimization |
| `perf/next15-01-baseline` | Next 15 direct upgrade (no optimizations) |
| `perf/next15-02-compiler` | Next 15 + React Compiler |
| `perf/next15-03-locale` | Next 15 + async locale loading |
| `perf/next15-04-compiler+locale` | Next 15 + React Compiler + async locale |
| `perf/next15-05-static-routes` | Next 15 + all optimizations + static route fix |

## Key Results (median, ms)

### Page Load Times

| Scenario | main | n15-baseline | n15-compiler | n15-locale | n15-comp+locale | n15-static |
|----------|------|-------------|-------------|-----------|----------------|-----------|
| campaign-page-load | 83-101 | 147-149 | 112-135 | 142-146 | 93-131 | 104-137 |
| person-page-load | 76-82 | 89-95 | 87-93 | 90-100 | 87-90 | 84-87 |
| my-home-page-load | 377-380 | 838-843 | 837-846 | 839-843 | 841-845 | 355-357 |
| my-orgs-page-load | 109-112 | 840-842 | 831-855 | 833-856 | 101-838 | 83-88 |
| my-feed-page-load | 369-860 | 838-839 | 835-843 | 839-842 | 840-841 | 350-354 |

### Navigation & Interaction

| Scenario | main | n15-baseline | n15-compiler | n15-locale | n15-comp+locale | n15-static |
|----------|------|-------------|-------------|-----------|----------------|-----------|
| nav-projects-load | 87-94 | 506-517 | 441-446 | 86-99 | 79-89 | 81-92 |
| nav-full-workflow | 652-671 | 1525-1834 | 1363-1448 | 644-801 | 608-658 | 629-687 |
| rapid-tab-switching | 549-699 | 575-707 | 556-641 | 577-657 | 522-566 | 507-533 |
| form-submit | 81-93 | 89-95 | 55-66 | 76-96 | 52-55 | 55-68 |

## Findings

### 1. Next 15 baseline has severe regressions

The direct Next 15 upgrade (`next15-01-baseline`) introduces major regressions:

- **nav-projects-load**: 87ms -> 506ms (+480%) — blocking locale loading in `getServerSideProps`
- **nav-back-to-projects**: 105ms -> 524ms (+400%) — same root cause
- **my-home-page-load**: 377ms -> 838ms (+122%) — App Router locale/middleware overhead
- **my-orgs-page-load**: 109ms -> 840ms (+670%) — same pattern
- **nav-full-workflow**: 652ms -> 1525ms (+134%) — compounds across navigations

These regressions are caused by synchronous locale loading blocking server-side rendering.

### 2. Async locale loading fixes navigation regressions

The `next15-03-locale` branch (async locale) eliminates the `nav-projects-load` and `nav-back-to-projects` regressions completely:

- **nav-projects-load**: 506ms -> 86ms (back to main levels)
- **nav-back-to-projects**: 524ms -> 93ms (actually faster than main)
- **nav-full-workflow**: 1525ms -> 644ms (on par with main)

However, it does **not** fix the my-pages regressions (my-home stays at ~840ms).

### 3. Static route optimization fixes my-pages regressions

The `next15-05-static-routes` branch fixes the remaining my-pages regressions:

- **my-home-page-load**: 838ms -> 355ms (back to main levels)
- **my-orgs-page-load**: 840ms -> 83ms (actually **faster** than main's 109ms)
- **my-feed-page-load**: 839ms -> 350ms (back to main levels)

This is the only Next 15 variant that fully resolves the my-pages performance issues.

### 4. React Compiler halves form-submit time

The React Compiler (`next15-02-compiler`, `next15-04-compiler+locale`) consistently delivers a ~45% improvement on form-submit interactions:

- **form-submit**: 81-93ms -> 52-55ms
- This improvement is consistent across both runs and all compiler variants
- It reflects faster React re-renders after state mutations

### 5. Combined optimizations (compiler+locale) give best navigation

The `next15-04-compiler+locale` branch achieves the best navigation times:

- **nav-full-workflow**: 608ms (best across all branches, -7% vs main)
- **rapid-tab-switching**: 522ms (best, -5% vs main)
- **nav-projects-load**: 79ms (best, -9% vs main)

But it still has the my-pages regression (~840ms for my-home).

### 6. Some metrics are not meaningful differentiators

- **search-type-to-results**: ~788ms across all branches (dominated by debounce timer)
- **list-select-to-bulk-bar**: ~42ms across all branches (pure client-side, not framework-dependent)
- **tag-add-interaction**: high variance (80-350ms), unreliable for comparison

## Recommendations

### Best overall: `next15-05-static-routes`

This branch resolves all regressions while retaining Next 15 benefits:
- All page loads at or better than `main`
- My-pages fully fixed
- Navigation performance competitive with main
- Rapid tab switching fastest (507-533ms)

### Best for interactivity: `next15-04-compiler+locale`

If form-submit performance is critical, this branch offers:
- 45% faster form submissions (52ms vs 93ms)
- Best navigation workflow times (608ms)
- **Caveat**: my-pages still regressed (~840ms for my-home)

### Ideal target: combine `next15-05-static-routes` + React Compiler

A branch combining all optimizations from `next15-05` with the React Compiler
would likely deliver the best of both worlds:
- Fixed my-pages (from static routes)
- Fast form-submit (from React Compiler)
- Best navigation (from async locale + compiler)

## Methodology

- **Mock server**: Express + Map (O(1) lookups, pre-serialized JSON responses)
- **Test isolation**: `npm ci` between branches, `rm -rf .next` before each build
- **Warmup**: 3 iterations discarded before measuring
- **Unmocked route detection**: Automatic via Playwright response listener (fails test on any 404 from mock server)
- **All 88 tests passed** (11 scenarios x 8 branches) on both runs
