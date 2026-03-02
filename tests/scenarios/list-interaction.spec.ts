import test from '../fixtures';
import {
  KPD,
  AllMembersView,
  AllMembersColumns,
  AllMembersRows,
} from '../../mock-data';

test.describe('List interaction benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('select row → bulk action bar appears', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    moxy.setZetkinApiMock('/orgs/1/people/views/1', 'get', AllMembersView);
    moxy.setZetkinApiMock(
      '/orgs/1/people/views/1/rows',
      'get',
      AllMembersRows
    );
    moxy.setZetkinApiMock(
      '/orgs/1/people/views/1/columns',
      'get',
      AllMembersColumns
    );
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', []);

    await page.goto(appUri + '/organize/1/people/lists/1');
    await page
      .locator('[role=row]')
      .first()
      .waitFor({ state: 'visible' });

    for (let i = 0; i < iterations; i++) {
      const checkbox = page
        .locator('[role=row] input[type=checkbox]')
        .first();

      // Measure: click checkbox → bulk action bar visible
      const start = Date.now();

      await checkbox.click();
      await page
        .locator('button:has-text("handle selection")')
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('list-select-to-bulk-bar', duration);

      // Uncheck to reset for next iteration
      await checkbox.click();
      await page
        .locator('button:has-text("handle selection")')
        .waitFor({ state: 'hidden' });
    }
  });
});
