import test from '../fixtures';
import {
  KPD,
  OrgJourneys,
  PeopleFields,
  PersonConnections,
  PersonJourneyInstances,
  RosaLuxemburg,
  SPD,
  SPDOfficials,
  SPDSubOrganizations,
  TagGroups,
} from '../../mock-data';

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
    moxy.setZetkinApiMock('/orgs/1/people/1/connections', 'get', PersonConnections);
    moxy.setZetkinApiMock('/orgs/1/people/1/avatar', 'get', null, 204);
    // Org 2 needed for PersonConnections
    moxy.setZetkinApiMock('/orgs/2', 'get', SPD);
    moxy.setZetkinApiMock('/orgs/2/avatar', 'get', null, 204);
    moxy.setZetkinApiMock('/orgs/2/officials', 'get', SPDOfficials);
    moxy.setZetkinApiMock('/orgs/2/sub_organizations', 'get', SPDSubOrganizations);
    moxy.setZetkinApiMock('/orgs/1/people/tags', 'get', [PlaysGuitar]);
    moxy.setZetkinApiMock('/orgs/1/people/fields', 'get', PeopleFields);
    moxy.setZetkinApiMock('/orgs/1/tag_groups', 'get', TagGroups);
    moxy.setZetkinApiMock('/orgs/1/journeys', 'get', OrgJourneys);
    moxy.setZetkinApiMock('/orgs/1/people/1/journey_instances', 'get', PersonJourneyInstances);

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
