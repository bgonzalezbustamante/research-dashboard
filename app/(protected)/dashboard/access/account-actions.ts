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

async function getManagedAccount(
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
    .select('id, deactivated_at')
    .eq('id', userId)
    .maybeSingle()

  if (
    error ||
    !profile ||
    profile.deactivated_at
  ) {
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

function revalidateAccessSurfaces() {
  revalidatePath('/dashboard/access')
  revalidatePath('/dashboard')
  revalidatePath('/hours')
  revalidatePath('/planning')
  revalidatePath('/papers')
}

export async function renameManagedAccount(
  formData: FormData
) {
  const userId =
    getRequiredText(
      formData,
      'user_id'
    )

  const fullName =
    getRequiredText(
      formData,
      'full_name'
    )

  if (!fullName) {
    redirectWithStatus(
      'error',
      'Enter a full name.'
    )
  }

  const { supabase } =
    await getManagedAccount(userId)

  const { error } =
    await supabase.rpc(
      'rename_managed_profile',
      {
        p_user_id: userId,
        p_full_name: fullName,
      }
    )

  if (error) {
    console.error(
      'Managed account rename failed:',
      error
    )

    redirectWithStatus(
      'error',
      'The account name could not be updated.'
    )
  }

  revalidateAccessSurfaces()

  redirectWithStatus(
    'notice',
    'Account name updated.'
  )
}

export async function deleteManagedAccount(
  formData: FormData
) {
  const userId =
    getRequiredText(
      formData,
      'user_id'
    )

  const confirmed =
    getRequiredText(
      formData,
      'confirm_delete'
    ) === 'true'

  if (!confirmed) {
    redirectWithStatus(
      'error',
      'Confirm account deletion before continuing.'
    )
  }

  const { supabase } =
    await getManagedAccount(userId)

  const { data, error } =
    await supabase.functions.invoke(
      'delete-dashboard-account',
      {
        body: {
          user_id: userId,
        },
      }
    )

  if (
    error ||
    !data ||
    data.ok !== true
  ) {
    console.error(
      'Managed account deletion failed:',
      error ?? data
    )

    redirectWithStatus(
      'error',
      data?.error ??
        'The account could not be deleted.'
    )
  }

  revalidateAccessSurfaces()

  redirectWithStatus(
    'notice',
    data.profile_preserved
      ? 'Account login deleted and access revoked. A name-only profile was retained to preserve research attribution.'
      : 'Account deleted and all dashboard access revoked.'
  )
}
