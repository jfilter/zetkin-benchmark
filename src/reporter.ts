import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface BenchmarkEntry {
  name: string;
  duration: number;
}

interface BenchmarkResults {
  ref: string;
  timestamp: string;
  measurements: Record<string, number[]>;
}

class BenchmarkReporter implements Reporter {
  private measurements: Record<string, number[]> = {};

  onTestEnd(test: TestCase, result: TestResult) {
    for (const annotation of result.annotations) {
      if (annotation.type === 'benchmark' && annotation.description) {
        const entry: BenchmarkEntry = JSON.parse(annotation.description);
        if (!this.measurements[entry.name]) {
          this.measurements[entry.name] = [];
        }
        this.measurements[entry.name].push(entry.duration);
      }
    }
  }

  onEnd(result: FullResult) {
    const ref = process.env.BENCH_REF || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const results: BenchmarkResults = {
      ref,
      timestamp,
      measurements: this.measurements,
    };

    // Print summary
    console.log('\n--- Benchmark Results ---');
    console.log(`Ref: ${ref}\n`);

    for (const [name, durations] of Object.entries(this.measurements)) {
      const stats = computeStats(durations);
      console.log(
        `  ${name.padEnd(35)} ${stats.median.toFixed(0).padStart(6)}ms median  (${stats.min.toFixed(0)}-${stats.max.toFixed(0)}ms, n=${durations.length})`
      );
    }
    console.log('');

    // Save to file (sanitize ref for filename — replace / with _)
    const safeRef = ref.replace(/\//g, '_');
    const resultsDir = path.resolve(__dirname, '../results');
    fs.mkdirSync(resultsDir, { recursive: true });
    const filePath = path.join(resultsDir, `${safeRef}-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${filePath}`);
  }
}

function computeStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    stdev: Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - median, 2), 0) /
        values.length
    ),
  };
}

export default BenchmarkReporter;
