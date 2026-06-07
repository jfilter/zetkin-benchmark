/* eslint-disable no-console */
// Diagnostic spec — breaks down where time goes during /organize/1/projects load
// (TTFB, hydration marks, API timing, timers >= 40ms with stacks, long tasks).
// Not part of the benchmark suite; run explicitly with DEBUG_NAV=1.
// Used to identify React 19's FALLBACK_THROTTLE_MS as the Next 15 nav regression
// (see experiments/react19-suspense-throttle.md).
import test from '../fixtures';
import { KPD, OrgTasks, AllMembersView, ReferendumSignatures } from '../../mock-data';

test.describe('Debug nav profile', () => {
  test.skip(!process.env.DEBUG_NAV, 'diagnostic spec — set DEBUG_NAV=1 to run');

  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    moxy.clearLog();
  });

  test('profile projects page load', async ({ page, appUri, moxy }) => {
    test.setTimeout(120_000);
    moxy.setZetkinApiMock('/orgs', 'get', [KPD]);
    const campaigns = [];
    for (let i = 1; i <= 20; i++) {
      campaigns.push({ ...ReferendumSignatures, id: i, title: `Campaign ${i}` });
    }
    moxy.setZetkinApiMock('/orgs/1/campaigns', 'get', campaigns);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', OrgTasks);
    moxy.setZetkinApiMock('/orgs/1/people/views', 'get', [AllMembersView]);

    await page.addInitScript(() => {
      const w = window as any;
      w.__prof = { mutations: [], longtasks: [], paints: [], timers: [] };
      // Instrument timers >= 40ms with call stacks to find fixed delays
      const origSetTimeout = w.setTimeout.bind(w);
      w.setTimeout = (fn: any, delay?: number, ...args: any[]) => {
        if ((delay || 0) >= 40) {
          w.__prof.timers.push({
            t: Math.round(performance.now()),
            delay,
            stack: (new Error().stack || '')
              .split('\n')
              .slice(2, 5)
              .map((s: string) => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, ''))
              .join(' <- '),
          });
        }
        return origSetTimeout(fn, delay, ...args);
      };
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            w.__prof.longtasks.push({ t: e.startTime, d: e.duration });
          }
        }).observe({ entryTypes: ['longtask'] });
      } catch {
        // ignore
      }
    });

    for (let iter = 0; iter < 4; iter++) {
      await page.goto('about:blank');
      const t0 = Date.now();
      await page.goto(appUri + '/organize/1/projects');
      await page.locator('text=All Projects').first().waitFor({ state: 'visible' });
      const total = Date.now() - t0;

      const data = await page.evaluate(() => {
        const w = window as any;
        const nav = performance.getEntriesByType('navigation')[0] as any;
        const measures = performance
          .getEntriesByType('measure')
          .map((m) => ({ name: m.name, start: Math.round(m.startTime), dur: Math.round(m.duration) }));
        const marks = performance
          .getEntriesByType('mark')
          .map((m) => ({ name: m.name, t: Math.round(m.startTime) }));
        const resources = (performance.getEntriesByType('resource') as any[])
          .filter((r) => !r.name.includes('/_next/static/'))
          .map((r) => ({
            url: r.name.replace(/^https?:\/\/[^/]+/, ''),
            start: Math.round(r.startTime),
            end: Math.round(r.responseEnd),
            type: r.initiatorType,
          }));
        const scripts = (performance.getEntriesByType('resource') as any[])
          .filter((r) => r.name.includes('/_next/static/'))
          .map((r) => ({ end: Math.round(r.responseEnd) }));
        const lastScriptDone = Math.max(0, ...scripts.map((s) => s.end));
        const nextData = document.getElementById('__NEXT_DATA__');
        return {
          timers: w.__prof.timers,
          ttfb: Math.round(nav.responseStart),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          paints: w.__prof.paints,
          measures,
          marks: marks.filter((m) => m.name.startsWith('next') || m.name.includes('hydrat')),
          resources,
          lastScriptDone,
          nextDataKB: nextData ? Math.round((nextData.textContent || '').length / 1024) : -1,
          longtasks: w.__prof.longtasks.map((l: any) => `${Math.round(l.t)}+${Math.round(l.d)}`).join(' '),
        };
      });

      console.log(`\n===== ITERATION ${iter} — total(playwright)=${total}ms =====`);
      console.log(`TTFB=${data.ttfb} DCL=${data.dcl} lastScript=${data.lastScriptDone} __NEXT_DATA__=${data.nextDataKB}KB`);
      console.log('measures:', JSON.stringify(data.measures));
      console.log('api/resources:', JSON.stringify(data.resources.filter((r: any) => r.type === 'fetch')));
      console.log('timers>=40ms:');
      for (const t of data.timers) {
        console.log(`  t=${t.t} delay=${t.delay} ${t.stack}`);
      }
      console.log('longtasks:', data.longtasks || '(none)');
    }
    moxy.teardown();
  });
});
