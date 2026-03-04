#!/usr/bin/env bash
set -euo pipefail

# Zetkin Benchmark — Compare interaction performance across branches/commits
#
# Usage:
#   ./benchmark.sh --repo <path> --refs <ref1> <ref2> [ref3...]
#   ./benchmark.sh --repo <path> --experiment <name>
#
# Examples:
#   ./benchmark.sh --repo ~/code/app.zetkin.org --refs main perf/next15-05-static-routes
#   ./benchmark.sh --repo ~/code/app.zetkin.org --experiment next15
#   ./benchmark.sh --repo ~/code/app.zetkin.org --experiment next15 --scenario my-pages
#
# Options:
#   --repo <path>            Path to app.zetkin.org repo (required)
#   --refs <ref...>          Branch names or commit SHAs to compare
#   --experiment <name>      Use a predefined set of refs (see experiments/)
#   --iterations <n>         Runs per scenario (default: 5)
#   --scenario <name>        Run only tests matching this name (optional)
#   --skip-build             Skip the build step (use existing .next build)
#   --list-experiments       List available experiment presets

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO=""
REFS=()
ITERATIONS=5
SCENARIO=""
SKIP_BUILD=0
EXPERIMENT=""

# --- Experiment presets ---
# Each experiment defines a set of refs to benchmark.
# Add new experiments here as functions named experiment_<name>.
experiment_next15() {
  REFS=(
    main
    perf/next14-01-locale
    perf/next14-02-locale+static
    perf/next15-01-baseline
    perf/next15-02-compiler
    perf/next15-03-locale
    perf/next15-04-compiler+locale
    perf/next15-05-static-routes
  )
}

list_experiments() {
  echo "Available experiments:"
  echo ""
  echo "  next15    Next.js 15 migration (8 branches: main + 2 N14 variants + 5 N15 variants)"
  echo ""
  echo "See experiments/ folder for detailed documentation."
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --refs)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        REFS+=("$1")
        shift
      done
      ;;
    --experiment)
      EXPERIMENT="$2"
      shift 2
      ;;
    --list-experiments)
      list_experiments
      exit 0
      ;;
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --scenario)
      SCENARIO="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Resolve experiment to refs
if [[ -n "$EXPERIMENT" ]]; then
  experiment_fn="experiment_${EXPERIMENT}"
  if declare -f "$experiment_fn" > /dev/null 2>&1; then
    if [[ ${#REFS[@]} -gt 0 ]]; then
      echo "Error: --experiment and --refs are mutually exclusive"
      exit 1
    fi
    $experiment_fn
    echo "Experiment: $EXPERIMENT (${#REFS[@]} refs)"
  else
    echo "Error: unknown experiment '$EXPERIMENT'"
    echo ""
    list_experiments
    exit 1
  fi
fi

# Validate
if [[ -z "$REPO" ]]; then
  echo "Error: --repo is required"
  echo "Usage: ./benchmark.sh --repo <path> --refs <ref1> <ref2>"
  echo "   or: ./benchmark.sh --repo <path> --experiment <name>"
  exit 1
fi

if [[ ${#REFS[@]} -lt 1 ]]; then
  echo "Error: --refs or --experiment is required"
  echo "Usage: ./benchmark.sh --repo <path> --refs <ref1> <ref2>"
  echo "   or: ./benchmark.sh --repo <path> --experiment <name>"
  exit 1
fi

REPO="$(cd "$REPO" && pwd)"

echo "=== Zetkin Benchmark ==="
echo "Repo:       $REPO"
echo "Refs:       ${REFS[*]}"
echo "Iterations: $ITERATIONS"
echo ""

# Save current branch so we can restore it
ORIGINAL_BRANCH="$(cd "$REPO" && git rev-parse --abbrev-ref HEAD)"
ORIGINAL_COMMIT="$(cd "$REPO" && git rev-parse HEAD)"

cleanup() {
  echo ""
  echo "Restoring original branch: $ORIGINAL_BRANCH ($ORIGINAL_COMMIT)"
  cd "$REPO"
  rm -f "$REPO/.env.production"
  git checkout -- . 2>/dev/null
  git checkout "$ORIGINAL_BRANCH" 2>/dev/null || git checkout "$ORIGINAL_COMMIT"
}
trap cleanup EXIT

# Copy .env.test to .env.production (needed for Next.js prod build)
cp "$REPO/.env.test" "$REPO/.env.production"

for ref in "${REFS[@]}"; do
  echo ""
  echo "=== Benchmarking: $ref ==="
  echo ""

  # Checkout the ref (reset any changes from previous npm install)
  cd "$REPO"
  git checkout -- .
  git checkout "$ref"

  # Install dependencies (clean install to avoid stale modules from other branches)
  echo "Installing dependencies..."
  npm ci --legacy-peer-deps 2>&1 | tail -1

  # Build (retry once on failure — Google Fonts DNS can be flaky)
  if [[ $SKIP_BUILD -eq 0 ]]; then
    echo "Building..."
    if ! NODE_ENV=production npm run build; then
      echo "Build failed, retrying in 5s..."
      sleep 5
      NODE_ENV=production npm run build
    fi
  else
    echo "Skipping build (--skip-build)"
  fi

  # Run benchmark tests
  cd "$SCRIPT_DIR"

  BENCH_ARGS=()
  if [[ -n "$SCENARIO" ]]; then
    BENCH_ARGS+=("--grep" "$SCENARIO")
  fi

  APP_REPO_PATH="$REPO" \
  BENCH_REF="$ref" \
  BENCH_ITERATIONS="$ITERATIONS" \
  NODE_ENV=production \
  npx playwright test "${BENCH_ARGS[@]}" || true

  echo ""
  echo "=== Done: $ref ==="
done

# Compare results
echo ""
echo "=== Comparing Results ==="
echo ""

cd "$SCRIPT_DIR"
npx tsx src/compare.ts "${REFS[@]}"
