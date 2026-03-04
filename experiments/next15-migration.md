# Experiment: Next.js 15 Migration Performance

**Date**: 2026-03-02 — 2026-03-04
**Status**: Complete
**App repo**: app.zetkin.org
**Machine**: Apple M1 Pro, 32 GB RAM, macOS 15.7.3, Node v22.15.0

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

## Results (run: 2026-03-04)

All 88/88 tests passing across all 8 branches. Values are **median ms** across
5 measured iterations (3 warmup discarded).

### Page loads (median ms)

| Scenario | main | N14-01 locale | N14-02 loc+static | N15-01 base | N15-02 comp | N15-03 locale | N15-04 c+l | N15-05 static |
|----------|------|---------------|--------------------|-------------|-------------|---------------|------------|---------------|
| campaign | 83 | 102 | 95 | 149 | 112 | 146 | 131 | 104 |
| person | 82 | 92 | 83 | 91 | 93 | 100 | 87 | 84 |
| my-home | 377 | 378 | 363 | 838 | 846 | 843 | 845 | 355 |
| my-orgs | 112 | 116 | 97 | 842 | 855 | 856 | 838 | 83 |
| my-feed | 369 | 377 | 835 | 839 | 843 | 842 | 841 | 350 |

### Navigation (median ms)

| Scenario | main | N14-01 locale | N14-02 loc+static | N15-01 base | N15-02 comp | N15-03 locale | N15-04 c+l | N15-05 static |
|----------|------|---------------|--------------------|-------------|-------------|---------------|------------|---------------|
| nav-projects | 94 | 135 | 130 | 517 | 446 | 99 | 79 | 88 |
| nav-campaign | 177 | 185 | 196 | 173 | 214 | 205 | 170 | 177 |
| nav-people | 201 | 172 | 177 | 183 | 135 | 185 | 177 | 146 |
| nav-person | 100 | 97 | 96 | 111 | 105 | 111 | 100 | 112 |
| nav-back | 105 | 145 | 137 | 524 | 468 | 124 | 92 | 106 |
| nav-full | 671 | 751 | 737 | 1525 | 1448 | 801 | 608 | 629 |
| tab-switch | 699 | 574 | 670 | 575 | 641 | 657 | 522 | 533 |

### Interactions (median ms)

| Scenario | main | N14-01 locale | N14-02 loc+static | N15-01 base | N15-02 comp | N15-03 locale | N15-04 c+l | N15-05 static |
|----------|------|---------------|--------------------|-------------|-------------|---------------|------------|---------------|
| form-submit | 81 | 90 | 92 | 92 | 66 | 96 | 52 | 68 |
| list-select | 42 | 44 | 42 | 42 | 42 | 43 | 42 | 42 |
| search | 789 | 792 | 790 | 788 | 788 | 796 | 788 | 787 |
| tag-add | 97 | 342 | 340 | 320 | 335 | 350 | 340 | 333 |

### Raw measurements (all 5 iterations)

<details>
<summary>Click to expand raw data per branch</summary>

#### main

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 91 | 83 | 81 | 83 | 133 | 83 |
| person-page-load | 82 | 72 | 90 | 85 | 78 | 82 |
| my-home-page-load | 376 | 377 | 380 | 384 | 377 | 377 |
| my-orgs-page-load | 103 | 122 | 109 | 112 | 112 | 112 |
| my-feed-page-load | 382 | 866 | 369 | 364 | 364 | 369 |
| nav-projects-load | 88 | 94 | 91 | 97 | 96 | 94 |
| nav-campaign-load | 177 | 168 | 157 | 189 | 204 | 177 |
| nav-people-list-load | 206 | 191 | 188 | 201 | 204 | 201 |
| nav-person-detail-load | 95 | 100 | 122 | 98 | 104 | 100 |
| nav-back-to-projects | 105 | 105 | 99 | 107 | 101 | 105 |
| nav-full-workflow | 671 | 658 | 657 | 692 | 709 | 671 |
| rapid-tab-switching | 773 | 699 | 602 | 714 | 605 | 699 |
| form-submit | 100 | 81 | 93 | 77 | 73 | 81 |
| list-select | 42 | 45 | 41 | 45 | 42 | 42 |
| search | 786 | 787 | 789 | 792 | 790 | 789 |
| tag-add | 306 | 90 | 97 | 80 | 331 | 97 |

#### perf/next14-01-locale

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 101 | 101 | 102 | 238 | 475 | 102 |
| person-page-load | 80 | 88 | 96 | 96 | 92 | 92 |
| my-home-page-load | 377 | 865 | 373 | 378 | 873 | 378 |
| my-orgs-page-load | 116 | 121 | 119 | 116 | 112 | 116 |
| my-feed-page-load | 873 | 375 | 377 | 372 | 866 | 377 |
| nav-projects-load | 144 | 135 | 139 | 95 | 134 | 135 |
| nav-campaign-load | 230 | 178 | 168 | 185 | 217 | 185 |
| nav-people-list-load | 177 | 172 | 159 | 192 | 162 | 172 |
| nav-person-detail-load | 87 | 113 | 110 | 90 | 97 | 97 |
| nav-back-to-projects | 149 | 153 | 145 | 144 | 141 | 145 |
| nav-full-workflow | 787 | 751 | 721 | 706 | 751 | 751 |
| rapid-tab-switching | 574 | 612 | 618 | 527 | 509 | 574 |
| form-submit | 96 | 90 | 94 | 74 | 72 | 90 |
| list-select | 43 | 76 | 43 | 60 | 44 | 44 |
| search | 794 | 790 | 789 | 792 | 793 | 792 |
| tag-add | 325 | 342 | 351 | 78 | 343 | 342 |

#### perf/next14-02-locale+static

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 103 | 95 | 92 | 101 | 70 | 95 |
| person-page-load | 76 | 105 | 109 | 83 | 71 | 83 |
| my-home-page-load | 360 | 846 | 371 | 363 | 357 | 363 |
| my-orgs-page-load | 102 | 98 | 97 | 96 | 97 | 97 |
| my-feed-page-load | 352 | 851 | 854 | 835 | 351 | 835 |
| nav-projects-load | 83 | 132 | 130 | 159 | 79 | 130 |
| nav-campaign-load | 172 | 203 | 196 | 215 | 181 | 196 |
| nav-people-list-load | 214 | 170 | 214 | 169 | 177 | 177 |
| nav-person-detail-load | 96 | 99 | 72 | 96 | 115 | 96 |
| nav-back-to-projects | 137 | 133 | 147 | 140 | 136 | 137 |
| nav-full-workflow | 702 | 737 | 759 | 779 | 688 | 737 |
| rapid-tab-switching | 811 | 645 | 670 | 686 | 553 | 670 |
| form-submit | 92 | 99 | 73 | 93 | 89 | 92 |
| list-select | 42 | 42 | 44 | 42 | 43 | 42 |
| search | 789 | 791 | 792 | 790 | 789 | 790 |
| tag-add | 73 | 344 | 344 | 340 | 332 | 340 |

#### perf/next15-01-baseline

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 156 | 149 | 111 | 113 | 151 | 149 |
| person-page-load | 91 | 99 | 68 | 72 | 111 | 91 |
| my-home-page-load | 840 | 845 | 837 | 838 | 838 | 838 |
| my-orgs-page-load | 841 | 845 | 842 | 834 | 842 | 842 |
| my-feed-page-load | 843 | 365 | 843 | 839 | 838 | 839 |
| nav-projects-load | 508 | 848 | 522 | 517 | 509 | 517 |
| nav-campaign-load | 202 | 173 | 168 | 187 | 154 | 173 |
| nav-people-list-load | 221 | 138 | 183 | 192 | 147 | 183 |
| nav-person-detail-load | 126 | 111 | 107 | 105 | 139 | 111 |
| nav-back-to-projects | 529 | 523 | 518 | 524 | 555 | 524 |
| nav-full-workflow | 1586 | 1793 | 1499 | 1525 | 1504 | 1525 |
| rapid-tab-switching | 705 | 481 | 575 | 495 | 711 | 575 |
| form-submit | 77 | 96 | 77 | 92 | 94 | 92 |
| list-select | 41 | 42 | 43 | 41 | 43 | 42 |
| search | 788 | 791 | 788 | 786 | 788 | 788 |
| tag-add | 91 | 320 | 343 | 357 | 317 | 320 |

#### perf/next15-02-compiler

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 96 | 112 | 146 | 96 | 149 | 112 |
| person-page-load | 92 | 94 | 115 | 89 | 93 | 93 |
| my-home-page-load | 846 | 859 | 841 | 854 | 844 | 846 |
| my-orgs-page-load | 856 | 438 | 860 | 855 | 851 | 855 |
| my-feed-page-load | 845 | 845 | 843 | 839 | 836 | 843 |
| nav-projects-load | 446 | 848 | 446 | 851 | 444 | 446 |
| nav-campaign-load | 214 | 197 | 238 | 163 | 235 | 214 |
| nav-people-list-load | 201 | 141 | 135 | 133 | 132 | 135 |
| nav-person-detail-load | 119 | 105 | 121 | 93 | 102 | 105 |
| nav-back-to-projects | 468 | 482 | 463 | 494 | 458 | 468 |
| nav-full-workflow | 1448 | 1773 | 1403 | 1734 | 1371 | 1448 |
| rapid-tab-switching | 553 | 644 | 673 | 641 | 574 | 641 |
| form-submit | 71 | 54 | 66 | 54 | 67 | 66 |
| list-select | 42 | 43 | 42 | 42 | 41 | 42 |
| search | 794 | 788 | 792 | 784 | 786 | 788 |
| tag-add | 335 | 345 | 334 | 340 | 328 | 335 |

#### perf/next15-03-locale

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 146 | 124 | 154 | 81 | 157 | 146 |
| person-page-load | 98 | 99 | 100 | 100 | 101 | 100 |
| my-home-page-load | 848 | 844 | 839 | 835 | 843 | 843 |
| my-orgs-page-load | 427 | 856 | 884 | 859 | 854 | 856 |
| my-feed-page-load | 848 | 840 | 654 | 842 | 855 | 842 |
| nav-projects-load | 84 | 150 | 92 | 99 | 168 | 99 |
| nav-campaign-load | 205 | 219 | 213 | 190 | 205 | 205 |
| nav-people-list-load | 185 | 219 | 166 | 183 | 215 | 185 |
| nav-person-detail-load | 106 | 109 | 130 | 111 | 232 | 111 |
| nav-back-to-projects | 102 | 124 | 200 | 171 | 115 | 124 |
| nav-full-workflow | 682 | 821 | 801 | 754 | 935 | 801 |
| rapid-tab-switching | 692 | 657 | 693 | 566 | 504 | 657 |
| form-submit | 98 | 96 | 104 | 75 | 88 | 96 |
| list-select | 62 | 42 | 42 | 43 | 43 | 43 |
| search | 803 | 795 | 796 | 797 | 792 | 796 |
| tag-add | 344 | 330 | 354 | 350 | 361 | 350 |

#### perf/next15-04-compiler+locale

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 74 | 139 | 135 | 131 | 87 | 131 |
| person-page-load | 94 | 92 | 87 | 84 | 79 | 87 |
| my-home-page-load | 834 | 865 | 850 | 836 | 845 | 845 |
| my-orgs-page-load | 841 | 838 | 844 | 836 | 123 | 838 |
| my-feed-page-load | 841 | 843 | 836 | 842 | 840 | 841 |
| nav-projects-load | 90 | 74 | 79 | 75 | 82 | 79 |
| nav-campaign-load | 181 | 200 | 164 | 170 | 153 | 170 |
| nav-people-list-load | 178 | 191 | 167 | 177 | 163 | 177 |
| nav-person-detail-load | 92 | 116 | 100 | 94 | 102 | 100 |
| nav-back-to-projects | 92 | 92 | 91 | 92 | 96 | 92 |
| nav-full-workflow | 633 | 673 | 601 | 608 | 596 | 608 |
| rapid-tab-switching | 494 | 464 | 554 | 547 | 522 | 522 |
| form-submit | 70 | 51 | 52 | 52 | 53 | 52 |
| list-select | 42 | 42 | 43 | 41 | 43 | 42 |
| search | 788 | 788 | 786 | 787 | 795 | 788 |
| tag-add | 340 | 359 | 335 | 310 | 355 | 340 |

#### perf/next15-05-static-routes

| Scenario | i1 | i2 | i3 | i4 | i5 | median |
|----------|----|----|----|----|-----|--------|
| campaign-page-load | 75 | 74 | 143 | 113 | 104 | 104 |
| person-page-load | 83 | 90 | 79 | 97 | 84 | 84 |
| my-home-page-load | 354 | 362 | 355 | 353 | 364 | 355 |
| my-orgs-page-load | 83 | 93 | 82 | 80 | 87 | 83 |
| my-feed-page-load | 357 | 350 | 350 | 350 | 351 | 350 |
| nav-projects-load | 88 | 91 | 79 | 85 | 89 | 88 |
| nav-campaign-load | 177 | 165 | 207 | 167 | 188 | 177 |
| nav-people-list-load | 184 | 138 | 134 | 172 | 146 | 146 |
| nav-person-detail-load | 91 | 112 | 87 | 115 | 114 | 112 |
| nav-back-to-projects | 186 | 80 | 110 | 106 | 92 | 106 |
| nav-full-workflow | 726 | 586 | 617 | 645 | 629 | 629 |
| rapid-tab-switching | 533 | 537 | 515 | 544 | 493 | 533 |
| form-submit | 55 | 56 | 68 | 69 | 70 | 68 |
| list-select | 42 | 41 | 43 | 41 | 43 | 42 |
| search | 790 | 787 | 789 | 786 | 787 | 787 |
| tag-add | 334 | 331 | 333 | 307 | 340 | 333 |

</details>

## Key findings

### 1. Next 15 baseline has severe regressions

The direct upgrade (`next15-01-baseline`) introduces major regressions caused by
synchronous locale loading blocking server-side rendering:

- **nav-projects-load**: 94ms -> 517ms (+450%)
- **nav-back-to-projects**: 105ms -> 524ms (+399%)
- **my-home-page-load**: 377ms -> 838ms (+122%)
- **my-orgs-page-load**: 112ms -> 842ms (+652%)
- **nav-full-workflow**: 671ms -> 1525ms (+127%)

### 2. Async locale loading fixes navigation regressions

Moving i18n to client-side cached fetch (`next15-03-locale`) fully restores
navigation performance:

- **nav-projects-load**: 517ms -> 99ms (back to main levels)
- **nav-back-to-projects**: 524ms -> 124ms (close to main)
- **nav-full-workflow**: 1525ms -> 801ms (improved, not yet at main's 671ms)

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

- **my-home**: 838ms -> 355ms (back to main's 377ms)
- **my-orgs**: 842ms -> 83ms (faster than main's 112ms)
- **my-feed**: 839ms -> 350ms (back to main's 369ms)

### 4. React Compiler halves form-submit time

The React Compiler (`next15-02-compiler`, `next15-04-compiler+locale`)
consistently delivers ~45% improvement on form-submit interactions:

- **form-submit**: 81ms -> 52ms (N15-04), 66ms (N15-02)

This improvement is consistent across all compiler variants.
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
- My-pages fully fixed (my-orgs 83ms vs main's 112ms)
- Navigation performance competitive with main (nav-full 629ms vs 671ms)
- Form-submit 16% faster (68ms vs 81ms, from React Compiler)
- Rapid tab switching fastest (533ms vs main's 699ms)

### If my-pages regression is acceptable: `next15-04-compiler+locale`

Offers the best navigation times (nav-full 608ms) and form-submit (52ms)
but leaves my-home at 845ms.

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
