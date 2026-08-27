'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const allowedMajorActivities = [
  'research',
  'teaching',
  'administration',
  'outreach',
] as const

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getReturnDate(
  formData: FormData
) {
  const value =
    getRequiredText(
      formData,
      'return_date'
    )

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  )
    ? value
    : ''
}

function redirectToLabels(
  date: string,
  error?: string,
  message?: string
): never {
  const params =
    new URLSearchParams()

  if (date) {
    params.set('date', date)
  }

  if (error) {
    params.set(
      'labelError',
      error
    )
  }

  if (message) {
    params.set(
      'labelMessage',
      message
    )
  }

  const query =
    params.toString()

  redirect(
    `${query ? `/hours?${query}` : '/hours'}#activity-labels`
  )
}

export async function setMajorActivity(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const returnDate =
    getReturnDate(formData)

  const labelId =
    getRequiredText(
      formData,
      'label_id'
    )

  const value =
    getRequiredText(
      formData,
      'major_activity'
    )

  if (!labelId) {
    redirectToLabels(
      returnDate,
      'Activity label is missing.'
    )
  }

  const majorActivity =
    value === ''
      ? null
      : allowedMajorActivities.includes(
          value as
            (typeof allowedMajorActivities)[number]
        )
        ? value
        : undefined

  if (
    majorActivity ===
    undefined
  ) {
    redirectToLabels(
      returnDate,
      'Invalid major activity.'
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from('activity_labels')
    .update({
      major_activity:
        majorActivity,
    })
    .eq('id', labelId)
    .eq(
      'owner_id',
      access.ownerId
    )
    .eq('is_system', false)
    .eq('is_break', false)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Major activity classification failed:',
      error
    )

    redirectToLabels(
      returnDate,
      'The major activity classification could not be saved.'
    )
  }

  revalidatePath('/hours')
  revalidatePath('/dashboard')

  redirectToLabels(
    returnDate,
    undefined,
    'Major activity saved.'
  )
}
