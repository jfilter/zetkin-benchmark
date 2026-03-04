import { AddressInfo } from 'net';
import { test as base, BrowserContext } from '@playwright/test';
import { parse } from 'url';
import path from 'path';
import { createServer, Server } from 'http';

import {
  EmailConfigs,
  KPD,
  Memberships,
  OrgOfficials,
  RosaLuxemburgUser,
  SubOrganizations,
} from '../mock-data';

// Path to the app.zetkin.org repo — set via APP_REPO_PATH env var
const APP_REPO_PATH =
  process.env.APP_REPO_PATH || path.resolve(__dirname, '../../app.zetkin.org');

// Use the app's own next and express packages to avoid version mismatches
// eslint-disable-next-line @typescript-eslint/no-var-requires
const next = require(path.join(APP_REPO_PATH, 'node_modules/next'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require(path.join(APP_REPO_PATH, 'node_modules/express'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sealData } = require(path.join(
  APP_REPO_PATH,
  'node_modules/iron-session'
));

const SESSION_PASSWORD = 'thisispasswordandshouldbelongerthan32characters';

// ---------------------------------------------------------------------------
// Fast mock server: Express + Map (O(1) lookups instead of moxy's O(n) array)
// ---------------------------------------------------------------------------
interface MockResponse {
  status: number;
  body: string; // pre-serialized JSON for zero-cost serving
}

interface LogEntry {
  timestamp: Date;
  method: string;
  path: string;
  mocked: boolean;
  data?: unknown;
}

function createMockServer(port: number) {
  const mocks = new Map<string, MockResponse>();
  let requestLog: LogEntry[] = [];

  const mockKey = (method: string, path: string) =>
    `${method.toUpperCase()}:${path}`;

  const app = express();
  app.use(express.json());

  // Log all requests and serve mocks
  app.use((req: any, res: any) => {
    const entry: LogEntry = {
      timestamp: new Date(),
      method: req.method,
      path: req.path, // Express strips query string from req.path
      mocked: false,
    };
    if (req.body && Object.keys(req.body).length > 0) {
      entry.data = req.body;
    }
    requestLog.push(entry);

    const mock = mocks.get(mockKey(req.method, req.path));
    if (mock) {
      entry.mocked = true;
      res.status(mock.status);
      if (mock.body) {
        res.set('Content-Type', 'application/json');
        res.send(mock.body);
      } else {
        res.end();
      }
    } else {
      res.status(404).json({ error: 'Not mocked' });
    }
  });

  let server: any;

  const api = {
    port,
    start: () => {
      server = app.listen(port);
    },
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),

    setMock: (
      path: string,
      method: string = 'get',
      response: { status?: number; data?: unknown } = {}
    ) => {
      const data = response.data ?? null;
      mocks.set(mockKey(method, path), {
        status: response.status ?? 200,
        body: data != null ? JSON.stringify(data) : '',
      });
      return {
        removeMock: () => mocks.delete(mockKey(method, path)),
        log: () =>
          requestLog.filter(
            (e) => e.path === path && e.method === method.toUpperCase()
          ),
      };
    },

    setZetkinApiMock: (
      apiPath: string,
      method: string = 'get',
      data?: unknown,
      status?: number
    ) => {
      return api.setMock(`/v1${apiPath}`, method, {
        status,
        data: data ? { data } : undefined,
      });
    },

    removeMock: (path?: string, method?: string) => {
      if (path && method) {
        mocks.delete(mockKey(method, path));
      } else if (path) {
        for (const key of mocks.keys()) {
          if (key.endsWith(`:${path}`)) {
            mocks.delete(key);
          }
        }
      } else {
        mocks.clear();
      }
    },

    log: (path?: string, method?: string) => {
      let log = requestLog;
      if (path) {
        log = log.filter((e) => e.path === path);
      }
      if (method) {
        log = log.filter((e) => e.method === method.toUpperCase());
      }
      return log;
    },

    clearLog: () => {
      requestLog = [];
    },

    teardown: () => {
      requestLog = [];
      mocks.clear();
    },
  };

  return api;
}

// ---------------------------------------------------------------------------

interface BenchmarkFixtures {
  login: () => void;
  /** Sets up API mocks AND creates the session cookie for App Router pages */
  loginWithCookie: () => Promise<void>;
  /** Number of benchmark iterations to run (env BENCH_ITERATIONS, default 5) */
  iterations: number;
  /** Record a benchmark measurement */
  measure: (name: string, durationMs: number) => void;
  /** Automatically provided — fails test immediately on unmocked API routes */
  _failOnUnmocked: void;
}

interface BenchmarkWorkerFixtures {
  appUri: string;
  moxy: {
    port: number;
    setZetkinApiMock: (
      path: string,
      method?: string,
      data?: unknown,
      status?: number
    ) => { log: () => unknown[]; removeMock: () => void };
    setMock: (
      path: string,
      method?: string,
      response?: { status?: number; data?: unknown }
    ) => { log: () => unknown[]; removeMock: () => void };
    clearLog: () => void;
    removeMock: (path?: string, method?: string) => void;
    log: (path?: string, method?: string) => unknown[];
    teardown: () => void;
  };
}

const test = base.extend<BenchmarkFixtures, BenchmarkWorkerFixtures>({
  appUri: [
    async ({ moxy }, use) => {
      // Set required env vars explicitly so tests are self-contained
      // (not reliant on .env.production existing on disk)
      process.env.ZETKIN_API_PORT = moxy.port.toString();
      process.env.ZETKIN_API_HOST = process.env.ZETKIN_API_HOST || 'localhost';
      process.env.ZETKIN_API_DOMAIN =
        process.env.ZETKIN_API_DOMAIN || 'dev.zetkin.org';
      process.env.ZETKIN_CLIENT_ID =
        process.env.ZETKIN_CLIENT_ID || 'a0db63a12bae45ff83d12de70c8992c0';
      process.env.ZETKIN_CLIENT_SECRET =
        process.env.ZETKIN_CLIENT_SECRET ||
        'MWQyZmE2M2UtMzM3Yi00ODUyLWI2NGMtOWY5YTY5NTY3YjU5';
      process.env.ZETKIN_USE_TLS = process.env.ZETKIN_USE_TLS || '0';
      process.env.SESSION_PASSWORD =
        process.env.SESSION_PASSWORD || SESSION_PASSWORD;

      // Next.js resolves paths (like src/locale) relative to CWD,
      // so we must change to the app repo directory
      const originalCwd = process.cwd();
      process.chdir(APP_REPO_PATH);

      const app = next({
        dev: false,
        dir: APP_REPO_PATH,
      });

      await app.prepare();
      const handle = app.getRequestHandler();

      const server: Server = await new Promise((resolve) => {
        const server = createServer((req, res) => {
          const parsedUrl = parse(req.url as string, true);
          handle(req, res, parsedUrl);
        });
        server.listen((error: unknown) => {
          if (error) {
            throw error;
          }
          resolve(server);
        });
      });

      const port = String((server.address() as AddressInfo).port);
      process.env.ZETKIN_APP_HOST = `localhost:${port}`;

      await use(`http://localhost:${port}`);

      await new Promise<void>((cb) => {
        server.close(() => cb());
      });

      process.chdir(originalCwd);
    },
    { auto: true, scope: 'worker' },
  ],

  moxy: [
    async ({}, use, workerInfo) => {
      const MOXY_PORT = 3000 + workerInfo.workerIndex;
      const mockServer = createMockServer(MOXY_PORT);

      mockServer.start();
      await use(mockServer);
      await mockServer.stop();
    },
    { auto: true, scope: 'worker' },
  ],

  login: async ({ moxy }, use) => {
    const login = () => {
      moxy.setZetkinApiMock('/users/me', 'get', RosaLuxemburgUser);
      moxy.setZetkinApiMock('/users/me/memberships', 'get', Memberships);
      moxy.setZetkinApiMock('/session', 'get', {
        created: '2020-01-01T00:00:00',
        level: 2,
        user: RosaLuxemburgUser,
        factors: ['email_password', 'phone_otp'],
      });

      // Common endpoints needed by most pages
      moxy.setZetkinApiMock(`/users/${RosaLuxemburgUser.id}/avatar`, 'get', null, 204);
      moxy.setZetkinApiMock('/orgs/1/avatar', 'get', null, 204);
      moxy.setZetkinApiMock('/orgs/1/officials', 'get', OrgOfficials);
      moxy.setZetkinApiMock('/orgs/1/sub_organizations', 'get', SubOrganizations);
      moxy.setZetkinApiMock('/orgs/1/emails/configs', 'get', EmailConfigs);
      moxy.setZetkinApiMock(`/users/me/memberships/${KPD.id}`, 'get', Memberships[0]);
    };
    await use(login);
  },

  loginWithCookie: async ({ moxy, context, appUri }, use) => {
    const loginWithCookie = async () => {
      // Set up API mocks (same as login)
      moxy.setZetkinApiMock('/users/me', 'get', RosaLuxemburgUser);
      moxy.setZetkinApiMock('/users/me/memberships', 'get', Memberships);
      moxy.setZetkinApiMock('/session', 'get', {
        created: '2020-01-01T00:00:00',
        level: 2,
        user: RosaLuxemburgUser,
        factors: ['email_password', 'phone_otp'],
      });

      // Common endpoints needed by most pages
      moxy.setZetkinApiMock(`/users/${RosaLuxemburgUser.id}/avatar`, 'get', null, 204);
      moxy.setZetkinApiMock('/orgs/1/avatar', 'get', null, 204);
      moxy.setZetkinApiMock('/orgs/1/officials', 'get', OrgOfficials);
      moxy.setZetkinApiMock('/orgs/1/sub_organizations', 'get', SubOrganizations);
      moxy.setZetkinApiMock('/orgs/1/emails/configs', 'get', EmailConfigs);
      moxy.setZetkinApiMock(`/users/me/memberships/${KPD.id}`, 'get', Memberships[0]);

      // Create encrypted iron-session cookie for App Router middleware
      const sessionData = {
        tokenData: {
          access_token: 'mock-access-token',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
        },
      };

      const sealed = await sealData(sessionData, {
        password: SESSION_PASSWORD,
      });

      // Extract host from appUri
      const url = new URL(appUri);

      await context.addCookies([
        {
          name: 'zsid',
          value: sealed,
          domain: url.hostname,
          path: '/',
          httpOnly: true,
          sameSite: 'Lax' as const,
        },
      ]);
    };
    await use(loginWithCookie);
  },

  _failOnUnmocked: [
    async ({ page, moxy }, use) => {
      const unmocked = new Set<string>();
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (url.port === String(moxy.port) && response.status() === 404) {
          unmocked.add(`${response.request().method()} ${url.pathname}`);
        }
      });
      await use();
      if (unmocked.size > 0) {
        const routes = [...unmocked];
        throw new Error(
          `Unmocked API routes (${routes.length}):\n` +
            routes.map((p) => `  - ${p}`).join('\n')
        );
      }
    },
    { auto: true },
  ],

  iterations: async ({}, use) => {
    const measured = parseInt(process.env.BENCH_ITERATIONS || '5', 10);
    // Add 3 warmup iterations so the server is fully warm before measuring.
    // Tests call measure() which skips the first 3 calls per scenario.
    await use(measured + 3);
  },

  measure: async ({}, use) => {
    const warmupCount = 3;
    const callCounts: Record<string, number> = {};

    const measure = (name: string, durationMs: number) => {
      callCounts[name] = (callCounts[name] || 0) + 1;
      if (callCounts[name] <= warmupCount) {
        // Skip warmup iterations — don't record
        return;
      }
      // Store as test annotation — picked up by the custom reporter
      test.info().annotations.push({
        type: 'benchmark',
        description: JSON.stringify({ name, duration: durationMs }),
      });
    };
    await use(measure);
  },
});

export default test;
