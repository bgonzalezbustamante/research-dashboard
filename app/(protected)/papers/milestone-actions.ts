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
      target_date: getOptionalDate(
        formData,
        'target_date'
      ),
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
      target_date: getOptionalDate(
        formData,
        'target_date'
      ),
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

  redirectToMilestones(
    paperId
  )
}