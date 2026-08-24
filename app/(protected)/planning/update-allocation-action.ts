'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

type ServerSupabaseClient =
  Awaited<ReturnType<typeof createClient>>

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
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

  const [year, month, day] =
    value.split('-').map(Number)

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidPeriodStart(
  value: string
) {
  if (!isValidDateString(value)) {
    return false
  }

  const day = Number(
    value.slice(8, 10)
  )

  return day === 1 || day === 16
}

function getPeriodEnd(
  periodStart: string
) {
  const [year, month, day] =
    periodStart
      .split('-')
      .map(Number)

  if (day === 1) {
    return `${periodStart.slice(
      0,
      8
    )}15`
  }

  return new Date(
    Date.UTC(
      year,
      month,
      0
    )
  )
    .toISOString()
    .slice(0, 10)
}

function getAmsterdamDate() {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(new Date())

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function getCurrentPeriodStart() {
  const today = getAmsterdamDate()
  const day = Number(
    today.slice(8, 10)
  )

  return `${today.slice(
    0,
    8
  )}${day <= 15 ? '01' : '16'}`
}

function getReturnPeriod(
  formData: FormData
) {
  const value = getRequiredText(
    formData,
    'period_start'
  )

  return isValidPeriodStart(value)
    ? value
    : getCurrentPeriodStart()
}

function getCommittedDays(
  formData: FormData
) {
  const value = getRequiredText(
    formData,
    'committed_days'
  )

  const parsed = Number.parseInt(
    value,
    10
  )

  if (
    !Number.isInteger(parsed) ||
    ![5, 10, 15].includes(parsed)
  ) {
    return null
  }

  return parsed
}

function getCheckbox(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return (
    value === 'on' ||
    value === 'true'
  )
}

async function requireAuth() {
  const supabase =
    await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const userId = data?.claims?.sub

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

async function getOrCreatePlanningPeriod(
  supabase: ServerSupabaseClient,
  userId: string,
  periodStart: string
) {
  const {
    data: existingPeriod,
    error: existingError,
  } = await supabase
    .from('planning_periods')
    .select('id')
    .eq('owner_id', userId)
    .eq('period_start', periodStart)
    .maybeSingle()

  if (existingError) {
    console.error(
      'Planning period lookup failed:',
      existingError
    )

    return {
      error:
        'The target planning period could not be loaded.',
    }
  }

  if (existingPeriod) {
    return {
      id: existingPeriod.id,
    }
  }

  const periodEnd =
    getPeriodEnd(periodStart)

  const {
    data: createdPeriod,
    error: createError,
  } = await supabase
    .from('planning_periods')
    .insert({
      owner_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select('id')
    .single()

  if (
    !createError &&
    createdPeriod
  ) {
    return {
      id: createdPeriod.id,
    }
  }

  if (
    createError?.code === '23505'
  ) {
    const {
      data: concurrentPeriod,
      error: concurrentError,
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
      !concurrentError &&
      concurrentPeriod
    ) {
      return {
        id: concurrentPeriod.id,
      }
    }
  }

  console.error(
    'Planning period creation failed:',
    createError
  )

  return {
    error:
      'The target planning period could not be created.',
  }
}

export async function updatePlanningAllocationWithPeriod(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const sourcePeriodStart =
    getReturnPeriod(formData)

  const targetPeriodStart =
    getRequiredText(
      formData,
      'target_period_start'
    )

  const allocationId =
    getRequiredText(
      formData,
      'allocation_id'
    )

  const committedDays =
    getCommittedDays(formData)

  const notes = getOptionalText(
    formData,
    'notes'
  )

  const flowsavvyAdded =
    getCheckbox(
      formData,
      'flowsavvy_added'
    )

  if (!allocationId) {
    redirectPlanningError(
      sourcePeriodStart,
      'Planning allocation is missing.'
    )
  }

  if (
    !isValidPeriodStart(
      targetPeriodStart
    )
  ) {
    redirectPlanningError(
      sourcePeriodStart,
      'Select a valid biweekly planning period.'
    )
  }

  if (committedDays === null) {
    redirectPlanningError(
      sourcePeriodStart,
      'Committed days must be 5, 10, or 15.'
    )
  }

  const {
    data: sourcePeriod,
    error: sourcePeriodError,
  } = await supabase
    .from('planning_periods')
    .select('id')
    .eq('owner_id', userId)
    .eq(
      'period_start',
      sourcePeriodStart
    )
    .maybeSingle()

  if (
    sourcePeriodError ||
    !sourcePeriod
  ) {
    redirectPlanningError(
      sourcePeriodStart,
      'The current planning period could not be loaded.'
    )
  }

  const targetPeriodResult =
    await getOrCreatePlanningPeriod(
      supabase,
      userId,
      targetPeriodStart
    )

  if (!targetPeriodResult.id) {
    redirectPlanningError(
      sourcePeriodStart,
      targetPeriodResult.error ??
        'The target planning period could not be prepared.'
    )
  }

  const { data, error } =
    await supabase
      .from('planning_allocations')
      .update({
        planning_period_id:
          targetPeriodResult.id,
        committed_days:
          committedDays,
        flowsavvy_added:
          flowsavvyAdded,
        notes,
      })
      .eq('id', allocationId)
      .eq(
        'planning_period_id',
        sourcePeriod.id
      )
      .select('id')
      .maybeSingle()

  if (error || !data) {
    console.error(
      'Planning allocation update failed:',
      error
    )

    if (error?.code === '23505') {
      redirectPlanningError(
        sourcePeriodStart,
        'An equivalent allocation already exists in the target period.'
      )
    }

    redirectPlanningError(
      sourcePeriodStart,
      'The planning allocation could not be updated.'
    )
  }

  revalidatePath('/planning')
  redirectToPlanning(targetPeriodStart)
}
