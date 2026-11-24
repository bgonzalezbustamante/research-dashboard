import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAcademicApiClient,
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

test('reference client calls the transport and validates the result', async () => {
  const calls = []
  const transport = {
    async rpc(name, args) {
      calls.push({ name, args })

      if (
        name ===
        'list_public_software'
      ) {
        return {
          data: [],
          error: null,
        }
      }

      if (
        name ===
        'get_public_software'
      ) {
        return {
          data: [],
          error: null,
        }
      }

      if (
        name ===
        'get_public_teaching_settings'
      ) {
        return {
          data: [
            {
              teaching_season_active:
                true,
            },
          ],
          error: null,
        }
      }

      if (
        name ===
        'get_public_calendar_settings'
      ) {
        return {
          data: [
            {
              catholic_calendar_active:
                true,
              stress_test_active:
                true,
            },
          ],
          error: null,
        }
      }

      if (
        name ===
        'list_public_availability'
      ) {
        return {
          data: [
            {
              type: 'trip',
              start_date: `${args.p_year}-09-01`,
              end_date: `${args.p_year}-09-04`,
              label: 'CONF',
            },
          ],
          error: null,
        }
      }

      if (
        name ===
        'get_public_work_analytics'
      ) {
        return {
          data: {
            year: args.p_year,
            average_net_minutes_per_working_day: 0,
            average_coffees_per_working_day: 0,
            days:
              calendarDays(
                args.p_year
              ),
          },
          error: null,
        }
      }

      return {
        data: [],
        error: null,
      }
    },
  }

  const client =
    createAcademicApiClient(
      transport
    )

  await client.listPublicPapers()
  await client.listPublicSoftware()
  const missingSoftware =
    await client.getPublicSoftware(
      'missing-software'
    )
  const teachingSettings =
    await client.getPublicTeachingSettings()
  const calendarSettings =
    await client.getPublicCalendarSettings()
  const availability =
    await client.listPublicAvailability(
      2026
    )
  const analytics =
    await client.getPublicWorkAnalytics(
      2026
    )

  assert.equal(
    missingSoftware,
    null
  )
  assert.equal(
    teachingSettings.teaching_season_active,
    true
  )
  assert.equal(
    calendarSettings.catholic_calendar_active,
    true
  )
  assert.equal(
    calendarSettings.stress_test_active,
    true
  )
  assert.equal(
    availability[0].type,
    'trip'
  )
  assert.equal(
    analytics.days.length,
    365
  )
  assert.deepEqual(
    calls,
    [
      {
        name: 'list_public_papers',
        args: undefined,
      },
      {
        name:
          'list_public_software',
        args: undefined,
      },
      {
        name:
          'get_public_software',
        args: {
          p_slug:
            'missing-software',
        },
      },
      {
        name:
          'get_public_teaching_settings',
        args: undefined,
      },
      {
        name:
          'get_public_calendar_settings',
        args: undefined,
      },
      {
        name:
          'list_public_availability',
        args: { p_year: 2026 },
      },
      {
        name:
          'get_public_work_analytics',
        args: { p_year: 2026 },
      },
    ]
  )
})

test('reference client surfaces RPC errors before validation', async () => {
  const client =
    createAcademicApiClient({
      async rpc() {
        return {
          data: null,
          error: {
            message: 'denied',
          },
        }
      },
    })

  await assert.rejects(
    () =>
      client.listPublicPapers(),
    /list_public_papers failed: denied/
  )
})


test('reference client fetches and validates public milestone and allocation records', async () => {
  const calls = []
  const api = createAcademicApiClient({
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'list_public_paper_milestones') {
        return {
          data: [{
            target_date: '2026-11-10',
            completed_on: null,
            status: 'planned',
            committed_days: 5,
            paper_slug: null,
            flowsavvy_added: false,
            flowsavvy_added_at: null,
            title: 'Complete revisions',
            paper_title: 'Private working paper',
          }],
          error: null,
        }
      }
      if (name === 'list_public_planning_allocations') {
        return {
          data: [{
            period_start: '2026-11-01',
            period_end: '2026-11-15',
            allocation_type: 'blocked',
            blocked_type: 'conference',
            committed_days: 2,
            paper_slug: null,
            superseded_by_milestone: false,
          }],
          error: null,
        }
      }
      throw new Error('Unexpected RPC')
    },
  })

  const milestones = await api.listPublicPaperMilestones()
  const allocations = await api.listPublicPlanningAllocations()

  assert.equal(milestones[0].paper_title, 'Private working paper')
  assert.equal(allocations[0].blocked_type, 'conference')
  assert.deepEqual(calls, [
    { name: 'list_public_paper_milestones', args: undefined },
    { name: 'list_public_planning_allocations', args: undefined },
  ])
})

test('reference client fetches and validates project publications', async () => {
  const calls = []
  const api = createAcademicApiClient({
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'list_public_project_publications') {
        return {
          data: [{
            project_slug: 'time-use',
            authorship: 'external',
            publication_slug: 'partner-report',
            title: 'Partner report',
            authors: ['A. Partner'],
            venue: null,
            publication_date: null,
            publication_year: 2025,
            doi_url: null,
            publication_url: 'https://example.org/report',
            language: null,
          }],
          error: null,
        }
      }
      if (name === 'list_public_external_publications') {
        return {
          data: [{
            slug: 'partner-report',
            title: 'Partner report',
            authors: ['A. Partner'],
            venue: null,
            publication_date: null,
            publication_year: 2025,
            doi_url: null,
            publication_url: 'https://example.org/report',
            language: null,
            project_slugs: ['time-use'],
            collection_slugs: ['lab-website'],
          }],
          error: null,
        }
      }
      throw new Error('Unexpected RPC')
    },
  })

  const publications = await api.listPublicProjectPublications()
  const library = await api.listPublicExternalPublications()

  assert.equal(publications[0].authorship, 'external')
  assert.equal(library[0].slug, publications[0].publication_slug)
  assert.deepEqual(calls, [
    { name: 'list_public_project_publications', args: undefined },
    { name: 'list_public_external_publications', args: undefined },
  ])
})

test('reference client fetches and validates collection publications', async () => {
  const calls = []
  const api = createAcademicApiClient({
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'list_public_collection_publications') {
        return {
          data: [{
            collection_slug: 'obpex',
            authorship: 'own',
            publication_slug: 'own-paper',
            title: 'Own paper',
            authors: ['B. G.'],
            venue: null,
            publication_date: '2025-04-01',
            publication_year: 2025,
            doi_url: null,
            publication_url: null,
            language: null,
          }],
          error: null,
        }
      }
      throw new Error('Unexpected RPC')
    },
  })

  const publications = await api.listPublicCollectionPublications()

  assert.equal(publications[0].collection_slug, 'obpex')
  assert.deepEqual(calls, [
    { name: 'list_public_collection_publications', args: undefined },
  ])
})

test('reference client looks up documents by code and slug', async () => {
  const calls = []
  const transport = {
    async rpc(name, args) {
      calls.push({ name, args })

      return {
        data: [],
        error: null,
      }
    },
  }
  const api =
    createAcademicApiClient(
      transport
    )

  assert.equal(
    await api.getPublicSignedDocument(
      '0123456789abcdef0123456789abcdef'
    ),
    null
  )
  assert.equal(
    await api.getPublicLegacyDocument(
      '2022-05-10-document'
    ),
    null
  )
  assert.deepEqual(
    calls,
    [
      {
        name: 'get_public_signed_document',
        args: { p_code: '0123456789abcdef0123456789abcdef' },
      },
      {
        name: 'get_public_legacy_document',
        args: { p_slug: '2022-05-10-document' },
      },
    ]
  )
  await assert.rejects(
    () => api.getPublicSignedDocument(''),
    /Document code/
  )
})

test('reference client looks up a signed document by PDF hash', async () => {
  const sha256 =
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
  const row = {
    code: '0123456789abcdef0123456789abcdef',
    title: 'Synthetic certificate',
    issued_at: '2026-11-20T10:00:00+00:00',
    sha256,
    status: 'registered',
    registered_at: '2026-11-21T09:00:00+00:00',
    revoked_at: null,
    revocation_note: null,
  }
  const calls = []
  let data = [row]
  const transport = {
    async rpc(name, args) {
      calls.push({ name, args })

      return {
        data,
        error: null,
      }
    },
  }
  const api =
    createAcademicApiClient(
      transport
    )

  assert.deepEqual(
    await api.getPublicSignedDocumentBySha256(
      `  ${sha256.toUpperCase()} `
    ),
    row
  )
  assert.deepEqual(
    calls,
    [
      {
        name: 'get_public_signed_document_by_sha256',
        args: { p_sha256: sha256 },
      },
    ]
  )

  data = []
  assert.equal(
    await api.getPublicSignedDocumentBySha256(
      sha256
    ),
    null
  )

  data = [{ ...row, sha256: 'f'.repeat(64) }]
  await assert.rejects(
    () => api.getPublicSignedDocumentBySha256(sha256),
    /different hash/
  )

  for (const invalid of ['', 'abc', 'g'.repeat(64), `${sha256}0`]) {
    await assert.rejects(
      () => api.getPublicSignedDocumentBySha256(invalid),
      /64 hexadecimal characters/
    )
  }
  assert.equal(calls.length, 3)
})
