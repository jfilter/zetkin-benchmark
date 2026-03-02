import test from '../fixtures';
import {
  AllMembersColumns,
  AllMembersRows,
  AllMembersView,
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

test.describe('Multi-navigation benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('organizer workflow: projects → campaign → people → person', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    // --- Mock all endpoints needed for the full flow ---

    // Catch-all for common endpoints to prevent forwarding to real API
    moxy.setZetkinApiMock('/orgs', 'get', [KPD]);

    // Projects page
    const campaigns = [];
    for (let i = 1; i <= 20; i++) {
      campaigns.push({
        ...ReferendumSignatures,
        id: i,
        title: `Campaign ${i}: ${['Signatures', 'Canvassing', 'Phone banking', 'Survey', 'Rally'][i % 5]}`,
      });
    }
    moxy.setZetkinApiMock('/orgs/1/campaigns', 'get', campaigns);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/people/views', 'get', [AllMembersView]);

    // Campaign detail page
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
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', CampaignEvents);
    moxy.setZetkinApiMock('/orgs/1/emails', 'get', OrgEmails);
    moxy.setZetkinApiMock('/orgs/1/email_themes', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/email_configs', 'get', []);
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

    // People list page
    moxy.setZetkinApiMock('/orgs/1/people/views/1', 'get', AllMembersView);
    moxy.setZetkinApiMock('/orgs/1/people/views/1/rows', 'get', AllMembersRows);
    moxy.setZetkinApiMock('/orgs/1/people/views/1/columns', 'get', AllMembersColumns);
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', []);

    // Person detail page
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
      // Reset client state between iterations
      await page.goto('about:blank');

      // Step 1: Navigate to projects overview
      const navStart = Date.now();

      await page.goto(appUri + '/organize/1/projects');
      await page
        .locator('text=All Projects')
        .first()
        .waitFor({ state: 'visible' });
      const projectsLoaded = Date.now();
      measure('nav-projects-load', projectsLoaded - navStart);

      // Step 2: Click into campaign 1
      const campaignStart = Date.now();
      await page.goto(appUri + '/organize/1/projects/1');
      await page
        .locator('text=Deutsche Wohnen')
        .first()
        .waitFor({ state: 'visible' });
      const campaignLoaded = Date.now();
      measure('nav-campaign-load', campaignLoaded - campaignStart);

      // Step 3: Navigate to people list
      const listStart = Date.now();
      await page.goto(appUri + '/organize/1/people/lists/1');
      await page
        .locator('[role=row]')
        .first()
        .waitFor({ state: 'visible' });
      const listLoaded = Date.now();
      measure('nav-people-list-load', listLoaded - listStart);

      // Step 4: Navigate to person detail
      const personStart = Date.now();
      await page.goto(appUri + '/organize/1/people/1');
      await page
        .locator(`text=${RosaLuxemburg.first_name}`)
        .first()
        .waitFor({ state: 'visible' });
      const personLoaded = Date.now();
      measure('nav-person-detail-load', personLoaded - personStart);

      // Step 5: Navigate back to projects (full round-trip)
      const backStart = Date.now();
      await page.goto(appUri + '/organize/1/projects');
      await page
        .locator('text=All Projects')
        .first()
        .waitFor({ state: 'visible' });
      const backLoaded = Date.now();
      measure('nav-back-to-projects', backLoaded - backStart);

      // Total round-trip
      measure('nav-full-workflow', Date.now() - navStart);
    }
  });

  test('rapid page switching: campaign tabs', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    // Mock all campaign-related endpoints
    moxy.setZetkinApiMock('/orgs', 'get', [KPD]);
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
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', CampaignEvents);
    moxy.setZetkinApiMock('/orgs/1/emails', 'get', OrgEmails);
    moxy.setZetkinApiMock('/orgs/1/email_themes', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/email_configs', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
    moxy.setMock('/v2/orgs/1/area_assignments', 'get', {
      data: { data: [] },
    });
    for (const survey of CampaignSurveys.slice(0, 10)) {
      moxy.setZetkinApiMock(
        `/orgs/1/surveys/${survey.id}/submissions`,
        'get',
        generateSurveySubmissions(survey.id, 5)
      );
    }

    // Initial page load
    await page.goto(appUri + '/organize/1/projects/1');
    await page
      .locator('text=Deutsche Wohnen Enteignen')
      .first()
      .waitFor({ state: 'visible' });

    for (let i = 0; i < iterations; i++) {
      // Navigate overview → activities → archive → back to overview
      const start = Date.now();

      await page.goto(appUri + '/organize/1/projects/1/activities');
      await page
        .locator('text=Deutsche Wohnen')
        .first()
        .waitFor({ state: 'visible' });

      await page.goto(appUri + '/organize/1/projects/1/archive');
      await page
        .locator('text=Deutsche Wohnen')
        .first()
        .waitFor({ state: 'visible' });

      await page.goto(appUri + '/organize/1/projects/1');
      await page
        .locator('text=Deutsche Wohnen')
        .first()
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('rapid-tab-switching', duration);
    }
  });
});
