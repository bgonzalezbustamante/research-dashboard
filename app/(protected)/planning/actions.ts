'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function isValidDateString(
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
  if (
    !isValidDateString(
      value
    )
  ) {
    return false
  }

  const day =
    Number(
      value.slice(
        8,
        10
      )
    )

  return (
    day === 1 ||
    day === 16
  )
}

function getAmsterdamDate() {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(
      new Date()
    )

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    )

  return `${values.year}-${values.month}-${values.day}`
}

function getCurrentPeriodStart() {
  const today =
    getAmsterdamDate()

  const day =
    Number(
      today.slice(
        8,
        10
      )
    )

  return `${today.slice(
    0,
    8
  )}${day <= 15 ? '01' : '16'}`
}

function getReturnPeriod(
  formData: FormData
) {
  const value =
    getRequiredText(
      formData,
      'period_start'
    )

  return isValidPeriodStart(
    value
  )
    ? value
    : getCurrentPeriodStart()
}

function getCheckbox(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  return (
    value === 'on' ||
    value === 'true'
  )
}

async function requireAuth() {
  // Owner-only writes: RLS enforces this too, but signed-in Viewers and
  // Website Editors should not reach these actions at all.
  await requireDashboardOwner()

  const supabase =
    await createClient()

  const {
    data,
    error,
  } =
    await supabase.auth.getClaims()

  const userId =
    data?.claims?.sub

  if (
    error ||
    typeof userId !== 'string'
  ) {
    redirect('/login')
  }

  return {
    supabase,
    userId,
  }
}

function redirectPlanningError(
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

function redirectToPlanning(
  periodStart: string
): never {
  redirect(
    `/planning?period=${encodeURIComponent(
      periodStart
    )}#allocations`
  )
}

export async function setPlanningAllocationFlowSavvy(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const periodStart =
    getReturnPeriod(
      formData
    )

  const allocationId =
    getRequiredText(
      formData,
      'allocation_id'
    )

  const flowsavvyAdded =
    getCheckbox(
      formData,
      'flowsavvy_added'
    )

  if (!allocationId) {
    redirectPlanningError(
      periodStart,
      'Planning allocation is missing.'
    )
  }

  const {
    data: period,
    error: periodError,
  } = await supabase
    .from('planning_periods')
    .select('id')
    .eq('owner_id', userId)
    .eq(
      'period_start',
      periodStart
    )
    .maybeSingle()

  if (
    periodError ||
    !period
  ) {
    redirectPlanningError(
      periodStart,
      'The planning period could not be loaded.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('planning_allocations')
    .update({
      flowsavvy_added:
        flowsavvyAdded,
    })
    .eq('id', allocationId)
    .eq(
      'planning_period_id',
      period.id
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Planning FlowSavvy update failed:',
      error
    )

    redirectPlanningError(
      periodStart,
      'The FlowSavvy/Calendar state could not be updated.'
    )
  }

  revalidatePath('/planning')
  revalidatePath('/dashboard')

  redirectToPlanning(
    periodStart
  )
}

export async function deletePlanningAllocation(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const periodStart =
    getReturnPeriod(
      formData
    )

  const allocationId =
    getRequiredText(
      formData,
      'allocation_id'
    )

  if (!allocationId) {
    redirectPlanningError(
      periodStart,
      'Planning allocation is missing.'
    )
  }

  const {
    data: period,
    error: periodError,
  } = await supabase
    .from(
      'planning_periods'
    )
    .select('id')
    .eq(
      'owner_id',
      userId
    )
    .eq(
      'period_start',
      periodStart
    )
    .maybeSingle()

  if (
    periodError ||
    !period
  ) {
    redirectPlanningError(
      periodStart,
      'The planning period could not be loaded.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'planning_allocations'
    )
    .delete()
    .eq(
      'id',
      allocationId
    )
    .eq(
      'planning_period_id',
      period.id
    )
    .select('id')
    .maybeSingle()

  if (
    error ||
    !data
  ) {
    console.error(
      'Planning allocation deletion failed:',
      error
    )

    redirectPlanningError(
      periodStart,
      'The planning allocation could not be deleted.'
    )
  }

  revalidatePath(
    '/planning'
  )

  revalidatePath(
    '/dashboard'
  )

  redirectToPlanning(
    periodStart
  )
}