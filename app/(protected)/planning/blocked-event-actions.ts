'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const blockedEventTypes =
  new Set([
    'winter_holiday',
    'summer_holiday',
    'administrative',
    'sick',
  ])

function getText(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getOptionalText(
  formData: FormData,
  name: string
) {
  return (
    getText(
      formData,
      name
    ) || null
  )
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
      day
  )
}

function isValidPeriodStart(
  value: string
) {
  return (
    isValidDate(value) &&
    [1, 16].includes(
      Number(
        value.slice(
          8,
          10
        )
      )
    )
  )
}

function returnPeriod(
  formData: FormData
) {
  const value =
    getText(
      formData,
      'period_start'
    )

  return isValidPeriodStart(
    value
  )
    ? value
    : new Date()
        .toISOString()
        .slice(0, 8) +
        (new Date().getUTCDate() <=
        15
          ? '01'
          : '16')
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

function done(
  periodStart: string
): never {
  redirect(
    `/planning?period=${encodeURIComponent(
      periodStart
    )}#allocations`
  )
}

function validate(
  formData: FormData,
  periodStart: string
) {
  const eventType =
    getText(
      formData,
      'event_type'
    )

  const startDate =
    getText(
      formData,
      'start_date'
    )

  const endDate =
    getText(
      formData,
      'end_date'
    )

  if (
    !blockedEventTypes.has(
      eventType
    )
  ) {
    fail(
      periodStart,
      'Select a valid blocked-time category.'
    )
  }

  if (
    !isValidDate(startDate) ||
    !isValidDate(endDate)
  ) {
    fail(
      periodStart,
      'Start and end dates are required.'
    )
  }

  if (endDate < startDate) {
    fail(
      periodStart,
      'End date cannot be earlier than the start date.'
    )
  }

  return {
    eventType,
    startDate,
    endDate,
    notes:
      getOptionalText(
        formData,
        'notes'
      ),
  }
}

export async function createPlanningBlockedEvent(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const periodStart =
    returnPeriod(
      formData
    )

  const fields =
    validate(
      formData,
      periodStart
    )

  const supabase =
    await createClient()

  const { error } =
    await supabase
      .from(
        'planning_blocked_events'
      )
      .insert({
        owner_id:
          access.ownerId,
        event_type:
          fields.eventType,
        start_date:
          fields.startDate,
        end_date:
          fields.endDate,
        notes:
          fields.notes,
      })

  if (error) {
    console.error(
      'Planning blocked event creation failed:',
      error
    )

    fail(
      periodStart,
      'The dated blocked event could not be created.'
    )
  }

  revalidatePath(
    '/planning'
  )
  revalidatePath(
    '/dashboard'
  )

  done(periodStart)
}

export async function updatePlanningBlockedEvent(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const periodStart =
    returnPeriod(
      formData
    )

  const eventId =
    getText(
      formData,
      'event_id'
    )

  if (!eventId) {
    fail(
      periodStart,
      'Blocked event ID is required.'
    )
  }

  const fields =
    validate(
      formData,
      periodStart
    )

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'planning_blocked_events'
    )
    .update({
      event_type:
        fields.eventType,
      start_date:
        fields.startDate,
      end_date:
        fields.endDate,
      notes:
        fields.notes,
    })
    .eq(
      'id',
      eventId
    )
    .eq(
      'owner_id',
      access.ownerId
    )
    .select('id')
    .maybeSingle()

  if (
    error ||
    !data
  ) {
    console.error(
      'Planning blocked event update failed:',
      error
    )

    fail(
      periodStart,
      'The dated blocked event could not be updated.'
    )
  }

  revalidatePath(
    '/planning'
  )
  revalidatePath(
    '/dashboard'
  )

  done(periodStart)
}

export async function deletePlanningBlockedEvent(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const periodStart =
    returnPeriod(
      formData
    )

  const eventId =
    getText(
      formData,
      'event_id'
    )

  if (!eventId) {
    fail(
      periodStart,
      'Blocked event ID is required.'
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'planning_blocked_events'
    )
    .delete()
    .eq(
      'id',
      eventId
    )
    .eq(
      'owner_id',
      access.ownerId
    )
    .select('id')
    .maybeSingle()

  if (
    error ||
    !data
  ) {
    console.error(
      'Planning blocked event deletion failed:',
      error
    )

    fail(
      periodStart,
      'The dated blocked event could not be deleted.'
    )
  }

  revalidatePath(
    '/planning'
  )
  revalidatePath(
    '/dashboard'
  )

  done(periodStart)
}
