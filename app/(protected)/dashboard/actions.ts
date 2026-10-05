'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  requireDashboardOwner,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

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

function dashboardRedirect(
  params: Record<
    string,
    string
  >
): never {
  const query =
    new URLSearchParams(
      params
    ).toString()

  redirect(
    query
      ? `/dashboard?${query}`
      : '/dashboard'
  )
}

export async function updateCatholicCalendarStatus(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const catholicCalendarActive =
    getText(
      formData,
      'catholic_calendar_active'
    ) === 'true'

  const requestedYear =
    getText(
      formData,
      'year'
    )

  const supabase =
    await createClient()

  const { error } =
    await supabase
      .from(
        'calendar_settings'
      )
      .upsert(
        {
          owner_id:
            access.ownerId,
          catholic_calendar_active:
            catholicCalendarActive,
        },
        {
          onConflict:
            'owner_id',
        }
      )

  if (error) {
    console.error(
      'Catholic Calendar status update failed:',
      error
    )

    dashboardRedirect({
      ...(requestedYear
        ? {
            year:
              requestedYear,
          }
        : {}),
      calendar_error:
        'Calendar status could not be updated.',
    })
  }

  revalidatePath('/dashboard')

  dashboardRedirect({
    ...(requestedYear
      ? {
          year:
            requestedYear,
        }
      : {}),
    calendar:
      catholicCalendarActive
        ? 'active'
        : 'inactive',
  })
}
