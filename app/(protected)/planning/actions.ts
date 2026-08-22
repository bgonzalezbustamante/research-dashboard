'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

type ServerSupabaseClient =
  Awaited<ReturnType<typeof createClient>>

type AllocationType =
  | 'paper'
  | 'blocked'

type BlockedType =
  | 'teaching'
  | 'conference'
  | 'holiday'
  | 'administrative'

const blockedTypes:
  BlockedType[] = [
    'teaching',
    'conference',
    'holiday',
    'administrative',
  ]

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

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const trimmed =
    value.trim()

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

function getPeriodEnd(
  periodStart: string
) {
  const [
    year,
    month,
    day,
  ] = periodStart
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

function getCommittedDays(
  formData: FormData
) {
  const value =
    getRequiredText(
      formData,
      'committed_days'
    )

  const parsed =
    Number.parseInt(
      value,
      10
    )

  if (
    !Number.isInteger(
      parsed
    ) ||
    ![
      5,
      10,
      15,
    ].includes(
      parsed
    )
  ) {
    return null
  }

  return parsed
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

function getAllocationType(
  formData: FormData
): AllocationType | null {
  const value =
    getRequiredText(
      formData,
      'allocation_type'
    )

  if (
    value === 'paper' ||
    value === 'blocked'
  ) {
    return value
  }

  return null
}

function getBlockedType(
  formData: FormData
): BlockedType | null {
  const value =
    getRequiredText(
      formData,
      'blocked_type'
    ) as BlockedType

  return blockedTypes.includes(
    value
  )
    ? value
    : null
}

async function requireAuth() {
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

async function getOrCreatePlanningPeriod(
  supabase: ServerSupabaseClient,
  userId: string,
  periodStart: string
) {
  const {
    data: existingPeriod,
    error: existingError,
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

  if (existingError) {
    console.error(
      'Planning period lookup failed:',
      existingError
    )

    return {
      error:
        'The planning period could not be loaded.',
    }
  }

  if (existingPeriod) {
    return {
      id:
        existingPeriod.id,
    }
  }

  const periodEnd =
    getPeriodEnd(
      periodStart
    )

  const {
    data: createdPeriod,
    error: createError,
  } = await supabase
    .from(
      'planning_periods'
    )
    .insert({
      owner_id:
        userId,
      period_start:
        periodStart,
      period_end:
        periodEnd,
    })
    .select('id')
    .single()

  if (
    !createError &&
    createdPeriod
  ) {
    return {
      id:
        createdPeriod.id,
    }
  }

  if (
    createError?.code ===
    '23505'
  ) {
    const {
      data:
        concurrentPeriod,
      error:
        concurrentError,
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
      !concurrentError &&
      concurrentPeriod
    ) {
      return {
        id:
          concurrentPeriod.id,
      }
    }
  }

  console.error(
    'Planning period creation failed:',
    createError
  )

  return {
    error:
      'The planning period could not be created.',
  }
}

export async function createPlanningAllocation(
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

  const allocationType =
    getAllocationType(
      formData
    )

  const committedDays =
    getCommittedDays(
      formData
    )

  const notes =
    getOptionalText(
      formData,
      'notes'
    )

  const flowsavvyAdded =
    getCheckbox(
      formData,
      'flowsavvy_added'
    )

  if (!allocationType) {
    redirectPlanningError(
      periodStart,
      'Allocation type is required.'
    )
  }

  if (
    committedDays ===
    null
  ) {
    redirectPlanningError(
      periodStart,
      'Committed days must be 5, 10, or 15.'
    )
  }

  let paperId:
    string | null = null

  let blockedType:
    BlockedType | null = null

  if (
    allocationType ===
    'paper'
  ) {
    paperId =
      getRequiredText(
        formData,
        'paper_id'
      )

    if (!paperId) {
      redirectPlanningError(
        periodStart,
        'Paper is required.'
      )
    }

    const {
      data: paper,
      error: paperError,
    } = await supabase
      .from('papers')
      .select('id')
      .eq(
        'id',
        paperId
      )
      .eq(
        'owner_id',
        userId
      )
      .is(
        'archived_at',
        null
      )
      .maybeSingle()

    if (
      paperError ||
      !paper
    ) {
      redirectPlanningError(
        periodStart,
        'The selected paper is not available for planning.'
      )
    }
  } else {
    blockedType =
      getBlockedType(
        formData
      )

    if (!blockedType) {
      redirectPlanningError(
        periodStart,
        'Blocked-time category is required.'
      )
    }
  }

  const periodResult =
    await getOrCreatePlanningPeriod(
      supabase,
      userId,
      periodStart
    )

  if (
    !periodResult.id
  ) {
    redirectPlanningError(
      periodStart,
      periodResult.error ??
        'The planning period could not be created.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'planning_allocations'
    )
    .insert({
      planning_period_id:
        periodResult.id,
      allocation_type:
        allocationType,
      paper_id:
        paperId,
      blocked_type:
        blockedType,
      committed_days:
        committedDays,
      flowsavvy_added:
        flowsavvyAdded,
      notes,
    })
    .select('id')
    .single()

  if (
    error ||
    !data
  ) {
    console.error(
      'Planning allocation creation failed:',
      error
    )

    if (
      error?.code ===
      '23505'
    ) {
      if (
        allocationType ===
        'paper'
      ) {
        redirectPlanningError(
          periodStart,
          'This paper is already allocated in the selected period. Edit the existing allocation instead.'
        )
      }

      redirectPlanningError(
        periodStart,
        'This blocked-time category is already allocated in the selected period. Edit the existing allocation instead.'
      )
    }

    redirectPlanningError(
      periodStart,
      'The planning allocation could not be created.'
    )
  }

  revalidatePath(
    '/planning'
  )

  redirectToPlanning(
    periodStart
  )
}

export async function updatePlanningAllocation(
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

  const committedDays =
    getCommittedDays(
      formData
    )

  const notes =
    getOptionalText(
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
      periodStart,
      'Planning allocation is missing.'
    )
  }

  if (
    committedDays ===
    null
  ) {
    redirectPlanningError(
      periodStart,
      'Committed days must be 5, 10, or 15.'
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
    .update({
      committed_days:
        committedDays,
      flowsavvy_added:
        flowsavvyAdded,
      notes,
    })
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
      'Planning allocation update failed:',
      error
    )

    redirectPlanningError(
      periodStart,
      'The planning allocation could not be updated.'
    )
  }

  revalidatePath(
    '/planning'
  )

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

  redirectToPlanning(
    periodStart
  )
}