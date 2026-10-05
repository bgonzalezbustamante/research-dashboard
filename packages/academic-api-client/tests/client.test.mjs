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
