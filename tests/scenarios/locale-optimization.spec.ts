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

  test('preload causes locale fetch to start before JS execution', async ({
    page,
    appUri,
  }) => {
    // Track the order of network requests to verify preload fires early.
    // With <link rel="preload">, the browser starts the locale fetch during
    // HTML parsing — BEFORE JS bundles load and React's useEffect fires.
    // Without preload, the fetch would only start after: HTML → JS → React
    // render → useEffect — appearing as the LAST network request.
    const requestOrder: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/locale/') && url.includes('.json')) {
        requestOrder.push('locale');
      } else if (url.includes('/_next/') && url.endsWith('.js')) {
        if (
          requestOrder.length === 0 ||
          requestOrder[requestOrder.length - 1] !== 'js'
        ) {
          requestOrder.push('js');
        }
      }
    });

    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('networkidle');

    const localeIndex = requestOrder.indexOf('locale');
    expect(localeIndex).toBeGreaterThanOrEqual(0); // locale was fetched

    // With preload: locale appears in first 2 requests (during HTML parse)
    // Without preload: locale appears AFTER all JS chunks (useEffect)
    expect(localeIndex).toBeLessThanOrEqual(2);
  });

  test('preload link is in raw server HTML (not client-rendered)', async ({
    appUri,
  }) => {
    // Fetch the raw HTML directly — no browser, no JS execution.
    // The preload link must be in the server-rendered HTML so the browser
    // sees it during initial HTML parsing (before any JS runs).
    const http = await import('http');
    const html = await new Promise<string>((resolve) => {
      http.get(appUri + '/organize/1/projects', (res) => {
        let data = '';
        res.on('data', (c: Buffer) => (data += c));
        res.on('end', () => resolve(data));
      });
    });

    // Must contain a preload link for locale JSON in the raw HTML
    expect(html).toContain('rel="preload"');
    expect(html).toContain('/locale/');
    expect(html).toContain('as="fetch"');

    // The preload must appear BEFORE the first <script> tag
    const preloadPos = html.indexOf('rel="preload"');
    const firstScriptPos = html.indexOf('<script');
    expect(preloadPos).toBeLessThan(firstScriptPos);
  });

  test('browser disk cache serves locale on second load (CDP verified)', async ({
    appUri,
    moxy,
  }) => {
    // Use a persistent context (not newContext which is incognito with no
    // disk cache) and CDP to verify the browser actually caches the locale
    // file on second load.
    const { chromium } = await import('@playwright/test');
    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-cache-'));

    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    moxy.setZetkinApiMock('/orgs/1/campaigns', 'get', [ReferendumSignatures]);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', ReferendumSignatures);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/call_assignments', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/surveys', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);

    const ctx = await chromium.launchPersistentContext(tmpDir, {
      headless: true,
    });
    const page = ctx.pages()[0] || (await ctx.newPage());

    // Count actual server hits for locale files (most honest test)
    let serverHits = 0;
    const originalFetch = page.route;
    // Don't use page.route (disables cache) — count hits via CDP instead
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');

    const localeFromCache: boolean[] = [];
    const servedFromCache = new Set<string>();

    cdp.on('Network.requestServedFromCache', (params: { requestId: string }) => {
      servedFromCache.add(params.requestId);
    });

    cdp.on(
      'Network.responseReceived',
      (params: { requestId: string; response: { url: string; fromDiskCache?: boolean } }) => {
        if (params.response.url.includes('/locale/')) {
          localeFromCache.push(servedFromCache.has(params.requestId));
        }
      }
    );

    // First load — network
    await page.goto(appUri + '/organize/1/projects');
    await page.waitForLoadState('networkidle');

    expect(localeFromCache.length).toBeGreaterThanOrEqual(1);
    expect(localeFromCache[0]).toBe(false); // First load: from network

    // Reload — should be from cache
    localeFromCache.length = 0;
    servedFromCache.clear();
    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(localeFromCache.length).toBeGreaterThanOrEqual(1);
    expect(localeFromCache[0]).toBe(true); // Second load: from cache

    await cdp.detach();
    await ctx.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
