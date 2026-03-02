#!/usr/bin/env bash
set -euo pipefail

# Zetkin Benchmark — Compare interaction performance across branches/commits
#
# Usage:
#   ./benchmark.sh --repo <path> --refs <ref1> <ref2> [ref3...]
#   ./benchmark.sh --repo ~/code/app.zetkin.org --refs main feat/react-compiler
#
# Options:
#   --repo <path>       Path to app.zetkin.org repo (required)
#   --refs <ref...>     Branch names or commit SHAs to compare (required, min 2)
#   --iterations <n>    Runs per scenario (default: 5)
#   --scenario <name>   Run only tests matching this name (optional)
#   --skip-build        Skip the build step (use existing .next build)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO=""
REFS=()
ITERATIONS=5
SCENARIO=""
SKIP_BUILD=0

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

# Validate
if [[ -z "$REPO" ]]; then
  echo "Error: --repo is required"
  echo "Usage: ./benchmark.sh --repo <path> --refs <ref1> <ref2>"
  exit 1
fi

if [[ ${#REFS[@]} -lt 1 ]]; then
  echo "Error: --refs requires at least 1 ref"
  echo "Usage: ./benchmark.sh --repo <path> --refs <ref1> <ref2>"
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

  # Install dependencies (needed when switching between branches with different deps)
  echo "Installing dependencies..."
  npm install --legacy-peer-deps 2>&1 | tail -1

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
