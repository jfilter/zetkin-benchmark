import { expect } from '@playwright/test';

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
  OrgTasks,
  ReferendumSignatures,
  RosaLuxemburg,
} from '../../mock-data';

test.describe('Form submit benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('edit campaign title: submit → UI update', async ({
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
    moxy.setZetkinApiMock('/orgs/1/search/person', 'post', [RosaLuxemburg]);

    await page.goto(appUri + '/organize/1/projects/1');
    await page.locator('data-testid=page-title').waitFor({ state: 'visible' });

    for (let i = 0; i < iterations; i++) {
      const newTitle = `Edited Title ${i}`;

      moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'patch', {
        ...ReferendumSignatures,
        title: newTitle,
      });

      // Update GET mock so revalidation returns new title
      moxy.setZetkinApiMock('/orgs/1/campaigns/1', 'get', {
        ...ReferendumSignatures,
        title: newTitle,
      });

      // Open edit modal
      await page.click(
        'header [data-testid=ZUIEllipsisMenu-menuActivator]'
      );
      await page.click('data-testid=ZUIEllipsisMenu-item-editCampaign');

      // Fill in new title
      await page.fill('#title', newTitle);

      // Measure: submit → title visible on page
      const start = Date.now();

      await Promise.all([
        page.waitForResponse('**/orgs/1/campaigns/1'),
        page.click('button:text("Submit")'),
      ]);

      const campaignTitle = page.locator('data-testid=page-title');
      await expect(campaignTitle).toContainText(newTitle, { timeout: 10_000 });

      const duration = Date.now() - start;
      measure('form-submit-campaign-title', duration);
    }
  });
});
