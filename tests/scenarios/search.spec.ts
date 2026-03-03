import test from '../fixtures';
import {
  AllMembersView,
  AreaAssignments,
  CampaignCallAssignments,
  CampaignEvents,
  CampaignSurveys,
  ClaraZetkin,
  EmailConfigs,
  EmailThemes,
  generateEventParticipants,
  generateEventResponses,
  generateSurveySubmissions,
  KPD,
  OrgEmails,
  OrgTasks,
  PersonJourneyInstances,
  ReferendumSignatures,
  RosaLuxemburg,
} from '../../mock-data';

test.describe('Search benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
    // Clear stale log entries from previous test's async cleanup
    moxy.clearLog();
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('search dialog: type → results appear', async ({
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
    for (const event of CampaignEvents.slice(0, 10)) {
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/participants`, 'get', generateEventParticipants(event.id, 3));
      moxy.setZetkinApiMock(`/orgs/1/actions/${event.id}/responses`, 'get', generateEventResponses(event.id, 5));
    }
    // People avatars (for search result items)
    for (let i = 1; i <= 5; i++) {
      moxy.setZetkinApiMock(`/orgs/1/people/${i}/avatar`, 'get', null, 204);
    }

    // Mock ALL search endpoints (the dialog queries all of them)
    moxy.setZetkinApiMock('/orgs/1/search/person', 'post', [
      RosaLuxemburg,
      ClaraZetkin,
    ]);
    moxy.setZetkinApiMock('/orgs/1/search/campaign', 'post', [ReferendumSignatures]);
    moxy.setZetkinApiMock('/orgs/1/search/task', 'post', OrgTasks.slice(0, 3));
    moxy.setZetkinApiMock('/orgs/1/search/journeyinstance', 'post', PersonJourneyInstances.slice(0, 3));
    moxy.setZetkinApiMock('/orgs/1/search/view', 'post', [AllMembersView]);
    moxy.setZetkinApiMock('/orgs/1/search/callassignment', 'post', CampaignCallAssignments.slice(0, 3));
    moxy.setZetkinApiMock('/orgs/1/search/survey', 'post', CampaignSurveys.slice(0, 3));

    await page.goto(appUri + '/organize/1/projects/1');
    await page.locator('data-testid=page-title').waitFor({ state: 'visible' });

    for (let i = 0; i < iterations; i++) {
      // Open search dialog
      await page.click('data-testid=SearchDialog-activator');
      const searchField = page.locator('#SearchDialog-inputField');
      await searchField.waitFor({ state: 'visible' });

      // Measure: type query → results visible
      const start = Date.now();

      await searchField.fill('Rosa');

      // Wait for debounce + results to appear
      await page
        .locator('data-testid=SearchDialog-resultsListItem')
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 });

      const duration = Date.now() - start;
      measure('search-type-to-results', duration);

      // Close dialog (press Escape)
      await page.keyboard.press('Escape');
      // Wait for dialog to close before next iteration
      await searchField.waitFor({ state: 'hidden' });
    }
  });
});
