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

function calendarRedirectParams(
  formData: FormData
) {
  const requestedYear =
    getText(
      formData,
      'year'
    )

  return requestedYear
    ? {
        year:
          requestedYear,
      }
    : {}
}

export async function updateAcademicWebsiteCalendarStatus(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const active =
    getText(
      formData,
      'catholic_calendar_active'
    ) === 'true'

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
            active,
        },
        {
          onConflict:
            'owner_id',
        }
      )

  if (error) {
    console.error(
      'Academic Website Calendar status update failed:',
      error
    )

    dashboardRedirect({
      ...calendarRedirectParams(
        formData
      ),
      calendar_error:
        'Academic Website Calendar status could not be updated.',
    })
  }

  revalidatePath('/dashboard')

  dashboardRedirect({
    ...calendarRedirectParams(
      formData
    ),
    calendar:
      active
        ? 'website-active'
        : 'website-inactive',
  })
}

export async function updateCalendarStressTest(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const active =
    getText(
      formData,
      'stress_test_active'
    ) === 'true'

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
          stress_test_active:
            active,
        },
        {
          onConflict:
            'owner_id',
        }
      )

  if (error) {
    console.error(
      'Calendar stress test update failed:',
      error
    )

    dashboardRedirect({
      ...calendarRedirectParams(
        formData
      ),
      calendar_error:
        'Calendar stress test could not be updated.',
    })
  }

  revalidatePath('/dashboard')

  dashboardRedirect({
    ...calendarRedirectParams(
      formData
    ),
    calendar:
      active
        ? 'stress-active'
        : 'stress-inactive',
  })
}
