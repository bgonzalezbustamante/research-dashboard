'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const sourceTypes =
  new Set([
    'conference',
    'teaching',
    'blocked_event',
  ])

function textValue(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function isValidDate(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day &&
    [1, 16].includes(day)
  )
}

function fail(
  periodStart: string,
  message: string
): never {
  redirect(
    `/planning?period=${encodeURIComponent(
      periodStart
    )}&error=${encodeURIComponent(
      message
    )}#allocations`
  )
}

export async function setPlanningSourceFlowSavvy(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const periodStart =
    textValue(
      formData,
      'period_start'
    )

  const sourceType =
    textValue(
      formData,
      'source_type'
    )

  const sourceIds =
    [
      ...new Set(
        formData
          .getAll(
            'source_id'
          )
          .flatMap(
            (value) =>
              typeof value ===
                'string' &&
              value.trim()
                ? [
                    value.trim(),
                  ]
                : []
          )
      ),
    ]

  const added =
    textValue(
      formData,
      'flowsavvy_added'
    ) === 'true'

  if (
    !isValidDate(
      periodStart
    )
  ) {
    fail(
      periodStart,
      'A valid Planning period is required.'
    )
  }

  if (
    !sourceTypes.has(
      sourceType
    ) ||
    sourceIds.length === 0
  ) {
    fail(
      periodStart,
      'A valid source-backed commitment is required.'
    )
  }

  const supabase =
    await createClient()

  const changedAt =
    added
      ? new Date()
          .toISOString()
      : null

  const { error } =
    await supabase
      .from(
        'planning_source_period_states'
      )
      .upsert(
        sourceIds.map(
          (sourceId) => ({
            owner_id:
              access.ownerId,
            source_type:
              sourceType,
            source_id:
              sourceId,
            period_start:
              periodStart,
            flowsavvy_added:
              added,
            flowsavvy_added_at:
              changedAt,
          })
        ),
        {
          onConflict:
            'owner_id,source_type,source_id,period_start',
        }
      )

  if (error) {
    console.error(
      'Source-backed Planning state update failed:',
      error
    )

    fail(
      periodStart,
      'The FlowSavvy/Calendar state could not be updated.'
    )
  }

  revalidatePath(
    '/planning'
  )
  revalidatePath(
    '/dashboard'
  )

  redirect(
    `/planning?period=${encodeURIComponent(
      periodStart
    )}#allocations`
  )
}
