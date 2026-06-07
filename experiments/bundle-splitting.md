# Experiment: Bundle Splitting (views/store → column renderers)

| | |
|---|---|
| **Date** | 2026-05-16 — 2026-05-18, 2026-06-07 |
| **Status** | Complete |
| **App repo** | app.zetkin.org |
| **Companion PR** | [zetkin/app.zetkin.org#3692](https://github.com/zetkin/app.zetkin.org/pull/3692) (merged 2026-05-28) |
| **Machine** | Apple M1 Pro, 32 GB RAM, macOS 15.7.x; Node v22.15.0 (May runs) / v20.19.5 (June run) |

## Goal

The i18n migration experiment ([i18n-migration.md](./i18n-migration.md)) found that the Next 15 / React 19 upgrade adds **+400% to Pages Router first-load navigations**, and attributed the gap to React 19 hydrating the large `pages/_app.js` bundle. Its recommendation: code-split the `_app` bundle before retrying the upgrade.

This experiment tests the largest single win available: `src/features/views/store.ts` imported `columnTypes` (the ViewDataTable column-renderer registry) just for a set-membership check — pulling 13 React components plus `@mui/x-data-grid-pro` and transitive MUI/ZUI deps into the shared `_app` bundle of **every** page. The fix replaces the check with a `Set<string>(Object.values(COLUMN_TYPE))`, semantically identical with zero runtime imports.

Two questions:

1. Does removing the accidental import regress anything on Next 14 (current main)?
2. Does the smaller `_app` bundle fix (or shrink) the Next 15 navigation regression?

## Branches

| Ref | Base | What it adds |
|---|---|---|
| `main` | — | Next 14 / React 18 baseline |
| `perf/bundle-splitting` | `main` | Store fix only (first attempt, 2026-05-16) |
| `perf/views-store-bundle` | `main` | Store fix + dayjs utc plugin fix (= PR #3692) |
| `migrate-intl+next15` | `main` | next-intl migration + Next 15 / React 19 upgrade ([i18n experiment](./i18n-migration.md)) |
| `migrate-intl+next15+bundle` | `migrate-intl+next15` | + the two PR #3692 commits cherry-picked |

## Bundle impact

Next 14 (from PR #3692, production build output):

| Bundle | main | with fix | Δ |
|---|---:|---:|---:|
| `pages/_app.js` (parsed) | 551 KB | 220 KB | **-331 KB (-60%)** |
| First Load JS shared by all | 642 KB | 301 KB | **-341 KB (-53%)** |

Next 15 (run 2026-06-07, `next build` output):

| Bundle | migrate-intl+next15 | +bundle | Δ |
|---|---:|---:|---:|
| `chunks/pages/_app-*.js` | 566 KB | 225 KB | **-341 KB (-60%)** |
| First Load JS shared by all | 665 KB | 325 KB | **-340 KB (-51%)** |

The fix works identically on both Next versions.

## The latent dayjs bug

The first benchmark run (2026-05-16, `perf/bundle-splitting`) crashed on every `/organize/*` navigation scenario — the nav results are missing from that run's JSON. Root cause: `useEventsFromDateRange.ts` calls `dayjs(...).utc(true)` but never loaded `dayjs/plugin/utc` itself; it relied on a side-effect import buried in the old column-renderer chain. With the chain gone, the projects page threw `dayjs(...).utc is not a function`. The follow-up commit adds the missing `dayjs.extend(utc)` in the hook.

Worth remembering: removing accidental imports can surface other modules that silently depended on their side effects.

## Results

### Next 14: neutral, as expected (run 2026-05-18, 3 iterations, median ms)

| Scenario | main | perf/views-store-bundle |
|---|---:|---:|
| nav-projects-load | 114 | 112 |
| nav-campaign-load | 237 | 231 |
| nav-people-list-load | 190 | 219 |
| nav-person-detail-load | 120 | 105 |
| nav-back-to-projects | 122 | 128 |
| nav-full-workflow | 781 | 812 |
| rapid-tab-switching | 753 | 774 |

All within noise. On Next 14 / React 18, `_app` hydration was not the bottleneck, so shipping 341 KB less JS doesn't show up in these timings — the Next 14 win is bandwidth/parse cost, not interaction latency. The full-scenario run from 2026-05-16 showed the same: page loads, interactions, my-pages all within noise.

### Next 15: the smaller bundle does NOT fix the navigation regression (run 2026-06-07, 5 iterations, median ± stddev)

| Scenario | migrate-intl+next15 | migrate-intl+next15+bundle |
|---|---:|---:|
| nav-projects-load | 545 ± 8ms | 560 ± 129ms |
| nav-campaign-load | 205 ± 104ms | 230 ± 288ms |
| nav-people-list-load | 254 ± 51ms | 234 ± 87ms |
| nav-person-detail-load | 144 ± 11ms | 131 ± 12ms |
| nav-back-to-projects | 578 ± 44ms | 545 ± 143ms |
| nav-full-workflow | 1717 ± 150ms | 1968 ± 334ms |
| rapid-tab-switching | 769 ± 15ms | 768 ± 79ms |

Halving the shared bundle changes nothing. All deltas are within noise.

## Findings

1. **The fix is real and worth having**: -60% `pages/_app.js` on both Next 14 and Next 15, no behavioral changes (after the dayjs fix). It landed as PR #3692.
2. **The "hydration of a large bundle" hypothesis from the i18n experiment is falsified.** The Next 15 navigation regression is identical with a 566 KB and a 225 KB `_app` chunk. The clue was there all along: the regression has tiny variance (±8ms) and zero long tasks — distributed CPU work doesn't look like that, a timer does.
3. The actual root cause was found by direct profiling: **React 19's Suspense fallback throttling** (`FALLBACK_THROTTLE_MS = 300`). See [react19-suspense-throttle.md](./react19-suspense-throttle.md) for the investigation and proof.

## How to reproduce

```bash
cd ~/code/zetkin/zetkin-benchmark
npm install

./benchmark.sh --repo ~/code/zetkin/app.zetkin.org \
  --refs migrate-intl+next15 migrate-intl+next15+bundle \
  --scenario navigation
```

`migrate-intl+next15+bundle` is `migrate-intl+next15` with the two PR #3692 commits (`9c78d86e2`, `6785901c9`) cherry-picked on top. Raw result JSONs are in `results/`.
