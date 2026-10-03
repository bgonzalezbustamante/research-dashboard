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
  const analytics =
    await client.getPublicWorkAnalytics(
      2026
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
