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

## Why the app triggers it: the exact suspender

Three instruments pinned it down: a mid-throttle screenshot (the page is **completely blank**, not even the sidebar), a React DevTools hook stub walking committed fibers (the boundary showing the fallback is the bare `<Suspense>` in `core/Providers.tsx` — its hidden children are `CssBaseline > … > NoSsr`, i.e. the whole app), and a dev-build `react-dom` patch logging every caught thenable:

```
[THROWN-THENABLE] AllCampaignsSummaryPage
```

The chain:

1. `pages/organize/[orgId]/projects/index.tsx` (`AllCampaignsSummaryPage`) calls `useActivityOverview` → `useEventsFromDateRange`, **in the hook phase, before the page returns its own `LoadingBoundary`**.
2. `src/features/events/hooks/useEventsFromDateRange.ts:48` contains the codebase's only raw `throw promise` (instrumenting `useRemoteList`/`useRemoteItem` showed they never fire on this page).
3. The nearest boundary above the page is the **fallback-less `<Suspense>` in `core/Providers.tsx`** — the entire app unmounts to nothing.
4. Data arrives ~10ms later, the retry completes, React 19 throttles the reveal to fallback-time + 300ms.

Notably, current `main` has the identical structure (`Providers.tsx`, `_app.tsx` `<NoSsr>`, the `throw promise`). On React 18 there is no 300ms throttle, but **the blank-app flash during the events fetch exists in production today** — it's just short when the API is fast.

## The fix (verified)

Make the hook non-suspending — fire-and-forget the load, render days that haven't loaded yet as empty, and let the Redux update re-render when data lands (12 lines in `useEventsFromDateRange.ts`, branch commit `1f02dd4a8`):

| Warm `/organize/1/projects` load | Time |
|---|---:|
| Next 14 main (React 18, May baseline) | ~95–114ms |
| Next 15, suspending hook | **545ms** |
| Next 15, react-dom throttle → 0 (diagnostic) | 103–111ms |
| **Next 15, non-suspending hook (app-level fix)** | **100–122ms** |

No react-dom patch needed. The page now shows its normal layout + skeletons while loading instead of a blank app, and there is no Suspense fallback commit left to throttle. For a production PR, the loading state should additionally be threaded through `useActivityOverview` and the calendar hooks (`useDayCalendarEvents`, `useWeekCalendarEvents`, `useMonthCalendarEvents`, `useParallelEvents`, `useRelatedEvents`) so consumers can render skeletons instead of briefly-empty lists.

Full benchmark suite on the fixed branch (5 iterations, same methodology as all other tables):

| Scenario | N15 before fix | N15 after fix | N14 main (May ref) |
|---|---:|---:|---:|
| nav-projects-load | 545ms | **155ms** | 98–114ms |
| nav-back-to-projects | 578ms | **158ms** | 106–122ms |
| nav-full-workflow | 1717ms | **833ms** | 718–781ms |
| nav-campaign-load | 205ms | 243ms | 189–237ms |
| nav-people-list-load | 254ms | 206ms | 182–190ms |
| nav-person-detail-load | 144ms | 123ms | 102–120ms |
| rapid-tab-switching | 769ms | 794ms | 645–753ms |

## Where else the same class of problem exists

1. **23 hooks suspend by design** (built on `useRemoteList`/`useRemoteItem` — both `throw` the fetch promise on first mount): call (`useMyAssignments`, `useUnfinishedCalls`, …), canvass (`useHousehold(s)`, `useLocationVisits`, …), areaAssignments (`useAssignmentAreas`, `useAreaAssignmentMetrics`), my (`useAllEvents`, `useMyEvents`), organizations (`useSuborgsWithStats`, …), public (`usePublicSubOrgs`, `useUserMemberships`, `useUpcomingOrgEvents`), profile, user. Every first mount of a page using one of these with fast-resolving data pays up to +300ms on React 19.
2. **The `/my/*` App Router regressions (+450ms in the May runs) are this exact mechanism**: `useMyActivities` → `useMyCallAssignments` + `useMyEvents` (both `useRemoteList`) suspend inside the Suspense boundaries in `features/my/pages/{HomePage,AllEventsPage,MyOrgsPage}.tsx`. Unverified-but-likely: sequential suspensions (React 19 no longer pre-renders siblings after a suspension) may stack more than one 300ms window — my-orgs was +730ms.
3. **Structural hazard**: the fallback-less `<Suspense>` in `core/Providers.tsx` + `<NoSsr>` in `_app.tsx` means any suspension that escapes a page-level boundary blanks the entire app — on React 18 today too, just without the extra 300ms. Two further small fallback-committing boundaries (unidentified, visually harmless) still show up in the fiber-walk on the projects page.

### The three classes are independent

The fixes touch disjoint files and none requires another:

- Fixing **1** (the raw throw) removes both the blank-app flash (today, React 18) and the throttle (React 19) for projects + all calendar views — regardless of 2 and 3. → shipped as its own PR against `main`.
- Fixing **2** (useRemoteList/Item call sites) is per-page work; those pages have their own skeleton boundaries, so they never blanked — they only gain the +300ms on React 19. → follow-ups, `/my/*` first.
- Fixing **3** (fallback-less root `<Suspense>`) only converts "blank" into "skeleton" for whatever still escapes; it does **not** remove the React 19 throttle (any fallback commit triggers it). It stays valuable as defense-in-depth against future suspensions. → separate small PR/design discussion.

Coupling exists only between *symptoms*: the blank-app variant of 1 needs 3's structure to manifest. The mitigations are orthogonal.

The systematic mitigation for the Next 15 upgrade: audit these call sites page by page with the diagnostic spec (`[THROWN-THENABLE]` patch + fiber walk), and convert first-mount paths of entry pages to non-suspending rendering, starting with `/my/*`.

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
