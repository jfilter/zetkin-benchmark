import fs from 'fs';
import path from 'path';

interface BenchmarkResults {
  ref: string;
  timestamp: string;
  measurements: Record<string, number[]>;
}

interface Stats {
  median: number;
  min: number;
  max: number;
  stdev: number;
  n: number;
}

function computeStats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdev: Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - median, 2), 0) /
        values.length
    ),
    n: values.length,
  };
}

function loadLatestResultsForRef(
  resultsDir: string,
  ref: string
): BenchmarkResults | null {
  const safeRef = ref.replace(/\//g, '_');
  const files = fs
    .readdirSync(resultsDir)
    .filter((f) => f.startsWith(safeRef + '-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(resultsDir, files[0]), 'utf-8');
  return JSON.parse(content);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Auto-detect refs from results directory
    const resultsDir = path.resolve(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      console.error('No results directory found. Run benchmarks first.');
      process.exit(1);
    }

    const files = fs
      .readdirSync(resultsDir)
      .filter((f) => f.endsWith('.json'));
    const refs = [
      ...new Set(files.map((f) => f.replace(/-\d{4}-\d{2}.*$/, ''))),
    ];
    args.push(...refs);
  }

  if (args.length < 2) {
    console.error('Usage: tsx src/compare.ts <ref1> <ref2> [ref3...]');
    console.error('  Or run with no args to auto-detect from results/');
    process.exit(1);
  }

  const resultsDir = path.resolve(__dirname, '../results');
  const allResults: BenchmarkResults[] = [];

  for (const ref of args) {
    const result = loadLatestResultsForRef(resultsDir, ref);
    if (!result) {
      console.error(`No results found for ref: ${ref}`);
      process.exit(1);
    }
    allResults.push(result);
  }

  // Collect all scenario names
  const scenarios = new Set<string>();
  for (const result of allResults) {
    for (const name of Object.keys(result.measurements)) {
      scenarios.add(name);
    }
  }

  // Print comparison table
  const refs = allResults.map((r) => r.ref);
  const colWidth = 18;
  const nameWidth = 35;

  // Header
  const header = [
    'Scenario'.padEnd(nameWidth),
    ...refs.map((r) => r.padStart(colWidth)),
    'Delta'.padStart(10),
  ].join(' | ');

  const separator = [
    '-'.repeat(nameWidth),
    ...refs.map(() => '-'.repeat(colWidth)),
    '-'.repeat(10),
  ].join('-+-');

  console.log('\n=== Benchmark Comparison ===\n');
  console.log(header);
  console.log(separator);

  for (const scenario of scenarios) {
    const cells: string[] = [scenario.padEnd(nameWidth)];
    const stats: (Stats | null)[] = [];

    for (const result of allResults) {
      const values = result.measurements[scenario];
      if (values && values.length > 0) {
        const s = computeStats(values);
        stats.push(s);
        cells.push(
          `${s.median.toFixed(0)} ± ${s.stdev.toFixed(0)}ms`.padStart(colWidth)
        );
      } else {
        stats.push(null);
        cells.push('N/A'.padStart(colWidth));
      }
    }

    // Delta: compare first and last ref
    const first = stats[0];
    const last = stats[stats.length - 1];
    if (first && last) {
      const delta = ((last.median - first.median) / first.median) * 100;
      const sign = delta >= 0 ? '+' : '';
      cells.push(`${sign}${delta.toFixed(1)}%`.padStart(10));
    } else {
      cells.push('N/A'.padStart(10));
    }

    console.log(cells.join(' | '));
  }

  console.log('');
}

main();
