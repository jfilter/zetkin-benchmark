// Minimal mock data for benchmark scenarios.
// Adapted from app.zetkin.org/integrationTesting/mockData/

export const KPD = {
  avatar_file: null,
  country: 'SE',
  email: null,
  id: 1,
  is_active: false,
  is_open: false,
  is_public: true,
  lang: null,
  parent: null,
  phone: null,
  slug: 'slug',
  title: 'Kommunistiche Partei Deutschlands',
};

export const RosaLuxemburg = {
  alt_phone: '',
  city: 'Berlin',
  co_address: '',
  country: 'Germany',
  email: 'rosa@kpd.org',
  ext_id: '45',
  first_name: 'Rosa',
  gender: 'f',
  id: 1,
  is_user: false,
  last_name: 'Luxemburg',
  phone: '00497839571385',
  street_address: 'Alexanderstraße 15',
  zip_code: '10481',
};

export const RosaLuxemburgUser = {
  email: 'rosa@zetkin.org',
  email_is_verified: true,
  first_name: 'Rosa',
  id: 1,
  is_verified: true,
  lang: null,
  last_name: 'Luxemburg',
  phone: null,
  phone_is_verified: false,
  username: 'red_rosa',
};

export const Memberships = [
  {
    organization: KPD,
    profile: {
      id: RosaLuxemburg.id,
      name: RosaLuxemburg.first_name + ' ' + RosaLuxemburg.last_name,
    },
    role: 'admin' as const,
  },
];

export const ReferendumSignatures = {
  archived: false,
  color: '',
  id: 1,
  info_text:
    '20,000 signatures are needed to put the motion to expropriate mega landlords the people of Berlin.',
  manager: null,
  organization: KPD,
  published: true,
  title: 'Deutsche Wohnen Enteignen Signatures Collection',
  visibility: 'hidden',
};

export const AllMembersView = {
  content_query: null,
  created: '2021-11-21T12:53:15',
  description: 'All members in the KPD',
  folder: null,
  id: 1,
  organization: KPD,
  owner: {
    id: RosaLuxemburg.id,
    name: RosaLuxemburg.first_name + ' ' + RosaLuxemburg.last_name,
  },
  title: 'All KPD members',
};

export const AllMembersColumns = [
  {
    config: { field: 'first_name' },
    id: 1,
    title: 'First name',
    type: 'person_field',
  },
  {
    config: { field: 'last_name' },
    id: 2,
    title: 'Last name',
    type: 'person_field',
  },
  {
    id: 3,
    title: 'Active',
    type: 'local_bool',
  },
];

function generateRows(count: number) {
  const firstNames = [
    'Clara',
    'Rosa',
    'Karl',
    'August',
    'Wilhelm',
    'Ernst',
    'Franz',
    'Hugo',
    'Leo',
    'Paul',
    'Otto',
    'Friedrich',
    'Heinrich',
    'Hermann',
    'Walter',
    'Kurt',
    'Erich',
    'Hans',
    'Willy',
    'Rudolf',
  ];
  const lastNames = [
    'Zetkin',
    'Luxemburg',
    'Liebknecht',
    'Bebel',
    'Pieck',
    'Thälmann',
    'Mehring',
    'Haase',
    'Jogiches',
    'Levi',
    'Braun',
    'Engels',
    'Heckert',
    'Duncker',
    'Ulbricht',
    'Münzenberg',
    'Torgler',
    'Remmele',
    'Brandt',
    'Neumann',
  ];
  const rows = [];
  for (let i = 1; i <= count; i++) {
    rows.push({
      content: [
        firstNames[i % firstNames.length],
        lastNames[i % lastNames.length],
        i % 3 !== 0,
      ],
      id: i,
    });
  }
  return rows;
}

export const AllMembersRows = generateRows(500);

// --- Stress-test data generators ---

function generateEvents(count: number) {
  const events = [];
  const now = new Date();
  const activityTypes = [
    'Canvassing',
    'Phone banking',
    'Door knocking',
    'Leafleting',
    'Town hall',
    'Rally',
    'Workshop',
    'Meeting',
  ];
  const locations = [
    { id: 1, lat: 52.52, lng: 13.405, title: 'Alexanderplatz' },
    { id: 2, lat: 52.5163, lng: 13.3777, title: 'Brandenburg Gate' },
    { id: 3, lat: 52.5075, lng: 13.3903, title: 'Checkpoint Charlie' },
    { id: 4, lat: 52.5186, lng: 13.4081, title: 'Fernsehturm' },
    { id: 5, lat: 52.4934, lng: 13.4515, title: 'Treptower Park' },
  ];
  for (let i = 1; i <= count; i++) {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + Math.floor(i / 3));
    startDate.setHours(8 + (i % 10), 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 2, 0, 0, 0);
    events.push({
      activity: {
        id: (i % activityTypes.length) + 1,
        title: activityTypes[i % activityTypes.length],
      },
      campaign: { id: 1, title: ReferendumSignatures.title },
      cancelled: i % 20 === 0 ? '2024-06-01T00:00:00' : null,
      contact: i % 5 === 0 ? { id: 1, name: 'Rosa Luxemburg' } : null,
      end_time: endDate.toISOString(),
      id: 100 + i,
      info_text: `Event ${i}: ${activityTypes[i % activityTypes.length]} session in ${locations[i % locations.length].title}`,
      location: locations[i % locations.length],
      num_participants_available: i % 15,
      num_participants_required: 5 + (i % 10),
      organization: KPD,
      published: i % 10 === 0 ? null : '2024-01-01T00:00:00',
      start_time: startDate.toISOString(),
      title: i % 3 === 0 ? `Special event #${i}` : null,
      url: null,
    });
  }
  return events;
}

function generateCallAssignments(count: number) {
  const assignments = [];
  for (let i = 1; i <= count; i++) {
    assignments.push({
      campaign: { id: 1 },
      cooldown: 1 + (i % 5),
      description: `Call assignment ${i}: Contact members batch ${i}`,
      disable_caller_notes: i % 3 === 0,
      end_date: i % 4 === 0 ? '2025-12-31' : null,
      goal: { filter_spec: [], type: 'call_history' },
      id: i,
      instructions: `Script for batch ${i}: introduce yourself, ask about participation`,
      organization: KPD,
      start_date: '2024-01-01',
      target: { filter_spec: [], id: i },
      title: `Member Calls Batch ${i}`,
    });
  }
  return assignments;
}

function generateSurveys(count: number) {
  const surveys = [];
  const topics = [
    'Housing',
    'Healthcare',
    'Education',
    'Transport',
    'Environment',
    'Safety',
    'Employment',
  ];
  for (let i = 1; i <= count; i++) {
    surveys.push({
      access: i % 3 === 0 ? 'restricted' : 'open',
      allow_anonymous: i % 4 === 0,
      callers_only: i % 5 === 0,
      campaign: { id: 1 },
      id: i,
      info_text: `Survey about ${topics[i % topics.length]} - Wave ${Math.ceil(i / topics.length)}`,
      organization: KPD,
      published: i % 6 === 0 ? null : '2024-01-01',
      signature: i % 2 === 0 ? 'required' : 'allow',
      title: `${topics[i % topics.length]} Survey Wave ${Math.ceil(i / topics.length)}`,
    });
  }
  return surveys;
}

function generateEmails(count: number) {
  const subjects = [
    'Upcoming event reminder',
    'Weekly newsletter',
    'Action report',
    'Volunteer needed',
    'Meeting minutes',
    'Campaign update',
    'Thank you',
    'Important announcement',
  ];
  const emails = [];
  for (let i = 1; i <= count; i++) {
    emails.push({
      campaign: { id: 1 },
      id: i,
      locked: i % 8 === 0 ? '2024-06-01T12:00:00' : null,
      organization: KPD,
      processed: i % 3 === 0 ? '2024-06-15T14:00:00' : null,
      published: i % 4 === 0 ? '2024-06-10T10:00:00' : null,
      subject: `${subjects[i % subjects.length]} #${i}`,
      theme: null,
      title: `Email ${i}: ${subjects[i % subjects.length]}`,
    });
  }
  return emails;
}

export const CampaignEvents = generateEvents(150);
export const CampaignCallAssignments = generateCallAssignments(100);
export const CampaignSurveys = generateSurveys(100);
export const OrgEmails = generateEmails(200);

function generateTags(count: number) {
  const tagGroups = ['Skills', 'Interests', 'Roles', 'Status', 'Location'];
  const tags = [];
  for (let i = 1; i <= count; i++) {
    tags.push({
      description: `Tag ${i} description`,
      group: { id: (i % tagGroups.length) + 1, title: tagGroups[i % tagGroups.length] },
      hidden: i % 10 === 0,
      id: i,
      organization: KPD,
      title: `Tag ${i} - ${tagGroups[i % tagGroups.length]}`,
      value_type: i % 4 === 0 ? 'text' : null,
    });
  }
  return tags;
}

function generatePersonTags(tags: ReturnType<typeof generateTags>, count: number) {
  return tags.slice(0, count).map((tag) => ({
    ...tag,
    value: tag.value_type === 'text' ? 'Some value' : null,
  }));
}

function generateJourneys(count: number) {
  const journeys = [];
  for (let i = 1; i <= count; i++) {
    journeys.push({
      id: i,
      opening_note_template: '',
      organization: KPD,
      plural_label: `Journey type ${i} items`,
      singular_label: `Journey type ${i}`,
      stats: { closed: i * 2, open: i * 3 },
      title: `Journey Type ${i}`,
    });
  }
  return journeys;
}

function generateJourneyInstances(count: number) {
  const instances = [];
  for (let i = 1; i <= count; i++) {
    instances.push({
      assignees: [{ id: 1, first_name: 'Rosa', last_name: 'Luxemburg' }],
      closed: i % 3 === 0 ? '2024-06-01' : null,
      created: '2024-01-01',
      id: i,
      journey: { id: (i % 5) + 1, title: `Journey Type ${(i % 5) + 1}` },
      milestones: [],
      next_milestone: null,
      num_milestones_total: 5,
      num_milestones_completed: i % 5,
      opening_note: `Instance ${i} note`,
      organization: KPD,
      outcome: i % 3 === 0 ? 'Completed successfully' : null,
      subjects: [{ id: 1, first_name: 'Rosa', last_name: 'Luxemburg' }],
      summary: `Journey instance ${i}`,
      tags: [],
      title: `Case #${i}`,
      updated: '2024-06-01',
    });
  }
  return instances;
}

function generateSurveySubmissions(surveyId: number, count: number) {
  const submissions = [];
  for (let i = 1; i <= count; i++) {
    const submitted = new Date('2024-06-01');
    submitted.setDate(submitted.getDate() + i);
    submissions.push({
      id: surveyId * 100 + i,
      organization: { id: KPD.id, title: KPD.title },
      respondent:
        i % 3 === 0
          ? null
          : {
              email: `respondent${i}@example.org`,
              first_name: `Respondent`,
              id: i % 5 === 0 ? null : i,
              last_name: `${surveyId}-${i}`,
            },
      survey: { id: surveyId, title: `Survey ${surveyId}` },
      submitted: submitted.toISOString(),
    });
  }
  return submissions;
}

export { generateSurveySubmissions };

export const OrgTags = generateTags(150);
export const PersonTags = generatePersonTags(OrgTags, 30);
export const TagGroups = [
  { id: 1, title: 'Skills' },
  { id: 2, title: 'Interests' },
  { id: 3, title: 'Roles' },
  { id: 4, title: 'Status' },
  { id: 5, title: 'Location' },
];
export const OrgJourneys = generateJourneys(20);
export const PersonJourneyInstances = generateJourneyInstances(50);

export const ClaraZetkin = {
  alt_phone: '',
  city: 'Berlin',
  co_address: '',
  country: 'Germany',
  email: 'clara@kpd.org',
  ext_id: '46',
  first_name: 'Clara',
  gender: 'f',
  id: 2,
  is_user: false,
  last_name: 'Zetkin',
  phone: '00497839571386',
  street_address: 'Friedrichstraße 10',
  zip_code: '10117',
};
