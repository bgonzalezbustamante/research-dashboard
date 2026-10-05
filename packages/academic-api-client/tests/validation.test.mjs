import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AcademicApiValidationError,
  parsePublicAvailabilityList,
  parsePublicCalendarSettingsResponse,
  parsePublicConferenceList,
  parsePublicPaperList,
  parsePublicProjectList,
  parsePublicSoftwareList,
  parsePublicTeachingList,
  parsePublicTeachingSettingsResponse,
  parsePublicWorkAnalytics,
} from '../../../node_modules/.cache/academic-api-client/index.js'

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
