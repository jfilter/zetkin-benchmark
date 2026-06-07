# Experiment: React 19 Suspense Throttling causes the Next 15 navigation regression

| | |
|---|---|
| **Date** | 2026-06-07 |
| **Status** | Complete |
| **App repo** | app.zetkin.org |
| **Branch** | `migrate-intl+next15+bundle` (next-intl + Next 15.5 + React 19.2.4 + PR #3692) |
| **Machine** | Apple M1 Pro, 32 GB RAM, macOS 15.7.5, Node v20.19.5 |
| **Upstream issue** | [facebook/react#31819](https://github.com/facebook/react/issues/31819) (open) |

## Goal

Find the actual cause of the **+400% Pages Router first-load navigation regression** under Next 15 / React 19 (`nav-projects-load` 545ms vs ~100ms on Next 14 main), after [bundle-splitting.md](./bundle-splitting.md) falsified the bundle-size/hydration hypothesis.

## Method

A diagnostic Playwright spec (`tests/scenarios/debug-nav-profile.spec.ts`, run with `DEBUG_NAV=1`) loads `/organize/1/projects` against a production build with the mock API and records: navigation timing, Next.js hydration marks, resource timing for every API call, long tasks, and — decisively — **every `setTimeout` ≥ 40ms with its call stack**.

## Timeline of a warm load (545ms total, unpatched)

| t (ms) | What happens |
|---:|---|
| 15–29 | TTFB — server is fast |
| 32–44 | DOMContentLoaded |
| ~48 | Hydration complete (`Next.js-hydration`: **4ms** — hydration is not the problem) |
| 45–66 | All API requests fired (orgs, campaigns, surveys, actions, …) |
| ~59 | Page mounts; `useRemoteList` hooks suspend → Suspense fallback (skeleton) commits |
| 60–80 | All API responses arrive; suspended render retries and completes |
| **69, 75** | **react-dom schedules `setTimeout(~290ms)`** — stack points into the framework chunk |
| ~360 | Timer fires → content commits. Only now `/api/users/me`, avatars, link prefetches fire |
| ~410–460 | "All Projects" visible |

Between t≈80 and t≈360 the browser is **completely idle**: no long tasks, no network. The page waits on a single timer.

## The timer is React's Suspense fallback throttle

react-dom's `finishConcurrentRender` contains ([ReactFiberWorkLoop.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js), minified in `framework-*.js`):

```js
// retry-lane commit within 300ms of the most recent fallback commit?
if ((0x3c00000 & lanes) === lanes && 10 < (msUntilTimeout = globalMostRecentFallbackTime + 300 - now())) {
  // ...delay the commit:
  root.timeoutHandle = scheduleTimeout(commitRoot..., msUntilTimeout); // labeled "Throttled"
}
```

`FALLBACK_THROTTLE_MS = 300` is hardcoded. When content replaces a Suspense fallback *within 300ms of the fallback being shown*, React 19 delays the reveal until the 300ms mark — by design, to avoid skeleton flicker. There is no opt-out ([facebook/react#31819](https://github.com/facebook/react/issues/31819)).

The scheduled delay observed in the profile (`~290ms ≈ 300 − elapsed-since-fallback`) matches exactly.

## Proof by patching the constant

Patching the throttle scheduling site in the production framework chunk (no rebuild — in-place edit of `.next/static/chunks/framework-*.js`):

```bash
perl -pi -e 's/10<\(l=i3\+300-ea\(\)\)/10<(l=i3+0-ea())/' .next/static/chunks/framework-*.js
# (minified names vary per build — locate via: grep -o '.{25}300.{25}' framework-*.js)
```

| Warm `/organize/1/projects` load | Time |
|---|---:|
| Next 14 main (React 18, May baseline) | ~95–114ms |
| Next 15 + React 19.2.4, unpatched | **545ms** |
| Next 15 + React 19.2.4, throttle → 0 | **103–111ms** |

With the throttle disabled, Next 15 is at **full parity with Next 14**. The entire navigation regression is this one timer. (`users/me` fires at ~70ms instead of ~360ms, confirming the whole post-reveal cascade shifts forward.)

## Why the app triggers it

- Organize pages return `null` during SSR (`useServerSide()`), so all content mounts client-side.
- On mount, data hooks built on `useRemoteList`/`useRemoteItem` **suspend** (`core/hooks/useRemoteList.ts` throws the fetch promise) inside page-level boundaries (e.g. `LoadingBoundary` in `pages/organize/[orgId]/projects/index.tsx`) and the app-level bare `<Suspense>` in `core/Providers.tsx`.
- The skeleton commits, data arrives quickly, React 19 holds the content until fallback-time + 300ms.
- React 18 (current main) does not throttle this case — hence no regression on Next 14.

## Real-world impact

The throttle only penalizes content that resolves **faster** than 300ms after the fallback commits:

- Benchmark with instant mock API: every navigation pays nearly the full ~300ms (this is why the regression looked so dramatic).
- Production with ~100–200ms API latency: pages pay the remainder (~100–200ms).
- Pages whose data takes >300ms: unaffected.

So the practical regression is "up to +300ms per page mount that shows a Suspense skeleton", worst for the fastest users.

## Open questions

- The March experiment ([next15-migration.md](./next15-migration.md)) saw client-side locale fetching fix the same nav scenarios (517→99ms) on react-intl branches with the same react-dom 19.2.4 — that fix should not bypass the throttle, so the two results are not fully reconciled. Possibly the changed message-loading altered when (or whether) fallbacks commit relative to data arrival. Re-profile if those branches become relevant again.
- The App Router `/my/*` page regressions (+450ms) were not re-examined; plausibly the same mechanism.

## Consequences for the Next 15 upgrade ([#3544](https://github.com/zetkin/app.zetkin.org/pull/3544))

1. Don't spend more effort on bundle size for this problem — proven irrelevant to it.
2. Before/with the upgrade, audit initial-mount Suspense usage on the hot organize pages: where data typically resolves fast, render without committing a Suspense fallback (non-suspending data hooks, or SSR the data so the boundary never suspends).
3. Track [facebook/react#31819](https://github.com/facebook/react/issues/31819) — if React ships an opt-out, the audit becomes unnecessary.
4. Re-run `--scenario navigation` after each mitigation; the diagnostic spec pinpoints whether the 300ms timer is still being scheduled.

## How to reproduce

```bash
cd ~/code/zetkin/zetkin-benchmark
# build the branch in the app repo first (or run benchmark.sh once), then:
DEBUG_NAV=1 MOXY_PORT_BASE=3100 APP_REPO_PATH=~/code/zetkin/app.zetkin.org NODE_ENV=production \
  npx playwright test tests/scenarios/debug-nav-profile.spec.ts
```
