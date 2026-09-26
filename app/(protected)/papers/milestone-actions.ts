'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type MilestoneStatus =
  | 'planned'
  | 'completed'
  | 'cancelled'

const allowedStatuses = new Set<MilestoneStatus>([
  'planned',
  'completed',
  'cancelled',
])

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
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

  return trimmed.length > 0
    ? trimmed
    : null
}

function getOptionalDate(
  formData: FormData,
  name: string
) {
  const value = getOptionalText(
    formData,
    name
  )

  if (!value) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null
}

function getStatus(
  formData: FormData
): MilestoneStatus | null {
  const value = getRequiredText(
    formData,
    'status'
  ) as MilestoneStatus

  return allowedStatuses.has(value)
    ? value
    : null
}

function getCommittedDays(
  formData: FormData
) {
  const value = getOptionalText(
    formData,
    'committed_days'
  )

  if (!value) {
    return null
  }

  const parsed =
    Number.parseInt(
      value,
      10
    )

  return [5, 10, 15].includes(
    parsed
  )
    ? parsed
    : null
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

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    )

  return `${values.year}-${values.month}-${values.day}`
}

async function requireAuth() {
  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.auth.getClaims()

  if (
    error ||
    !data?.claims
  ) {
    redirect('/login')
  }

  return supabase
}

function redirectWithError(
  paperId: string,
  message: string
): never {
  redirect(
    `/papers/${paperId}?milestoneError=${encodeURIComponent(
      message
    )}#milestones`
  )
}

function redirectToMilestones(
  paperId: string
): never {
  redirect(
    `/papers/${paperId}#milestones`
  )
}

export async function createMilestone(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/papers')
  }

  const title =
    getRequiredText(
      formData,
      'title'
    )

  if (!title) {
    redirectWithError(
      paperId,
      'Milestone title is required.'
    )
  }

  const status =
    getStatus(formData)

  if (!status) {
    redirectWithError(
      paperId,
      'Invalid milestone status.'
    )
  }

  const targetDate =
    getOptionalDate(
      formData,
      'target_date'
    )

  const committedDays =
    getCommittedDays(
      formData
    )

  if (
    committedDays !== null &&
    !targetDate
  ) {
    redirectWithError(
      paperId,
      'A milestone with committed days needs a target date.'
    )
  }

  const flowsavvyAdded =
    committedDays !== null &&
    getCheckbox(
      formData,
      'flowsavvy_added'
    )

  const completedOn =
    status === 'completed'
      ? getOptionalDate(
          formData,
          'completed_on'
        ) ?? getAmsterdamDate()
      : null

  const {
    data,
    error,
  } = await supabase
    .from('paper_milestones')
    .insert({
      paper_id: paperId,
      title,
      target_date:
        targetDate,
      committed_days:
        committedDays,
      flowsavvy_added:
        flowsavvyAdded,
      flowsavvy_added_at:
        flowsavvyAdded
          ? new Date().toISOString()
          : null,
      completed_on: completedOn,
      status,
      notes: getOptionalText(
        formData,
        'notes'
      ),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Milestone creation failed:',
      error
    )

    redirectWithError(
      paperId,
      'The milestone could not be created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')
  revalidatePath('/planning')
  revalidatePath('/dashboard')

  redirectToMilestones(
    paperId
  )
}

export async function updateMilestone(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const milestoneId =
    getRequiredText(
      formData,
      'milestone_id'
    )

  if (!paperId || !milestoneId) {
    redirect('/papers')
  }

  const title =
    getRequiredText(
      formData,
      'title'
    )

  if (!title) {
    redirectWithError(
      paperId,
      'Milestone title is required.'
    )
  }

  const status =
    getStatus(formData)

  if (!status) {
    redirectWithError(
      paperId,
      'Invalid milestone status.'
    )
  }

  const targetDate =
    getOptionalDate(
      formData,
      'target_date'
    )

  const committedDays =
    getCommittedDays(
      formData
    )

  if (
    committedDays !== null &&
    !targetDate
  ) {
    redirectWithError(
      paperId,
      'A milestone with committed days needs a target date.'
    )
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from('paper_milestones')
    .select(`
      id,
      target_date,
      committed_days,
      flowsavvy_added,
      flowsavvy_added_at
    `)
    .eq('id', milestoneId)
    .eq('paper_id', paperId)
    .maybeSingle()

  if (
    existingError ||
    !existing
  ) {
    redirectWithError(
      paperId,
      'The milestone could not be loaded.'
    )
  }

  const capacityChanged =
    existing.target_date !==
      targetDate ||
    existing.committed_days !==
      committedDays

  const requestedFlowSavvy =
    committedDays !== null &&
    getCheckbox(
      formData,
      'flowsavvy_added'
    )

  const flowsavvyAdded =
    capacityChanged
      ? false
      : requestedFlowSavvy

  const flowsavvyAddedAt =
    flowsavvyAdded
      ? existing.flowsavvy_added
        ? existing.flowsavvy_added_at ??
          new Date().toISOString()
        : new Date().toISOString()
      : null

  const completedOn =
    status === 'completed'
      ? getOptionalDate(
          formData,
          'completed_on'
        ) ?? getAmsterdamDate()
      : null

  const {
    data,
    error,
  } = await supabase
    .from('paper_milestones')
    .update({
      title,
      target_date:
        targetDate,
      committed_days:
        committedDays,
      flowsavvy_added:
        flowsavvyAdded,
      flowsavvy_added_at:
        flowsavvyAddedAt,
      completed_on: completedOn,
      status,
      notes: getOptionalText(
        formData,
        'notes'
      ),
    })
    .eq('id', milestoneId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Milestone update failed:',
      error
    )

    redirectWithError(
      paperId,
      'The milestone could not be updated.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')
  revalidatePath('/planning')
  revalidatePath('/dashboard')

  redirectToMilestones(
    paperId
  )
}

async function changeMilestoneStatus(
  formData: FormData,
  status: MilestoneStatus
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const milestoneId =
    getRequiredText(
      formData,
      'milestone_id'
    )

  if (!paperId || !milestoneId) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('paper_milestones')
    .update({
      status,
      completed_on:
        status === 'completed'
          ? getAmsterdamDate()
          : null,
    })
    .eq('id', milestoneId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Milestone status change failed:',
      error
    )

    redirectWithError(
      paperId,
      'The milestone status could not be changed.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')
  revalidatePath('/planning')
  revalidatePath('/dashboard')

  redirectToMilestones(
    paperId
  )
}

export async function completeMilestone(
  formData: FormData
) {
  await changeMilestoneStatus(
    formData,
    'completed'
  )
}

export async function cancelMilestone(
  formData: FormData
) {
  await changeMilestoneStatus(
    formData,
    'cancelled'
  )
}

export async function reopenMilestone(
  formData: FormData
) {
  await changeMilestoneStatus(
    formData,
    'planned'
  )
}

export async function setMilestoneFlowSavvy(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const milestoneId =
    getRequiredText(
      formData,
      'milestone_id'
    )

  const periodStart =
    getOptionalText(
      formData,
      'period_start'
    )

  const flowsavvyAdded =
    getCheckbox(
      formData,
      'flowsavvy_added'
    )

  if (!paperId || !milestoneId) {
    redirect('/planning')
  }

  const {
    data,
    error,
  } = await supabase
    .from('paper_milestones')
    .update({
      flowsavvy_added:
        flowsavvyAdded,
      flowsavvy_added_at:
        flowsavvyAdded
          ? new Date().toISOString()
          : null,
    })
    .eq('id', milestoneId)
    .eq('paper_id', paperId)
    .not(
      'committed_days',
      'is',
      null
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Milestone FlowSavvy update failed:',
      error
    )

    if (periodStart) {
      redirect(
        `/planning?period=${encodeURIComponent(
          periodStart
        )}&error=${encodeURIComponent(
          'The milestone FlowSavvy/Calendar state could not be updated.'
        )}#allocations`
      )
    }

    redirectWithError(
      paperId,
      'The milestone FlowSavvy/Calendar state could not be updated.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )
  revalidatePath('/planning')
  revalidatePath('/dashboard')

  if (periodStart) {
    redirect(
      `/planning?period=${encodeURIComponent(
        periodStart
      )}#allocations`
    )
  }

  redirectToMilestones(
    paperId
  )
}

export async function deleteMilestone(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const milestoneId =
    getRequiredText(
      formData,
      'milestone_id'
    )

  if (!paperId || !milestoneId) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('paper_milestones')
    .delete()
    .eq('id', milestoneId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Milestone deletion failed:',
      error
    )

    redirectWithError(
      paperId,
      'The milestone could not be deleted.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')
  revalidatePath('/planning')
  revalidatePath('/dashboard')

  redirectToMilestones(
    paperId
  )
}