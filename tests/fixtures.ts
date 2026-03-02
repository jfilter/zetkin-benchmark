import { AddressInfo } from 'net';
import { test as base, BrowserContext } from '@playwright/test';
import { parse } from 'url';
import path from 'path';
import { createServer, Server } from 'http';

import {
  KPD,
  Memberships,
  RosaLuxemburgUser,
} from '../mock-data';

// Path to the app.zetkin.org repo — set via APP_REPO_PATH env var
const APP_REPO_PATH =
  process.env.APP_REPO_PATH || path.resolve(__dirname, '../../app.zetkin.org');

// Use the app's own next and moxy packages to avoid version mismatches
// eslint-disable-next-line @typescript-eslint/no-var-requires
const next = require(path.join(APP_REPO_PATH, 'node_modules/next'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const moxy = require(path.join(APP_REPO_PATH, 'node_modules/moxy')).default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sealData } = require(path.join(
  APP_REPO_PATH,
  'node_modules/iron-session'
));

const SESSION_PASSWORD = 'thisispasswordandshouldbelongerthan32characters';

interface BenchmarkFixtures {
  login: () => void;
  /** Sets up API mocks AND creates the session cookie for App Router pages */
  loginWithCookie: () => Promise<void>;
  /** Number of benchmark iterations to run (env BENCH_ITERATIONS, default 5) */
  iterations: number;
  /** Record a benchmark measurement */
  measure: (name: string, durationMs: number) => void;
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
    setMock: (...args: unknown[]) => unknown;
    clearLog: () => void;
    removeMock: (path?: string, method?: string) => void;
    log: (path?: string, method?: string) => unknown[];
    teardown: () => void;
  };
}

const test = base.extend<BenchmarkFixtures, BenchmarkWorkerFixtures>({
  appUri: [
    async ({ moxy }, use) => {
      process.env.ZETKIN_API_PORT = moxy.port.toString();

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

      const { start, stop, setMock, ...rest } = moxy({
        port: MOXY_PORT,
      });

      const setZetkinApiMock = (
        apiPath: string,
        method: string = 'get',
        data?: unknown,
        status?: number
      ) => {
        return setMock(`/v1${apiPath}`, method, {
          status,
          data: data ? { data } : undefined,
        });
      };

      const teardown = () => {
        rest.clearLog();
        rest.removeMock();
      };

      start();

      await use({
        port: MOXY_PORT,
        setZetkinApiMock,
        setMock,
        teardown,
        ...rest,
      });

      await stop();
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

  iterations: async ({}, use) => {
    const n = parseInt(process.env.BENCH_ITERATIONS || '5', 10);
    await use(n);
  },

  measure: async ({}, use) => {
    const measure = (name: string, durationMs: number) => {
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
