/* eslint-disable no-console */
// Diagnostic spec for /my/home (App Router) — same instrumentation as
// debug-nav-profile.spec.ts. Run explicitly with DEBUG_NAV=1.
import test from '../fixtures';
import {
  AreaAssignments,
  CampaignCallAssignments,
  CampaignEvents,
  KPD,
} from '../../mock-data';

test.describe('Debug my-home profile', () => {
  test.skip(!process.env.DEBUG_NAV, 'diagnostic spec — set DEBUG_NAV=1 to run');

  test.beforeEach(async ({ loginWithCookie, moxy }) => {
    await loginWithCookie();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    moxy.clearLog();
  });

  test('profile my home page load', async ({ page, appUri, moxy }) => {
    test.setTimeout(120_000);
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[FALLBACK]') || text.includes('[THROWN-THENABLE]')) {
        console.log('  PAGE:', text.slice(0, 300));
      }
    });

    const myEvents = CampaignEvents.slice(0, 20).map((e) => ({
      ...e,
      organization: KPD,
    }));
    const myResponses = myEvents.slice(0, 8).map((e) => ({
      action: e,
      action_id: e.id,
      id: e.id * 10,
      person: { id: 1, name: 'Rosa Luxemburg' },
      response_date: '2024-06-01',
    }));
    moxy.setZetkinApiMock('/users/me/actions', 'get', myEvents);
    moxy.setZetkinApiMock('/users/me/action_responses', 'get', myResponses);
    moxy.setZetkinApiMock(
      '/users/me/call_assignments',
      'get',
      CampaignCallAssignments.slice(0, 5)
    );
    moxy.setMock('/v2/users/me/area_assignments', 'get', {
      data: { data: AreaAssignments },
    });
    moxy.setZetkinApiMock('/orgs', 'get', [KPD]);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', myEvents);

    await page.addInitScript(() => {
      const w = window as any;
      w.__prof = { timers: [] };
      w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        isDisabled: false,
        supportsFiber: true,
        renderers: new Map(),
        inject(r: unknown) {
          this.renderers.set(1, r);
          return 1;
        },
        onScheduleFiberRoot() {},
        onCommitFiberUnmount() {},
        onPostCommitFiberRoot() {},
        setStrictMode() {},
        onCommitFiberRoot(_id: unknown, root: any) {
          try {
            const t = Math.round(performance.now());
            const found: string[] = [];
            const nameOf = (f: any): string | null => {
              const ty = f.type;
              if (typeof ty === 'function') {
                return ty.displayName || ty.name || 'anon';
              }
              if (typeof ty === 'string') {
                return ty;
              }
              return null;
            };
            const collectNames = (f: any, out: string[], depth: number) => {
              if (!f || out.length >= 8 || depth > 25) {
                return;
              }
              const nm = nameOf(f);
              if (nm && nm !== 'anon') {
                out.push(nm);
              }
              collectNames(f.child, out, depth + 1);
              if (depth < 4) {
                collectNames(f.sibling, out, depth + 1);
              }
            };
            const walk = (f: any, depth: number) => {
              if (!f || depth > 400) {
                return;
              }
              if (f.tag === 13 && f.memoizedState !== null) {
                const names: string[] = [];
                collectNames(f.child, names, 0);
                found.push(names.join('>') || '(empty)');
              }
              walk(f.child, depth + 1);
              walk(f.sibling, depth + 1);
            };
            walk(root.current, 0);
            if (found.length) {
              console.warn('[FALLBACK]', t, JSON.stringify(found));
            }
          } catch {
            // ignore
          }
        },
      };
      const origSetTimeout = w.setTimeout.bind(w);
      w.setTimeout = (fn: any, delay?: number, ...args: any[]) => {
        if ((delay || 0) >= 40) {
          w.__prof.timers.push({
            delay,
            stack: (new Error().stack || '')
              .split('\n')
              .slice(2, 5)
              .map((s: string) =>
                s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, '')
              )
              .join(' <- '),
            t: Math.round(performance.now()),
          });
        }
        return origSetTimeout(fn, delay, ...args);
      };
    });

    for (let iter = 0; iter < 4; iter++) {
      await page.goto('about:blank');
      const t0 = Date.now();
      await page.goto(appUri + '/my/home');
      // Same wait condition as the my-pages benchmark scenario
      await page
        .locator('role=tab >> text=My activities')
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => null);
      await page
        .locator('a[href*="/o/1/events/"], a[href*="/call/"]')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => null);
      const total = Date.now() - t0;

      const data = await page.evaluate(() => {
        const w = window as any;
        const nav = performance.getEntriesByType('navigation')[0] as any;
        const resources = (performance.getEntriesByType('resource') as any[])
          .filter((r) => !r.name.includes('/_next/static/'))
          .map((r) => ({
            end: Math.round(r.responseEnd),
            start: Math.round(r.startTime),
            url: r.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 80),
          }));
        return {
          dcl: Math.round(nav.domContentLoadedEventEnd),
          resources,
          timers: w.__prof.timers,
          ttfb: Math.round(nav.responseStart),
        };
      });

      console.log(`\n===== ITERATION ${iter} — total=${total}ms =====`);
      console.log(`TTFB=${data.ttfb} DCL=${data.dcl}`);
      console.log('fetches:', JSON.stringify(data.resources));
      console.log('timers>=40ms:');
      for (const t of data.timers) {
        console.log(`  t=${t.t} delay=${t.delay} ${t.stack}`);
      }
    }
    moxy.teardown();
  });
});
