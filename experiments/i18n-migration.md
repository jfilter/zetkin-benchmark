# Experiment: i18n Migration (react-intl → next-intl) Performance

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Complete |
| **App repo** | app.zetkin.org |
| **Companion PR** | [zetkin/app.zetkin.org#TBD](https://github.com/zetkin/app.zetkin.org/pulls?q=migrate+next-intl) |
| **Machine** | Apple M1 Pro, 32 GB RAM, macOS 15.7.3, Node v22.15.0 |

## Goal

Quantify the performance impact of swapping the app's i18n layer from `react-intl` to `next-intl`, and check whether that change interacts well with the Next.js 15 upgrade still in flight in [#3544](https://github.com/zetkin/app.zetkin.org/pull/3544).

The motivation: SSR responses on `react-intl` embed the full message catalog (~146 KB) in every `__NEXT_DATA__` payload, and the layer doesn't integrate with Next.js caching. `next-intl` allows build-time JSON compilation and per-page scoped payloads.

## Branches

| Ref | Base | What it adds |
|---|---|---|
| `main` | — | react-intl baseline on Next 14 / React 18 |
| `migrate/next-intl` | `main` | i18n migration only (Next 14 / React 18) |
| `migrate-intl+next15` | `migrate/next-intl` | + #3544 upgrade (Next 15 / React 19) merged on top |
| `migrate-intl+next15+perf` | `migrate-intl+next15` | + cherry-picked Static `/my` Routes + React Compiler from `perf/*` experiments |

### Migration details

**next-intl with `localePrefix: 'never'`:** URLs stay unchanged (no `/en/...` prefix added). Locale is detected from `NEXT_LOCALE` cookie → `user.lang` → `Accept-Language` header.

**Compatibility layer rewrite:** `useMessages`, `<Msg/>`, `makeMessages` were rewritten to call into next-intl internally. The 600+ consumer files in the codebase didn't change.

**Build-time JSON compilation:** New `prebuild` script (`make-yaml` + `generate-locale-json`) compiles YAML into nested JSON under `src/locale/compiled/`. Loaded once per locale per process via `readFileSync` and cached in memory — no per-request file I/O.

**Per-section scoped payloads:** Root layout sends only shared base (`core`/`glob`/`zui` ~5 KB). Each section layout (App Router) and each Pages Router scaffold declares `localeScope: ['feat.events', ...]` to load only what the page needs.

**Strict mode:** `localeScope` is required (typed + runtime). Out-of-scope translation access throws fatal — silent fallback to message keys is gone.

## Results

Median ± stddev across 5 iterations.

| Scenario | main | migrate/next-intl | migrate-intl+next15 | migrate-intl+next15+perf |
|---|---:|---:|---:|---:|
| **Migration alone (vs main)** | | | | |
| nav-projects-load | 98ms | **91ms** (-7%) | 508ms (+418%) ⚠️ | 456ms (+365%) ⚠️ |
| nav-back-to-projects | 106ms | 100ms (-6%) | 524ms (+394%) ⚠️ | 476ms (+349%) ⚠️ |
| nav-full-workflow | 718ms | **633ms (-12%)** | 1476ms (+106%) ⚠️ | 1379ms (+92%) ⚠️ |
| nav-people-list-load | 182ms | **166ms (-9%)** | 136ms (-25%) | 138ms (-24%) |
| nav-person-detail-load | 102ms | **86ms (-16%)** | 104ms | 89ms (-13%) |
| nav-campaign-load | 189ms | 180ms (-5%) | **164ms (-13%)** | 231ms (+22%) |
| rapid-tab-switching | 645ms | 617ms (-4%) | 627ms | **547ms (-15%)** |
| **Interactions** | | | | |
| form-submit-campaign-title | 84ms | 90ms | 95ms | **57ms (-32%)** |
| view-browser-sort-title | 180ms | 189ms | 164ms (-9%) | **151ms (-16%)** |
| list-select-to-bulk-bar | 42ms | 43ms | 42ms | 43ms |
| tag-add-interaction | 312ms | 317ms | 318ms | 317ms |
| **Page loads (App Router /my/*)** | | | | |
| my-home-page-load | 394ms | 398ms | 395ms | 392ms |
| my-orgs-page-load | 865ms | 856ms | 853ms | 848ms |
| my-feed-page-load | 861ms | 861ms | 862ms | 847ms |
| campaign-page-load | 98ms | 100ms | 102ms | 125ms (+28%) |
| person-page-load | 92ms | **77ms (-16%)** | 84ms | 79ms |

## SSR payload (response size)

Public page (`/lost-password`):

| Branch | Response size |
|---|---:|
| main (react-intl) | 148.5 KB |
| migrate/next-intl | 64.5 KB (**-57%**) |

Build output: `pages/_app-*.js` bundle ranges from 87.9 KB (main) → 87.8 KB (migration) → 102 KB (+next15) → 102 KB (+next15+perf). The migration itself doesn't change first-load JS size.

## Findings

### 1. Migration alone is neutral-to-positive across the board

No regressions. The biggest wins are on multi-step workflows (-12% nav-full-workflow) and person-detail-load (-16%) — both attributable to the smaller hydration payload that next-intl's scoped messages produce.

This means the migration can land independently of the Next 15 upgrade without holding it back.

### 2. Next 15 introduces large Pages Router regressions

Adding the Next 15 / React 19 upgrade on top of the migration adds **+400% to first-load Pages Router navigations** (`nav-projects-load`, `nav-back-to-projects`). The migration's improvements are dwarfed by this.

Debugging breakdown for `/organize/1/projects` on `migrate-intl+next15+perf`:
- TTFB: 17ms ✓
- HTML downloaded: 19ms ✓
- DOMContentLoaded: 41ms ✓
- First Paint (skeleton): 108ms ✓
- "All Projects" text visible: **413ms** ← +305ms after first paint
- Long tasks (>50ms): 0

The 305ms gap is React 19 hydration on the 2.06 MB uncompressed `pages/_app.js` bundle. No single long task — distributed hydration work.

> **Correction (2026-06-07):** this hydration hypothesis was falsified — halving the `_app` bundle changes nothing ([bundle-splitting.md](./bundle-splitting.md)). The 300ms gap is React 19's Suspense fallback throttling (`FALLBACK_THROTTLE_MS`); proof in [react19-suspense-throttle.md](./react19-suspense-throttle.md).

### 3. Static `/my` Routes optimization doesn't help the regression

We expected `perf/next15-05-static-routes` to fix the Pages Router regression. It doesn't, because that optimization targets App Router `/my/*` pages, not the Pages Router `/organize/*` pages where the regression lives. Pages Router pages can't use the Full Route Cache (they have `getServerSideProps`).

### 4. React Compiler helps interactions, not navigation

`form-submit -32%`, `view-browser-sort -16%`, `rapid-tab-switching -15%` — all wins consistent with auto-memoization removing re-render work. No measurable impact on navigation regressions.

## Recommendation

Land `migrate/next-intl` independently on current main (Next 14). Wins are real, regressions are zero.

The Next 15 upgrade ([#3544](https://github.com/zetkin/app.zetkin.org/pull/3544)) still needs a separate fix for the Pages Router regression before it's mergeable.

> **Update (2026-06-07):** the avenues originally listed here (code-splitting `_app`, Redux/MUI init) are obsolete — the regression is React 19's Suspense fallback throttling, see [react19-suspense-throttle.md](./react19-suspense-throttle.md) for the proof and the actual mitigation.

## How to reproduce

```bash
cd ~/code/zetkin-benchmark
npm install
npx playwright install chromium

./benchmark.sh --repo ~/code/app.zetkin.org \
  --refs main migrate/next-intl migrate-intl+next15 migrate-intl+next15+perf

# Or just compare existing results:
npx tsx src/compare.ts main migrate/next-intl migrate-intl+next15 migrate-intl+next15+perf
```

Raw result JSONs are in `results/*-2026-05-15T*.json`.
