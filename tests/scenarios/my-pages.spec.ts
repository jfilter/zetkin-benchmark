import test from '../fixtures';
import {
  CampaignCallAssignments,
  CampaignEvents,
  CampaignSurveys,
  KPD,
  Memberships,
  OrgEmails,
  ReferendumSignatures,
  RosaLuxemburgUser,
} from '../../mock-data';

test.describe('My pages benchmark', () => {
  test.beforeEach(async ({ loginWithCookie, moxy }) => {
    await loginWithCookie();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('my home page load with activities', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    // Events the user can attend (upcoming)
    const myEvents = CampaignEvents.slice(0, 20).map((e) => ({
      ...e,
      organization: KPD,
    }));
    // Events the user signed up for
    const myResponses = myEvents.slice(0, 8).map((e) => ({
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
      data: { data: [] },
    });

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await page.goto(appUri + '/my/home');
      // Wait for the tab navigation and first activity item to render
      await page
        .locator('role=tab >> text=My activities')
        .waitFor({ state: 'visible' });
      await page
        .locator('a[href*="/o/1/events/"], a[href*="/call/"]')
        .first()
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('my-home-page-load', duration);
    }
  });

  test('my orgs page load', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    // Generate multiple org memberships
    const orgMemberships = [];
    for (let i = 1; i <= 15; i++) {
      orgMemberships.push({
        organization: {
          ...KPD,
          id: i,
          title: `Organization ${i}`,
        },
        profile: { id: 1, name: 'Rosa Luxemburg' },
        role: i <= 3 ? 'admin' : null,
        follow: true,
      });
      moxy.setZetkinApiMock(`/orgs/${i}`, 'get', {
        ...KPD,
        id: i,
        title: `Organization ${i}`,
      });
    }

    moxy.setZetkinApiMock('/users/me/memberships', 'get', orgMemberships);

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await page.goto(appUri + '/my/orgs');
      // Wait for the tabs and org list to render
      await page
        .locator('role=tab >> text=My organizations')
        .waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle');

      const duration = Date.now() - start;
      measure('my-orgs-page-load', duration);
    }
  });

  test('my feed page load with events', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    // Events across organizations
    const allEvents = CampaignEvents.slice(0, 50).map((e, idx) => ({
      ...e,
      organization: {
        ...KPD,
        id: (idx % 5) + 1,
        title: `Org ${(idx % 5) + 1}`,
      },
    }));

    moxy.setZetkinApiMock('/users/me/memberships', 'get', Memberships);
    moxy.setZetkinApiMock('/users/me/action_responses', 'get', []);
    moxy.setZetkinApiMock('/orgs', 'get', [KPD]);
    // The feed page fetches events per org
    for (let orgId = 1; orgId <= 5; orgId++) {
      moxy.setZetkinApiMock(`/orgs/${orgId}`, 'get', {
        ...KPD,
        id: orgId,
        title: `Organization ${orgId}`,
      });
      moxy.setZetkinApiMock(
        `/orgs/${orgId}/actions`,
        'get',
        allEvents.filter((e) => e.organization.id === orgId)
      );
      moxy.setZetkinApiMock(`/orgs/${orgId}/campaigns`, 'get', [
        { ...ReferendumSignatures, organization: { ...KPD, id: orgId } },
      ]);
    }

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await page.goto(appUri + '/my/feed');
      // Wait for the All events tab to be selected
      await page
        .locator('role=tab >> text=All events')
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('my-feed-page-load', duration);
    }
  });
});
