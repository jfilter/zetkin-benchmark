# zetkin-benchmark

Performance benchmark suite for [app.zetkin.org](https://github.com/zetkin/app.zetkin.org). Measures page load, navigation, and interaction times across branches using Playwright against a production build with a mocked API.

## Quick start

```bash
npm install

# Compare two branches
./benchmark.sh --repo ~/code/app.zetkin.org --refs main feat/my-branch

# Run a predefined experiment (see experiments/)
./benchmark.sh --repo ~/code/app.zetkin.org --experiment next15

# Run a single scenario
./benchmark.sh --repo ~/code/app.zetkin.org --refs main --scenario my-pages
```

## How it works

For each ref, `benchmark.sh`:

1. Checks out the branch in the app repo
2. Runs `npm ci` and `next build`
3. Starts the production Next.js server in-process
4. Runs Playwright tests against it with a mock API server (Express + Map)
5. Records median timings (5 measured iterations, 3 warmup discarded)
6. Saves results to `results/` as JSON
7. Prints a comparison table at the end

## Scenarios

| File | What it measures |
|------|-----------------|
| `page-load` | Full page load (campaign, person) |
| `my-pages` | /my/home, /my/orgs, /my/feed page loads |
| `multi-navigation` | Multi-step navigation workflow + back navigation |
| `form-submit` | Campaign title form submit latency |
| `list-interaction` | Bulk selection in people list |
| `search` | Type-to-results search latency |
| `tag-add` | Tag assignment interaction |

## Options

```
--repo <path>          Path to app.zetkin.org repo (required)
--refs <ref...>        Branch names or commit SHAs to compare
--experiment <name>    Use a predefined set of refs (see experiments/)
--iterations <n>       Measured runs per scenario (default: 5)
--scenario <name>      Run only tests matching this name
--skip-build           Skip build step (use existing .next)
--list-experiments     List available experiment presets
```

## Results

Results are saved as JSON in `results/`. Use `npm run compare` or the automatic comparison at the end of `benchmark.sh` to view a formatted table.

See `experiments/` for documented experiment reports with findings and analysis.
