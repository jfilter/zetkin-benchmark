import test from '../fixtures';
import {
  AreaAssignments,
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
    // Clear stale log entries from previous test's async cleanup
    moxy.clearLog();
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
    // Events the user signed up for (the app expects { action: ZetkinEvent } objects)
    const myResponses = myEvents.slice(0, 8).map((e) => ({
      action_id: e.id,
      id: e.id * 10,
      action: e,
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

    // The HomeLayout has tabs linking to /my/feed which may trigger
    // prefetch of the getAllEvents RPC. Mock its dependencies.
    moxy.setZetkinApiMock('/orgs', 'get', [KPD]);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', myEvents);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', ReferendumSignatures);

    for (let i = 0; i < iterations; i++) {
      // Reset client state (Redux store, router cache) between iterations
      await page.goto('about:blank');

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
    // Org avatars (rendered in org list)
    for (let i = 1; i <= 15; i++) {
      moxy.setZetkinApiMock(`/orgs/${i}/avatar`, 'get', null, 204);
    }

    for (let i = 0; i < iterations; i++) {
      // Reset client state (Redux store, router cache) between iterations
      await page.goto('about:blank');

      const start = Date.now();

      await page.goto(appUri + '/my/orgs');
      // Wait for the tabs and the last org in the list to render
      await page
        .locator('role=tab >> text=My organizations')
        .waitFor({ state: 'visible' });
      await page
        .getByText('Organization 15')
        .waitFor({ state: 'visible' });

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
    moxy.setZetkinApiMock('/users/me/actions', 'get', allEvents.slice(0, 20));
    // User has signed up for some events (the app expects { action: ZetkinEvent } objects)
    const feedResponses = allEvents.slice(0, 8).map((e) => ({
      action_id: e.id,
      id: e.id * 10,
      action: e,
      person: { id: 1, name: 'Rosa Luxemburg' },
      response_date: '2024-06-01',
    }));
    moxy.setZetkinApiMock('/users/me/action_responses', 'get', feedResponses);
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
      // Reset client state (Redux store, router cache) between iterations
      await page.goto('about:blank');

      const start = Date.now();

      await page.goto(appUri + '/my/feed');
      // Wait for the tab and page content to fully render
      await page
        .locator('role=tab >> text=All events')
        .waitFor({ state: 'visible' });
      // Wait for the event list or empty state to render
      await page
        .getByText('Could not find any events')
        .or(page.locator('a[href*="/o/"]').first())
        .first()
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('my-feed-page-load', duration);
    }
  });
});
