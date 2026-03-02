import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1, // Single worker for consistent benchmark timing
  retries: 0, // No retries — we want raw numbers
  reporter: [
    ['list'],
    ['./src/reporter.ts'],
  ],
  use: {
    headless: true,
  },
});
