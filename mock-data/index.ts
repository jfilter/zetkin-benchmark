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

// --- Tasks ---

function generateTasks(count: number) {
  const taskNames = [
    'Distribute flyers',
    'Share campaign post',
    'Attend volunteer briefing',
    'Collect petition signatures',
    'Call new members',
    'Update contact info',
    'Write testimony',
  ];
  const taskTypes = ['offline', 'share_link', 'visit_link'];
  const tasks = [];
  for (let i = 1; i <= count; i++) {
    const deadline = new Date('2025-06-01');
    deadline.setDate(deadline.getDate() + i * 7);
    tasks.push({
      campaign: { id: 1, title: ReferendumSignatures.title },
      deadline: i % 3 === 0 ? deadline.toISOString() : null,
      expires: null,
      id: i,
      instructions: `Instructions for: ${taskNames[i % taskNames.length]}`,
      organization: KPD,
      published: i % 5 === 0 ? null : '2024-01-01T00:00:00',
      reassign_interval: 1,
      reassign_limit: 3,
      target: { filter_spec: [], id: i },
      time_estimate: 15 + (i % 4) * 15,
      title: `${taskNames[i % taskNames.length]} #${i}`,
      type: taskTypes[i % taskTypes.length],
    });
  }
  return tasks;
}

export const OrgTasks = generateTasks(30);

// --- Event participants & responses ---

const participantNames = [
  'Clara Zetkin',
  'Karl Liebknecht',
  'August Bebel',
  'Wilhelm Pieck',
  'Ernst Thälmann',
];

function generateEventParticipants(eventId: number, count: number) {
  const participants = [];
  for (let i = 1; i <= count; i++) {
    participants.push({
      action_id: eventId,
      cancelled: null,
      id: eventId * 100 + i,
      person: { id: i, name: participantNames[i % participantNames.length] },
      status: null,
    });
  }
  return participants;
}

function generateEventResponses(eventId: number, count: number) {
  const responses = [];
  for (let i = 1; i <= count; i++) {
    const date = new Date('2024-06-01');
    date.setDate(date.getDate() + i);
    responses.push({
      action_id: eventId,
      id: eventId * 100 + i,
      person: { id: i, name: participantNames[i % participantNames.length] },
      response_date: date.toISOString(),
    });
  }
  return responses;
}

export { generateEventParticipants, generateEventResponses };

// --- People fields ---

export const PeopleFields = [
  {
    id: 1, description: '', organization: KPD, slug: 'membership_type',
    title: 'Membership Type', type: 'enum', org_read: 'sameorg', org_write: 'sameorg',
    enum_choices: [
      { key: 'full', label: 'Full member' },
      { key: 'associate', label: 'Associate member' },
      { key: 'supporter', label: 'Supporter' },
    ],
  },
  { id: 2, description: '', organization: KPD, slug: 'join_date', title: 'Join Date', type: 'date', org_read: 'sameorg', org_write: 'sameorg' },
  { id: 3, description: 'Internal notes', organization: KPD, slug: 'notes', title: 'Notes', type: 'text', org_read: 'sameorg', org_write: 'sameorg' },
  { id: 4, description: '', organization: KPD, slug: 'website', title: 'Website', type: 'url', org_read: 'sameorg', org_write: 'sameorg' },
  { id: 5, description: 'Additional metadata', organization: KPD, slug: 'extra_data', title: 'Extra Data', type: 'json', org_read: 'sameorg', org_write: 'sameorg' },
];

// --- View folders ---

export const ViewFolders = [
  { id: 1, organization: KPD, parent: null, title: 'Active Members' },
  { id: 2, organization: KPD, parent: null, title: 'Campaign Targets' },
  { id: 3, organization: KPD, parent: { id: 1 }, title: 'Regional Lists' },
];

// --- Large view browser data (for lists overview benchmarks) ---

const viewNames = [
  'Members', 'Volunteers', 'Donors', 'Activists', 'Supporters',
  'Newsletter', 'Event attendees', 'Phone bankers', 'Canvassers', 'Organizers',
  'Board members', 'Committee', 'Delegates', 'Interns', 'Alumni',
  'New signups', 'Lapsed members', 'High-value', 'At-risk', 'Prospects',
];

const folderNames = [
  'Campaigns', 'Regional', 'Demographics', 'Outreach', 'Internal',
  'Archive', 'Fundraising', 'Events', 'Training', 'Committees',
];

function generateViewBrowserFolders(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: 100 + i,
    organization: KPD,
    parent: null,
    title: `${folderNames[i % folderNames.length]} ${Math.floor(i / folderNames.length) + 1}`,
  }));
}

function generateViewBrowserViews(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    content_query: null,
    created: '2021-11-21T12:53:15',
    description: `View ${i + 1}`,
    folder: null,
    id: 200 + i,
    organization: KPD,
    owner: {
      id: RosaLuxemburg.id,
      name: RosaLuxemburg.first_name + ' ' + RosaLuxemburg.last_name,
    },
    title: `${viewNames[i % viewNames.length]} ${Math.floor(i / viewNames.length) + 1}`,
  }));
}

export const ManyViewFolders = generateViewBrowserFolders(20);
export const ManyViews = generateViewBrowserViews(80);

// --- Person connections ---

// The person must be connected to the main org (1) so that PersonOrganizationsCard
// can build a valid tree. Additional connections to other orgs are fine.
export const PersonConnections = [
  {
    follow: true,
    organization: { id: KPD.id, title: KPD.title },
    profile: { id: 1, name: 'Rosa Luxemburg' },
    role: 'admin',
  },
  {
    follow: false,
    organization: { id: 2, title: 'Sozialdemokratische Partei Deutschlands' },
    profile: { id: 1, name: 'Rosa Luxemburg' },
    role: null,
  },
];

export const SPD = {
  avatar_file: null,
  country: 'DE',
  email: null,
  id: 2,
  is_active: true,
  is_open: false,
  is_public: true,
  lang: null,
  parent: null,
  phone: null,
  slug: 'spd',
  title: 'Sozialdemokratische Partei Deutschlands',
};

// --- Email themes ---

export const EmailThemes = [
  { id: 1, organization: KPD, title: 'Default Theme' },
  { id: 2, organization: KPD, title: 'Campaign Theme' },
];

// --- Email stats generator ---

export function generateEmailStats(emailId: number) {
  const sent = 50 + ((emailId * 7) % 200);
  return {
    num_blocked: emailId % 8,
    num_clicked: { link: Math.floor(sent * 0.15) + (emailId % 10) },
    num_opened: Math.floor(sent * 0.45) + (emailId % 20),
    num_sent: sent,
    num_target: {
      email: sent + (emailId % 15),
      filter: Math.floor(sent * 0.3),
      query: sent + Math.floor(sent * 0.3),
    },
  };
}

// --- Officials ---

export const OrgOfficials = [
  { id: RosaLuxemburg.id, first_name: 'Rosa', last_name: 'Luxemburg', role: 'admin' },
  { id: 2, first_name: 'Clara', last_name: 'Zetkin', role: 'organizer' },
  { id: 3, first_name: 'Karl', last_name: 'Liebknecht', role: 'organizer' },
];

export const SPDOfficials = [
  { id: 10, first_name: 'Friedrich', last_name: 'Ebert', role: 'admin' },
  { id: 11, first_name: 'Philipp', last_name: 'Scheidemann', role: 'organizer' },
];

// --- Sub-organizations ---

export const SubOrganizations = [
  { ...KPD, id: 10, title: 'KPD Berlin-Mitte', parent: { id: 1 } },
  { ...KPD, id: 11, title: 'KPD Kreuzberg', parent: { id: 1 } },
];

export const SPDSubOrganizations = [
  { ...SPD, id: 20, title: 'SPD Berlin', parent: { id: 2 } },
];

// --- Email configs ---

export const EmailConfigs = [
  {
    id: 1,
    organization: KPD,
    from_name: 'KPD Berlin',
    from_address: 'info@kpd.org',
    reply_to_address: 'reply@kpd.org',
  },
];

// --- Area assignments (v2 format) ---

export const AreaAssignments = [
  {
    id: 1,
    organization_id: KPD.id,
    project_id: 1,
    title: 'Canvassing District Mitte',
    instructions: 'Door-to-door in central Berlin',
    reporting_level: 'household' as const,
    start_date: '2024-06-01',
    end_date: '2024-12-31',
  },
  {
    id: 2,
    organization_id: KPD.id,
    project_id: 1,
    title: 'Canvassing District Kreuzberg',
    instructions: 'Community outreach in Kreuzberg',
    reporting_level: 'location' as const,
    start_date: '2024-06-01',
    end_date: null,
  },
];

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
