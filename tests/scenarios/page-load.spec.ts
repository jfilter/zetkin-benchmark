import test from '../fixtures';
import {
  CampaignCallAssignments,
  CampaignEvents,
  CampaignSurveys,
  generateSurveySubmissions,
  KPD,
  OrgEmails,
  OrgJourneys,
  OrgTags,
  PersonJourneyInstances,
  PersonTags,
  ReferendumSignatures,
  RosaLuxemburg,
  TagGroups,
} from '../../mock-data';

test.describe('Page load benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('campaign page load time', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', ReferendumSignatures);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', CampaignEvents);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/surveys', 'get', CampaignSurveys);
    moxy.setZetkinApiMock(
      '/orgs/1/campaigns/1/call_assignments',
      'get',
      CampaignCallAssignments
    );
    moxy.setZetkinApiMock('/orgs/1/call_assignments', 'get', CampaignCallAssignments);
    moxy.setZetkinApiMock('/orgs/1/surveys', 'get', CampaignSurveys);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', CampaignEvents);
    moxy.setZetkinApiMock('/orgs/1/emails', 'get', OrgEmails);
    moxy.setZetkinApiMock('/orgs/1/email_themes', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/email_configs', 'get', []);
    // API v2 endpoint for area assignments
    moxy.setMock('/v2/orgs/1/area_assignments', 'get', {
      data: { data: [] },
    });
    // Survey submissions (only mock the first 10 — the page only fetches stats
    // for surveys that are actually rendered, not all 100)
    for (const survey of CampaignSurveys.slice(0, 10)) {
      moxy.setZetkinApiMock(
        `/orgs/1/surveys/${survey.id}/submissions`,
        'get',
        generateSurveySubmissions(survey.id, 5)
      );
    }

    for (let i = 0; i < iterations; i++) {
      // Reset client state (Redux store, router cache) between iterations
      await page.goto('about:blank');
      const start = Date.now();

      await page.goto(appUri + '/organize/1/projects/1');
      await page.locator('data-testid=page-title').waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('campaign-page-load', duration);
    }
  });

  test('person page load time', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    moxy.setZetkinApiMock('/orgs/1/people/1', 'get', RosaLuxemburg);
    moxy.setZetkinApiMock('/orgs/1/people/1/tags', 'get', PersonTags);
    moxy.setZetkinApiMock('/orgs/1/people/tags', 'get', OrgTags);
    moxy.setZetkinApiMock('/orgs/1/tag_groups', 'get', TagGroups);
    moxy.setZetkinApiMock('/orgs/1/journeys', 'get', OrgJourneys);
    moxy.setZetkinApiMock(
      '/orgs/1/people/1/journey_instances',
      'get',
      PersonJourneyInstances
    );

    for (let i = 0; i < iterations; i++) {
      // Reset client state (Redux store, router cache) between iterations
      await page.goto('about:blank');
      const start = Date.now();

      await page.goto(appUri + '/organize/1/people/1');
      await page
        .locator(`text=${RosaLuxemburg.first_name}`)
        .first()
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('person-page-load', duration);
    }
  });
});
