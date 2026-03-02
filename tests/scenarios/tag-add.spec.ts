import test from '../fixtures';
import { KPD, RosaLuxemburg } from '../../mock-data';

const PlaysGuitar = {
  color: null,
  description: '',
  group: null,
  hidden: false,
  id: 2,
  organization: { id: KPD.id, title: KPD.title },
  title: 'Plays Guitar',
  value_type: null,
};

test.describe('Tag add benchmark', () => {
  test.beforeEach(({ login, moxy }) => {
    login();
    moxy.setZetkinApiMock('/orgs/1', 'get', KPD);
  });

  test.afterEach(({ moxy }) => {
    moxy.teardown();
  });

  test('add tag: click add → select tag → tag appears', async ({
    page,
    appUri,
    moxy,
    iterations,
    measure,
  }) => {
    moxy.setZetkinApiMock('/orgs/1/people/1', 'get', RosaLuxemburg);
    moxy.setZetkinApiMock('/orgs/1/people/tags', 'get', [PlaysGuitar]);
    moxy.setZetkinApiMock('/orgs/1/tag_groups', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/journeys', 'get', []);
    moxy.setZetkinApiMock('/orgs/1/people/1/journey_instances', 'get', []);

    for (let i = 0; i < iterations; i++) {
      // Reset tags state for each iteration
      moxy.setZetkinApiMock('/orgs/1/people/1/tags', 'get', []);
      moxy.setZetkinApiMock('/orgs/1/people/1/tags/2', 'put', undefined, 201);

      // Reset client state between iterations
      await page.goto('about:blank');
      await page.goto(appUri + '/organize/1/people/1');
      const addTagButton = page.locator('text=Add tag');
      await addTagButton.waitFor({ state: 'visible' });

      // Measure: click "Add tag" → select tag → tag visible on page
      const start = Date.now();

      await addTagButton.click();

      // Wait for tag option to appear, then click it
      const tagOption = page.locator(`text=${PlaysGuitar.title}`).first();
      await tagOption.waitFor({ state: 'visible' });
      await tagOption.click();

      // Wait for tag to appear on the page (after PUT request)
      // Update the mock to return the tag now
      moxy.setZetkinApiMock('/orgs/1/people/1/tags', 'get', [PlaysGuitar]);

      await page
        .locator(`text=${PlaysGuitar.title}`)
        .first()
        .waitFor({ state: 'visible' });

      const duration = Date.now() - start;
      measure('tag-add-interaction', duration);
    }
  });
});
