import { expect } from '@playwright/test';

import test from '../fixtures';
import {
  KPD,
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
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/call_assignments', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/surveys', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
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
