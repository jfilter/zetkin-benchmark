import test from '../fixtures';
import {
  KPD,
  ReferendumSignatures,
  RosaLuxemburg,
  ClaraZetkin,
} from '../../mock-data';

test.describe('Search benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
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
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/actions', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/campaigns/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/call_assignments', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/surveys', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/tasks', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/actions', 'get', []);

    // Mock ALL search endpoints (the dialog queries all of them)
    moxy.setZetkinApiMock('/orgs/1/search/person', 'post', [
      RosaLuxemburg,
      ClaraZetkin,
    ]);
    moxy.setZetkinApiMock('/orgs/1/search/campaign', 'post', []);
    moxy.setZetkinApiMock('/orgs/1/search/task', 'post', []);
    moxy.setZetkinApiMock('/orgs/1/search/journeyinstance', 'post', []);
    moxy.setZetkinApiMock('/orgs/1/search/view', 'post', []);
    moxy.setZetkinApiMock('/orgs/1/search/callassignment', 'post', []);
    moxy.setZetkinApiMock('/orgs/1/search/survey', 'post', []);

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
