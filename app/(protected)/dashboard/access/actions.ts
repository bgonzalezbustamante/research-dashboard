'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function redirectWithStatus(
  kind: 'notice' | 'error',
  message: string
): never {
  redirect(
    `/dashboard/access?${kind}=${encodeURIComponent(
      message
    )}`
  )
}

async function ensureManagedProfile(
  userId: string
) {
  const access =
    await requireDashboardOwner()

  if (
    !userId ||
    userId === access.userId
  ) {
    redirectWithStatus(
      'error',
      'Select a different account to manage.'
    )
  }

  const supabase =
    await createClient()

  const {
    data: profile,
    error,
  } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    redirectWithStatus(
      'error',
      'The selected account could not be loaded.'
    )
  }

  return {
    access,
    supabase,
  }
}

export async function setViewerAccess(
  formData: FormData
) {
  const userId =
    getRequiredText(
      formData,
      'user_id'
    )

  const enabled =
    getRequiredText(
      formData,
      'enabled'
    ) === 'true'

  const {
    access,
    supabase,
  } = await ensureManagedProfile(
    userId
  )

  if (enabled) {
    const { error } =
      await supabase
        .from('dashboard_members')
        .insert({
          owner_id: access.ownerId,
          user_id: userId,
          role: 'viewer',
        })

    if (
      error &&
      error.code !== '23505'
    ) {
      console.error(
        'Viewer access grant failed:',
        error
      )

      redirectWithStatus(
        'error',
        'Viewer access could not be granted.'
      )
    }
  } else {
    const { error } =
      await supabase
        .from('dashboard_members')
        .delete()
        .eq(
          'owner_id',
          access.ownerId
        )
        .eq('user_id', userId)
        .eq('role', 'viewer')

    if (error) {
      console.error(
        'Viewer access removal failed:',
        error
      )

      redirectWithStatus(
        'error',
        'Viewer access could not be removed.'
      )
    }
  }

  revalidatePath('/dashboard/access')
  revalidatePath('/dashboard')
  revalidatePath('/hours')
  revalidatePath('/planning')
  revalidatePath('/papers')

  redirectWithStatus(
    'notice',
    enabled
      ? 'Viewer access granted.'
      : 'Viewer access removed.'
  )
}

export async function saveCoauthorAssignments(
  formData: FormData
) {
  const userId =
    getRequiredText(
      formData,
      'user_id'
    )

  const {
    supabase,
  } = await ensureManagedProfile(
    userId
  )

  const paperIds = [
    ...new Set(
      formData
        .getAll('paper_id')
        .filter(
          (value): value is string =>
            typeof value === 'string' &&
            value.trim().length > 0
        )
        .map((value) =>
          value.trim()
        )
    ),
  ]

  const { error } =
    await supabase.rpc(
      'set_coauthor_paper_assignments',
      {
        p_user_id: userId,
        p_paper_ids: paperIds,
      }
    )

  if (error) {
    console.error(
      'Coauthor assignment update failed:',
      error
    )

    redirectWithStatus(
      'error',
      'Coauthor paper assignments could not be saved.'
    )
  }

  revalidatePath('/dashboard/access')
  revalidatePath('/papers')

  redirectWithStatus(
    'notice',
    paperIds.length === 0
      ? 'Coauthor access removed from all papers.'
      : 'Coauthor paper assignments saved.'
  )
}
