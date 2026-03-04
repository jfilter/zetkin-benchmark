# Experiment Branches

These branches form a systematic performance benchmarking series, testing
incremental optimizations on both Next.js 14 (current) and Next.js 15 (upgrade).

## Overview

| Branch | Base | Optimizations |
|--------|------|---------------|
| `main` | Next 14.2 | Current production |
| `perf/next14-01-locale` | main | Client-side locale loading |
| `perf/next14-02-locale+static` | main | Client-side locale + static /my routes |
| `perf/next15-01-baseline` | main | Next 15 + React 19 upgrade only |
| `perf/next15-02-compiler` | next15-01 | + React Compiler |
| `perf/next15-03-locale` | next15-01 | + Client-side locale loading |
| `perf/next15-04-compiler+locale` | next15-01 | + React Compiler + client-side locale |
| `perf/next15-05-static-routes` | next15-04 | + React Compiler + client-side locale + static /my routes |

## Next.js 14 branches

### `perf/next14-01-locale` — Client-side locale loading

Moves i18n translations from server-side props (`__NEXT_DATA__` payload) to
client-side cached fetch. Instead of embedding ~146 KB of translation strings
into every page's server-rendered payload, a build script
(`scripts/generate-locale-json.ts`) pre-generates per-language JSON files into
`public/locale/`, and the client fetches and caches them once per session.

**Why**: The locale payload bloats every SSR response. Moving it client-side
reduces page data transfer and server render time.

### `perf/next14-02-locale+static` — + Static /my routes

Builds on `next14-01-locale` by making the `/my/*` routes (home, orgs, feed,
settings) static so Next.js can use the Full Route Cache. Removes dynamic server
APIs (`headers()`, `redirectIfLoginNeeded()`, server-side user fetch) from these
routes and replaces `generateMetadata()` with static `metadata` exports. Auth is
handled by middleware instead.

**Why**: Dynamic server-side rendering of `/my/*` pages is slow when every
request must resolve locale, session, and metadata on the server. Making them
static lets Next.js cache the page shell.

## Next.js 15 branches

### `perf/next15-01-baseline` — Direct Next 15 upgrade

The baseline Next.js 15 + React 19 upgrade with no additional optimizations.
A large migration (364 files, 9 commits) including:

- Next.js 14.2 -> 15.5, React 18 -> 19
- `@reduxjs/toolkit` v2, `react-leaflet` v5, `@nivo/*` v0.99, `@mui/*` v7
- Async request APIs (`headers()`, `cookies()`, `params` are now async in Next 15)
- Removal of deprecated `@mui/base`

**Why**: Establishes the performance baseline for Next 15 before applying any
optimizations. Reveals regressions introduced by the framework upgrade itself.

### `perf/next15-02-compiler` — + React Compiler

Adds the React Compiler (`babel-plugin-react-compiler`) on top of the Next 15
baseline. Enables `experimental: { reactCompiler: true }` in `next.config.js`.

**Why**: The React Compiler automatically memoizes components and hooks,
potentially eliminating the need for manual `useMemo`/`useCallback`/`React.memo`.
Tests whether auto-memoization improves interaction performance (form submits,
state updates).

### `perf/next15-03-locale` — + Client-side locale loading

Applies the same locale optimization from the Next 14 series to the Next 15
baseline. Client-side cached translation fetch instead of server-side props.

**Why**: Tests whether the locale optimization has the same impact on Next 15.
The blocking locale loading is a major contributor to SSR latency on both
framework versions.

### `perf/next15-04-compiler+locale` — + React Compiler + locale

Combines both the React Compiler and the async locale loading on top of the
Next 15 baseline. This is `next15-02-compiler` + `next15-03-locale` merged.

**Why**: Tests the combined effect of both optimizations. The compiler improves
client-side interaction speed, while async locale improves server-side render
time. They target different bottlenecks and should compound.

### `perf/next15-05-static-routes` — All optimizations combined

Builds on `next15-04-compiler+locale` by making `/my/*` routes static (same
approach as `next14-02-locale+static`). This is the "everything combined" branch:
Next 15 + React Compiler + async locale + static /my routes.

**Why**: The `/my/*` pages still regress on Next 15 even with locale and compiler
optimizations because they use dynamic server APIs. Making them static resolves
the last remaining regression, bringing all metrics back to (or better than)
main levels.
