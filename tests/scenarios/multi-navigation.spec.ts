import test from '../fixtures';
import {
  AllMembersColumns,
  AllMembersRows,
  AllMembersView,
  AreaAssignments,
  CampaignCallAssignments,
  CampaignEvents,
  CampaignSurveys,
  EmailConfigs,
  EmailThemes,
  generateEmailStats,
  generateEventParticipants,
  generateEventResponses,
  generateSurveySubmissions,
  KPD,
  OrgEmails,
  OrgJourneys,
  OrgTags,
  OrgTasks,
  PeopleFields,
  PersonConnections,
  SPD,
  SPDOfficials,
  SPDSubOrganizations,
  PersonJourneyInstances,
  PersonTags,
  ReferendumSignatures,
  RosaLuxemburg,
  TagGroups,
  ViewFolders,
} from '../../mock-data';

test.describe('Multi-navigation benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    // Clear stale log entries from previous test's async cleanup
    moxy.clearLog();
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
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', OrgTasks);
    moxy.setZetkinApiMock('/orgs/1/people/views', 'get', [AllMembersView]);

    // Campaign detail page
    moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', ReferendumSignatures);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', CampaignEvents);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', OrgTasks);
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
    moxy.setZetkinApiMock('/orgs/1/email_themes', 'get', EmailThemes);
    moxy.setZetkinApiMock('/orgs/1/email_configs', 'get', EmailConfigs);
    moxy.setMock('/v2/orgs/1/area_assignments', 'get', {
      data: { data: AreaAssignments },
    });
    for (const survey of CampaignSurveys) {
      moxy.setZetkinApiMock(
        `/orgs/1/surveys/${survey.id}/submissions`,
        'get',
        generateSurveySubmissions(survey.id, 5)
      );
    }

    // Event participants/responses (rendered on campaign activities page)
    for (const event of CampaignEvents) {
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/participants`, 'get', generateEventParticipants(event.id, 3));
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/responses`, 'get', generateEventResponses(event.id, 5));
    }

    // People list page
    moxy.setZetkinApiMock('/orgs/1/people/views', 'get', [AllMembersView]);
    moxy.setZetkinApiMock('/orgs/1/people/views/1', 'get', AllMembersView);
    moxy.setZetkinApiMock('/orgs/1/people/views/1/rows', 'get', AllMembersRows);
    moxy.setZetkinApiMock('/orgs/1/people/views/1/columns', 'get', AllMembersColumns);
    moxy.setZetkinApiMock('/orgs/1/people/views/1/access', 'get', { level: 'admin' });
    moxy.setZetkinApiMock('/orgs/1/people/view_folders', 'get', ViewFolders);
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', PeopleFields);
    // People avatars (for rendered rows)
    for (let i = 1; i <= 10; i++) {
      moxy.setZetkinApiMock(`/orgs/1/people/${i}/avatar`, 'get', null, 204);
    }

    // Person detail page
    moxy.setZetkinApiMock('/orgs/1/people/1', 'get', RosaLuxemburg);
    moxy.setZetkinApiMock('/orgs/1/people/1/tags', 'get', PersonTags);
    moxy.setZetkinApiMock('/orgs/1/people/1/connections', 'get', PersonConnections);
    // Org 2 needed for PersonConnections
    moxy.setZetkinApiMock('/orgs/2', 'get', SPD);
    moxy.setZetkinApiMock('/orgs/2/avatar', 'get', null, 204);
    moxy.setZetkinApiMock('/orgs/2/officials', 'get', SPDOfficials);
    moxy.setZetkinApiMock('/orgs/2/sub_organizations', 'get', SPDSubOrganizations);
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
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', OrgTasks);
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
    moxy.setZetkinApiMock('/orgs/1/email_themes', 'get', EmailThemes);
    moxy.setZetkinApiMock('/orgs/1/email_configs', 'get', EmailConfigs);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', OrgTasks);
    moxy.setMock('/v2/orgs/1/area_assignments', 'get', {
      data: { data: AreaAssignments },
    });
    for (const survey of CampaignSurveys) {
      moxy.setZetkinApiMock(
        `/orgs/1/surveys/${survey.id}/submissions`,
        'get',
        generateSurveySubmissions(survey.id, 5)
      );
    }

    // Event participants/responses (activities/archive pages render these)
    for (const event of CampaignEvents) {
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/participants`, 'get', generateEventParticipants(event.id, 3));
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/responses`, 'get', generateEventResponses(event.id, 5));
    }

    // Email stats (rendered on campaign emails/archive tabs)
    for (const email of OrgEmails) {
      moxy.setZetkinApiMock(`/orgs/1/emails/${email.id}/stats`, 'get', generateEmailStats(email.id));
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
