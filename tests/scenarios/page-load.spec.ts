import test from '../fixtures';
import {
  AreaAssignments,
  CampaignCallAssignments,
  CampaignEvents,
  CampaignSurveys,
  EmailConfigs,
  EmailThemes,
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
} from '../../mock-data';

test.describe('Page load benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    // Clear stale log entries from previous test's async cleanup
    moxy.clearLog();
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
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', OrgTasks);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/surveys', 'get', CampaignSurveys);
    moxy.setZetkinApiMock(
      '/orgs/1/campaigns/1/call_assignments',
      'get',
      CampaignCallAssignments
    );
    moxy.setZetkinApiMock('/orgs/1/call_assignments', 'get', CampaignCallAssignments);
    moxy.setZetkinApiMock('/orgs/1/surveys', 'get', CampaignSurveys);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', OrgTasks);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', CampaignEvents);
    moxy.setZetkinApiMock('/orgs/1/emails', 'get', OrgEmails);
    moxy.setZetkinApiMock('/orgs/1/email_themes', 'get', EmailThemes);
    moxy.setZetkinApiMock('/orgs/1/email_configs', 'get', EmailConfigs);
    // API v2 endpoint for area assignments
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
    // Event participants/responses (rendered on campaign page)
    for (const event of CampaignEvents) {
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/participants`, 'get', generateEventParticipants(event.id, 3));
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/responses`, 'get', generateEventResponses(event.id, 5));
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
    moxy.setZetkinApiMock('/orgs/1/people/1/connections', 'get', PersonConnections);
    moxy.setZetkinApiMock('/orgs/1/people/1/avatar', 'get', null, 204);
    // Org 2 needed for PersonConnections
    moxy.setZetkinApiMock('/orgs/2', 'get', SPD);
    moxy.setZetkinApiMock('/orgs/2/avatar', 'get', null, 204);
    moxy.setZetkinApiMock('/orgs/2/officials', 'get', SPDOfficials);
    moxy.setZetkinApiMock('/orgs/2/sub_organizations', 'get', SPDSubOrganizations);
    moxy.setZetkinApiMock('/orgs/1/people/tags', 'get', OrgTags);
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', PeopleFields);
    moxy.setZetkinApiMock('/orgs/1/tag_groups', 'get', TagGroups);
    moxy.setZetkinApiMock('/orgs/1/journeys', 'get', OrgJourneys);
    moxy.setZetkinApiMock(
      '/orgs/1/people/1/journey_instances',
      'get',
      PersonJourneyInstances
    );
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/call_assignments', 'get', CampaignCallAssignments);

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
