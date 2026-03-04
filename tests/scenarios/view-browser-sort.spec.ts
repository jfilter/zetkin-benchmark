import test from '../fixtures';
import {
  KPD,
  ManyViewFolders,
  ManyViews,
  PeopleFields,
  RosaLuxemburg,
} from '../../mock-data';

test.describe('View browser sort benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('sort by title → all 100 rows re-render', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    // 80 views + 20 folders = 100 rows in a non-virtualized DataGrid.
    // Clicking the "Title" column header calls setSortModel (React state
    // change), which re-sorts the rows array inside the render function
    // and re-renders every row + cell component.
    //
    // This is pure React render work — no CSS animations, no network.
    // The compiler auto-memoizes the renderCell callbacks and the
    // custom BrowserRow slot, skipping re-renders for unchanged rows.
    moxy.setZetkinApiMock('/orgs/1/people/views', 'get', ManyViews);
    moxy.setZetkinApiMock(
      '/orgs/1/people/view_folders',
      'get',
      ManyViewFolders
    );
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', PeopleFields);
    moxy.setZetkinApiMock(
      `/orgs/1/people/${RosaLuxemburg.id}/avatar`,
      'get',
      null,
      204
    );

    await page.goto(appUri + '/organize/1/people');

    // Wait for all DataGrid rows to be visible
    await page.locator('[role="row"]').first().waitFor({ state: 'visible' });

    // The title column header is sortable (cycles asc → desc → asc).
    // Default sort is asc, so first click → desc, second → asc, etc.
    const titleHeader = page.locator(
      '[role="columnheader"][data-field="title"]'
    );
    await titleHeader.waitFor({ state: 'visible' });

    for (let i = 0; i < iterations; i++) {
      // Record which sort indicator is currently shown so we can
      // detect when the sort completes (the aria-sort attribute changes)
      const sortBefore = await titleHeader.getAttribute('aria-sort');

      const start = Date.now();

      // Click title header to toggle sort direction
      await titleHeader.click();

      // Wait for the sort to complete: aria-sort attribute changes
      // on the column header (ascending ↔ descending)
      await page.waitForFunction(
        ({ field, prev }) => {
          const header = document.querySelector(
            `[role="columnheader"][data-field="${field}"]`
          );
          return header && header.getAttribute('aria-sort') !== prev;
        },
        { field: 'title', prev: sortBefore },
        { timeout: 5000 }
      );

      const duration = Date.now() - start;
      measure('view-browser-sort-title', duration);
    }
  });
});
