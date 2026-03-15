import { expect } from '@playwright/test';

import test from '../fixtures';
import {
  CampaignEvents,
  KPD,
  Memberships,
  ReferendumSignatures,
  RosaLuxemburgUser,
} from '../../mock-data';

/**
 * Tests verifying locale optimization claims:
 *
 * 1. Static locale file is fetched client-side (not embedded in __NEXT_DATA__)
 * 2. Locale file is fetched only ONCE across multiple page navigations
 * 3. SSR pages (App Router) have translations baked into the HTML
 * 4. __NEXT_DATA__ for Pages Router pages does NOT contain messages
 */

test.describe('Locale optimization', () => {
  test.beforeEach(async ({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    moxy.setZetkinApiMock('/orgs/1/campaigns', 'get', [ReferendumSignatures]);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', ReferendumSignatures);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/call_assignments', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/surveys', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
    moxy.clearLog();
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('locale JSON is fetched once per full page load, cached for client navigations', async ({
    page,
    appUri,
    moxy,
  }) => {
    // Track all requests to /locale/*.json
    const localeRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/locale/') && url.endsWith('.json')) {
        localeRequests.push(url);
      }
    });

    // Mock extra routes needed for people page
    moxy.setZetkinApiMock('/orgs/1/people', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/people/views', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/people/views/folders', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/search/person', 'post', []);

    // Full page load — fetches locale JSON
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('networkidle');

    const afterFirstLoad = localeRequests.length;
    expect(afterFirstLoad).toBe(1); // Exactly one fetch

    // Client-side navigation via sidebar link (no full reload)
    // The organize sidebar has links to People, Projects, etc.
    const peopleLink = page.locator('a[href="/organize/1/people"]').first();
    if (await peopleLink.isVisible()) {
      await peopleLink.click();
      await page.waitForLoadState('networkidle');

      // No new locale fetch — cached in module-level messageCache
      expect(localeRequests.length).toBe(afterFirstLoad);
    }
  });

  test('__NEXT_DATA__ does not contain messages for organize pages', async ({
    page,
    appUri,
  }) => {
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('domcontentloaded');

    // Extract __NEXT_DATA__ from the page
    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? JSON.parse(el.textContent || '{}') : null;
    });

    expect(nextData).toBeTruthy();
    expect(nextData.props?.pageProps).toBeTruthy();
    // The messages key should NOT be in pageProps
    expect(nextData.props.pageProps.messages).toBeUndefined();
    // But lang should still be there
    expect(nextData.props.pageProps.lang).toBeTruthy();
  });

  test('__NEXT_DATA__ payload is under 10KB (excluding messages)', async ({
    page,
    appUri,
  }) => {
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('domcontentloaded');

    const nextDataSize = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? el.textContent?.length || 0 : 0;
    });

    // Without messages, __NEXT_DATA__ should be small
    // (previously ~146KB with messages embedded)
    expect(nextDataSize).toBeLessThan(10 * 1024);
  });
});

test.describe('Locale preload and caching', () => {
  test.beforeEach(async ({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    moxy.setZetkinApiMock('/orgs/1/campaigns', 'get', [ReferendumSignatures]);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', ReferendumSignatures);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/call_assignments', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/surveys', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
    moxy.clearLog();
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('HTML contains <link rel="preload"> for locale JSON', async ({
    page,
    appUri,
  }) => {
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('domcontentloaded');

    // Check for preload link in the DOM
    const preloadLink = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="preload"][as="fetch"]');
      for (const link of links) {
        if (link.getAttribute('href')?.includes('/locale/')) {
          return {
            href: link.getAttribute('href'),
            crossOrigin: link.getAttribute('crossorigin'),
          };
        }
      }
      return null;
    });

    expect(preloadLink).toBeTruthy();
    expect(preloadLink!.href).toContain('/locale/en.json');
    expect(preloadLink!.crossOrigin).toBe('anonymous');
  });

  test('locale JSON response has immutable Cache-Control header', async ({
    page,
    appUri,
  }) => {
    // Intercept the locale fetch response
    let cacheControl: string | null = null;
    page.on('response', (response) => {
      if (response.url().includes('/locale/') && response.url().includes('.json')) {
        cacheControl = response.headers()['cache-control'] || null;
      }
    });

    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('networkidle');

    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain('immutable');
    expect(cacheControl).toContain('max-age=31536000');
  });

  test('locale fetch completes before page content renders', async ({
    page,
    appUri,
  }) => {
    // Track timing: when locale fetch completes vs when translated content appears
    let localeFetchDone = 0;
    page.on('response', (response) => {
      if (response.url().includes('/locale/') && response.url().includes('.json')) {
        localeFetchDone = Date.now();
      }
    });

    const start = Date.now();
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('domcontentloaded');
    const domReady = Date.now();

    // Locale fetch should complete quickly — well before 2s after navigation
    expect(localeFetchDone).toBeGreaterThan(0); // fetch happened
    expect(localeFetchDone - start).toBeLessThan(2000); // within 2s

    // The fetch should complete around DOM ready time (preload helps)
    // Allow generous margin since exact timing varies
    expect(localeFetchDone).toBeLessThanOrEqual(domReady + 500);
  });

  test('second page load reuses cached locale (fast response)', async ({
    page,
    appUri,
  }) => {
    // Track locale response times
    const localeTimes: { url: string; durationMs: number; status: number }[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/locale/') && response.url().includes('.json')) {
        const timing = response.request().timing();
        localeTimes.push({
          url: response.url(),
          durationMs: timing.responseEnd - timing.requestStart,
          status: response.status(),
        });
      }
    });

    // First load
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('networkidle');

    expect(localeTimes.length).toBeGreaterThanOrEqual(1);
    expect(localeTimes[0].status).toBe(200);

    // Second load — browser may cache or revalidate
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('networkidle');

    // The cache-control: immutable header means the browser SHOULD
    // serve from disk cache. If it does make a request, the server
    // should return 304 (not modified) or the response should be
    // very fast from disk cache. Either way, the cache header is
    // the mechanism — verified in the test above.
    if (localeTimes.length >= 2) {
      // If a second request was made, it should be fast (< 50ms from cache)
      // or a 304. Allow generous threshold for CI environments.
      const secondTime = localeTimes[1].durationMs;
      const secondStatus = localeTimes[1].status;
      const isCacheHit = secondStatus === 304 || secondTime < 100;
      expect(isCacheHit).toBe(true);
    }
    // If no second request was made, browser served from cache (ideal)
  });
});

test.describe('Locale SSR verification', () => {
  test.beforeEach(({ moxy }) => {
    // Unauthenticated — public pages
    moxy.setMock('/v1/users/me', 'get', { status: 401 });
    moxy.setMock('/v1/session', 'get', { status: 401 });
    moxy.setMock('/v1/users/me/memberships', 'get', { status: 401 });
    moxy.clearLog();
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('App Router SSR pages have translations in initial HTML', async ({
    appUri,
    browser,
  }) => {
    const url = new URL(appUri);
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'sv' },
    });
    // Set NEXT_LOCALE cookie to force Swedish locale
    await ctx.addCookies([
      { name: 'NEXT_LOCALE', value: 'sv', domain: url.hostname, path: '/' },
    ]);
    const freshPage = await ctx.newPage();

    const response = await freshPage.goto(appUri + '/lost-password');
    const html = await response!.text();

    // Swedish translations should be in the SSR HTML
    expect(html).toContain('Tillbaka till startsidan');
    expect(html).toContain('Sidan hittades inte');
    await ctx.close();
  });

  test('html lang attribute reflects detected locale', async ({
    appUri,
    browser,
  }) => {
    const url = new URL(appUri);
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'de' },
    });
    await ctx.addCookies([
      { name: 'NEXT_LOCALE', value: 'de', domain: url.hostname, path: '/' },
    ]);
    const freshPage = await ctx.newPage();

    await freshPage.goto(appUri + '/register');

    const lang = await freshPage.getAttribute('html', 'lang');
    expect(lang).toBe('de');
    await ctx.close();
  });

  test('URLs have no locale prefix (invisible routing)', async ({
    appUri,
    browser,
  }) => {
    const url = new URL(appUri);
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'sv' },
    });
    await ctx.addCookies([
      { name: 'NEXT_LOCALE', value: 'sv', domain: url.hostname, path: '/' },
    ]);
    const freshPage = await ctx.newPage();

    await freshPage.goto(appUri + '/lost-password');

    // URL should NOT have /sv/ prefix
    expect(freshPage.url()).toBe(appUri + '/lost-password');
    await ctx.close();
  });
});
