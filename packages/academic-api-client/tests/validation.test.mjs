import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AcademicApiValidationError,
  parsePublicAvailabilityList,
  parsePublicCalendarSettingsResponse,
  parsePublicConferenceList,
  parsePublicPaperList,
  parsePublicPaperMilestoneList,
  parsePublicPlanningAllocationList,
  parsePublicProjectList,
  parsePublicExternalPublicationList,
  parsePublicProjectPublicationList,
  parsePublicSoftwareList,
  parsePublicTeachingList,
  parsePublicTeachingSettingsResponse,
  parsePublicWorkAnalytics,
} from '../../../node_modules/.cache/academic-api-client/index.js'


const milestone = {
  target_date: '2026-11-10',
  completed_on: null,
  status: 'planned',
  committed_days: 5,
  paper_slug: null,
  flowsavvy_added: true,
  flowsavvy_added_at: '2026-11-01T12:30:00+00:00',
  title: 'Revise theoretical framework',
  paper_title: 'Working Paper (private)',
}

const planningAllocation = {
  period_start: '2026-11-01',
  period_end: '2026-11-15',
  allocation_type: 'paper',
  blocked_type: null,
  committed_days: 5,
  paper_slug: null,
  superseded_by_milestone: false,
}

test('validates public milestone and allocation records without requiring public Paper slugs', () => {
  assert.deepEqual(parsePublicPaperMilestoneList([milestone]), [milestone])
  assert.deepEqual(parsePublicPlanningAllocationList([planningAllocation]), [planningAllocation])
  assert.deepEqual(parsePublicPaperMilestoneList([]), [])
  assert.deepEqual(parsePublicPlanningAllocationList([]), [])
  assert.deepEqual(
    parsePublicPlanningAllocationList([{
      ...planningAllocation,
      allocation_type: 'blocked',
      blocked_type: 'teaching',
    }]).length,
    1
  )
})

test('rejects unsafe or malformed milestone and allocation responses', () => {
  assert.throws(
    () => parsePublicPaperMilestoneList([{...milestone, paper_id: 'private-uuid'}]),
    /unexpected object shape/
  )
  assert.throws(
    () => parsePublicPaperMilestoneList([{...milestone, paper_title: ''}]),
    /paper_title/
  )
  assert.throws(
    () => parsePublicPaperMilestoneList([{...milestone, flowsavvy_added_at: null}]),
    /flowsavvy_added_at/
  )
  assert.throws(
    () => parsePublicPaperMilestoneList([{...milestone, committed_days: 7}]),
    /committed_days/
  )
  assert.throws(
    () => parsePublicPlanningAllocationList([{...planningAllocation, notes: 'private'}]),
    /unexpected object shape/
  )
  assert.throws(
    () => parsePublicPlanningAllocationList([{
      ...planningAllocation,
      allocation_type: 'blocked',
      blocked_type: 'administrative',
      superseded_by_milestone: true,
    }]),
    /allocation_type/
  )
  assert.throws(
    () => parsePublicPlanningAllocationList([{...planningAllocation, period_end: '2026-10-31'}]),
    /period_end/
  )
})

function calendarDays(year) {
  const days = []
  const current =
    new Date(Date.UTC(year, 0, 1, 12))

  while (
    current.getUTCFullYear() === year
  ) {
    days.push({
      date:
        current
          .toISOString()
          .slice(0, 10),
      net_minutes: 0,
      coffee_count: 0,
    })
    current.setUTCDate(
      current.getUTCDate() + 1
    )
  }

  return days
}

function workPayload(year = 2026) {
  return {
    year,
    average_net_minutes_per_working_day: 360,
    average_coffees_per_working_day: 2.5,
    days: calendarDays(year),
  }
}

const conference = {
  event_name: 'Conference',
  event_short_name: 'CONF',
  location: null,
  presentation_date: '2026-09-01',
  start_date: '2026-09-01',
  end_date: '2026-09-02',
  personal_attendance: true,
  involves_trip: true,
  presentation_title: null,
  authors: ['A. Author'],
  presentation_type: 'Conference paper',
  url: 'https://example.org/conference',
}

const paper = {
  slug: 'paper',
  title: 'Paper',
  authors: ['A. Author'],
  abstract: null,
  venue: null,
  publication_date: null,
  doi_url: null,
  publication_url: null,
  preprint_url: null,
  github_url: null,
  dataset_url: null,
  featured: false,
  publication_index: null,
  language: null,
  google_scholar_citations: null,
  google_scholar_citations_captured_on: null,
  project_url: null,
  si_file_url: null,
}

const project = {
  slug: 'project',
  short_title: 'Project',
  title: 'Project title',
  abstract: 'Abstract',
  role: 'Principal Investigator',
  funder: 'Funder',
  funder_note: null,
  url: 'https://example.org/project',
  start_year: 2025,
  end_year: 2026,
  status: 'active',
  featured: false,
  project_image_filename: null,
  funder_image_filename: null,
  publication_slugs: ['paper'],
  conference_presentations: [conference],
}

const software = {
  slug: 'research-dashboard',
  name: 'Research Dashboard',
  short_description:
    'Academic research management software.',
  category: 'Application',
  current_version: 'v1.0.0-rc.2',
  development_stage:
    'Release candidate',
  status: 'active',
  repository_visibility: 'public',
  repository_url:
    'https://github.com/example/research-dashboard',
  production_url:
    'https://dashboard.example.org',
  documentation_url:
    'https://dashboard.example.org/api',
  start_year: 2026,
  end_year: null,
  featured: true,
}

const teaching = {
  slug: null,
  name: 'Course',
  institution: 'University',
  summary: 'Summary',
  role: 'Lecturer',
  start_year: 2025,
  end_year: null,
  is_current: true,
  levels: ['master'],
  times_taught: 1,
  student_count: 10,
  course_image_filename: null,
}

test('accepts valid representative Public RPC resources', () => {
  assert.deepEqual(
    parsePublicPaperList([paper]),
    [paper]
  )
  assert.deepEqual(
    parsePublicConferenceList([conference]),
    [conference]
  )
  assert.deepEqual(
    parsePublicProjectList([project]),
    [project]
  )
  assert.deepEqual(
    parsePublicTeachingList([teaching]),
    [teaching]
  )
  assert.deepEqual(
    parsePublicSoftwareList([software]),
    [software]
  )
  assert.deepEqual(
    parsePublicTeachingSettingsResponse([
      {
        teaching_season_active: true,
      },
    ]),
    {
      teaching_season_active: true,
    }
  )
  assert.deepEqual(
    parsePublicCalendarSettingsResponse([
      {
        catholic_calendar_active: true,
        stress_test_active: false,
      },
    ]),
    {
      catholic_calendar_active: true,
      stress_test_active: false,
    }
  )
  assert.deepEqual(
    parsePublicWorkAnalytics(
      workPayload(2026),
      2026
    ),
    workPayload(2026)
  )

  const availability = [
    {
      type: 'trip',
      start_date: '2026-09-01',
      end_date: '2026-09-04',
      label: 'CONF',
    },
    {
      type: 'unavailable',
      start_date: '2026-10-02',
      end_date: '2026-10-02',
      label: 'Unavailable',
    },
  ]

  assert.deepEqual(
    parsePublicAvailabilityList(
      availability,
      2026
    ),
    availability
  )
})

test('rejects unexpected fields instead of silently accepting drift', () => {
  assert.throws(
    () =>
      parsePublicPaperList([
        {
          ...paper,
          private_note: 'no',
        },
      ]),
    (error) =>
      error instanceof
        AcademicApiValidationError &&
      error.message.includes(
        'unexpected object shape'
      )
  )
})

test('rejects malformed URLs and unknown controlled values', () => {
  assert.throws(
    () =>
      parsePublicPaperList([
        {
          ...paper,
          github_url: 'not-a-url',
        },
      ]),
    /github_url/
  )

  assert.throws(
    () =>
      parsePublicProjectList([
        {
          ...project,
          role: 'Unknown role',
        },
      ]),
    /role/
  )

  assert.throws(
    () =>
      parsePublicSoftwareList([
        {
          ...software,
          development_stage:
            'Prototype',
        },
      ]),
    /development_stage/
  )

  assert.throws(
    () =>
      parsePublicSoftwareList([
        {
          ...software,
          repository_visibility:
            'private',
        },
      ]),
    /repository_url/
  )

  assert.throws(
    () =>
      parsePublicSoftwareList([
        {
          ...software,
          end_year: 2025,
        },
      ]),
    /end_year/
  )
})

test('rejects invalid project and conference ranges', () => {
  assert.throws(
    () =>
      parsePublicProjectList([
        {
          ...project,
          start_year: 2026,
          end_year: 2025,
        },
      ]),
    /end_year/
  )

  assert.throws(
    () =>
      parsePublicConferenceList([
        {
          ...conference,
          end_date: '2026-08-31',
        },
      ]),
    /end_date/
  )
})

test('rejects inconsistent attendance and malformed availability', () => {
  assert.throws(
    () =>
      parsePublicConferenceList([
        {
          ...conference,
          personal_attendance: false,
          involves_trip: true,
        },
      ]),
    /personal_attendance/
  )

  assert.throws(
    () =>
      parsePublicAvailabilityList(
        [
          {
            type: 'trip',
            start_date: '2026-12-31',
            end_date: '2027-01-01',
            label: 'CONF',
          },
        ],
        2026
      ),
    /outside requested year/
  )

  assert.throws(
    () =>
      parsePublicAvailabilityList(
        [
          {
            type: 'unavailable',
            start_date: '2026-05-01',
            end_date: '2026-05-01',
            label: 'Sick',
          },
        ],
        2026
      ),
    /must be "Unavailable"/
  )

  const duplicate = {
    type: 'winter_holiday',
    start_date: '2026-12-20',
    end_date: '2026-12-31',
    label: 'Winter holiday',
  }

  assert.throws(
    () =>
      parsePublicAvailabilityList(
        [duplicate, duplicate],
        2026
      ),
    /duplicate range/
  )
})

test('rejects invalid teaching invariants and duplicate levels', () => {
  assert.throws(
    () =>
      parsePublicTeachingList([
        {
          ...teaching,
          is_current: false,
        },
      ]),
    /end_year/
  )

  assert.throws(
    () =>
      parsePublicTeachingList([
        {
          ...teaching,
          levels: [
            'master',
            'master',
          ],
        },
      ]),
    /unique/
  )
})

test('applies strict complete-year work analytics validation', () => {
  const malformedDate =
    workPayload(2026)
  malformedDate.days[59].date =
    '2026-02-30'
  assert.throws(
    () =>
      parsePublicWorkAnalytics(
        malformedDate,
        2026
      ),
    /valid YYYY-MM-DD/
  )

  const duplicate =
    workPayload(2026)
  duplicate.days.push({
    ...duplicate.days[0],
  })
  assert.throws(
    () =>
      parsePublicWorkAnalytics(
        duplicate,
        2026
      ),
    /duplicate date/
  )

  const incomplete =
    workPayload(2026)
  incomplete.days.pop()
  assert.throws(
    () =>
      parsePublicWorkAnalytics(
        incomplete,
        2026
      ),
    /365 unique calendar days/
  )

  const negative =
    workPayload(2026)
  negative.days[0].coffee_count = -1
  assert.throws(
    () =>
      parsePublicWorkAnalytics(
        negative,
        2026
      ),
    /coffee_count/
  )

  assert.throws(
    () =>
      parsePublicWorkAnalytics(
        workPayload(2026),
        2025
      ),
    /requested year 2025/
  )
})


test('validates the singleton Teaching settings contract', () => {
  assert.throws(
    () =>
      parsePublicTeachingSettingsResponse([]),
    /expected exactly one row/
  )

  assert.throws(
    () =>
      parsePublicTeachingSettingsResponse([
        {
          teaching_season_active:
            'yes',
        },
      ]),
    /teaching_season_active/
  )
})

test('validates the singleton Calendar settings contract', () => {
  assert.throws(
    () =>
      parsePublicCalendarSettingsResponse([]),
    /expected exactly one row/
  )

  assert.throws(
    () =>
      parsePublicCalendarSettingsResponse([
        {
          catholic_calendar_active:
            'yes',
          stress_test_active:
            false,
        },
      ]),
    /catholic_calendar_active/
  )

  assert.throws(
    () =>
      parsePublicCalendarSettingsResponse([
        {
          catholic_calendar_active:
            true,
          stress_test_active:
            'yes',
        },
      ]),
    /stress_test_active/
  )
})

test('accepts Guest lecture as a controlled Conference presentation type', () => {
  assert.deepEqual(
    parsePublicConferenceList([{ ...conference, presentation_type: 'Guest lecture' }])[0].presentation_type,
    'Guest lecture'
  )
})

const ownProjectPublication = {
  project_slug: 'time-use',
  authorship: 'own',
  publication_slug: 'public-paper',
  title: 'Public paper',
  authors: ['Bastián González-Bustamante'],
  venue: 'Journal',
  publication_date: '2026-03-01',
  publication_year: 2026,
  doi_url: 'https://doi.org/10.1000/example',
  publication_url: null,
  language: 'English',
}

const externalProjectPublication = {
  ...ownProjectPublication,
  authorship: 'external',
  publication_slug: 'partner-study',
  title: 'Related study by project partners',
  authors: ['A. Partner', 'B. Partner'],
  publication_date: null,
  publication_year: 2025,
  doi_url: null,
  publication_url: 'https://example.org/report',
  language: null,
}

test('validates own and external project publications', () => {
  const rows = parsePublicProjectPublicationList([
    ownProjectPublication,
    externalProjectPublication,
    {
      ...ownProjectPublication,
      publication_slug: 'working-paper',
      publication_date: null,
      publication_year: null,
    },
  ])

  assert.deepEqual(
    rows.map((row) => row.authorship),
    ['own', 'external', 'own']
  )
})

test('rejects project publications that break the own/external contract', () => {
  const invalid = [
    [{ ...externalProjectPublication, publication_slug: null }, /publication_slug/],
    [{ ...ownProjectPublication, publication_slug: null }, /publication_slug/],
    [{ ...externalProjectPublication, publication_year: null }, /publication_year/],
    [{ ...ownProjectPublication, publication_year: 2025 }, /publication_year/],
    [{ ...ownProjectPublication, publication_date: null }, /publication_year/],
    [{ ...externalProjectPublication, authorship: 'coauthored' }, /authorship/],
    [{ ...externalProjectPublication, authors: [] }, /authors/],
    [{ ...externalProjectPublication, language: 'Klingon' }, /language/],
    [{ ...externalProjectPublication, publication_url: 'javascript:alert(1)' }, /publication_url/],
    [{ ...externalProjectPublication, visibility: 'private' }, /unexpected object shape/],
  ]

  for (const [row, pattern] of invalid) {
    assert.throws(
      () => parsePublicProjectPublicationList([row]),
      (error) =>
        error instanceof AcademicApiValidationError &&
        pattern.test(error.message)
    )
  }
})

const externalPublication = {
  slug: 'partner-study',
  title: 'Related study by project partners',
  authors: ['A. Partner', 'B. Partner'],
  venue: 'Journal',
  publication_date: null,
  publication_year: 2025,
  doi_url: null,
  publication_url: 'https://example.org/report',
  language: 'English',
  project_slugs: [],
  collection_slugs: ['lab-website', 'reading-list'],
}

test('validates the external publication library feed', () => {
  const rows = parsePublicExternalPublicationList([
    externalPublication,
    {
      ...externalPublication,
      slug: 'dated-study',
      publication_date: '2024-05-02',
      publication_year: 2024,
      project_slugs: ['time-use'],
      collection_slugs: [],
    },
  ])

  assert.deepEqual(
    rows.map((row) => row.slug),
    ['partner-study', 'dated-study']
  )
})

test('rejects malformed external publication library rows', () => {
  const invalid = [
    [[{ ...externalPublication, slug: 'Not A Slug' }], /slug/],
    [[{ ...externalPublication, publication_year: null }], /publication_year/],
    [[{ ...externalPublication, publication_date: '2026-01-01' }], /publication_year/],
    [[{ ...externalPublication, collection_slugs: ['a', 'a'] }], /collection_slugs/],
    [[{ ...externalPublication, collection_slugs: ['Bad Slug'] }], /collection_slugs/],
    [[{ ...externalPublication, project_slugs: ['x', 'x'] }], /project_slugs/],
    [[externalPublication, externalPublication], /unique slugs/],
    [[{ ...externalPublication, visibility: 'public' }], /unexpected object shape/],
  ]

  for (const [rows, pattern] of invalid) {
    assert.throws(
      () => parsePublicExternalPublicationList(rows),
      (error) =>
        error instanceof AcademicApiValidationError &&
        pattern.test(error.message)
    )
  }
})
