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

function getPaperIds(
  formData: FormData
) {
  return [
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

function redirectInvitationStatus(
  kind: 'notice' | 'error',
  message: string
): never {
  redirect(
    `/dashboard/access?${kind}=${encodeURIComponent(
      message
    )}&section=invitations#invitations`
  )
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '')
}

async function sendInvitation(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  invitationId: string
) {
  const { data, error } =
    await supabase.functions.invoke(
      'invite-dashboard-user',
      {
        body: {
          invitation_id: invitationId,
          redirect_to:
            `${getSiteUrl()}/auth/invite`,
        },
      }
    )

  if (error) {
    console.error(
      'Invitation email send failed:',
      error
    )

    return {
      ok: false,
      message:
        'The invitation was saved, but the email could not be sent. You can retry it below.',
    }
  }

  if (
    !data ||
    data.ok !== true
  ) {
    console.error(
      'Invitation email returned an unexpected response:',
      data
    )

    return {
      ok: false,
      message:
        'The invitation was saved, but the email could not be confirmed as sent. You can retry it below.',
    }
  }

  return {
    ok: true,
    message: 'Invitation email sent.',
  }
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

export async function createAccessInvitation(
  formData: FormData
) {
  await requireDashboardOwner()

  const email =
    getRequiredText(
      formData,
      'email'
    ).toLowerCase()

  const viewerEnabled =
    getRequiredText(
      formData,
      'viewer_enabled'
    ) === 'true'

  const paperIds =
    getPaperIds(formData)

  if (!email) {
    redirectInvitationStatus(
      'error',
      'Enter an email address.'
    )
  }

  if (
    !viewerEnabled &&
    paperIds.length === 0
  ) {
    redirectInvitationStatus(
      'error',
      'Select Viewer access, at least one Coauthor paper, or both.'
    )
  }

  const supabase =
    await createClient()

  const {
    data: invitationId,
    error,
  } = await supabase.rpc(
    'create_access_invitation',
    {
      p_email: email,
      p_viewer_enabled:
        viewerEnabled,
      p_paper_ids: paperIds,
    }
  )

  if (error || !invitationId) {
    console.error(
      'Access invitation creation failed:',
      error
    )

    const message =
      error?.message ?? ''

    if (
      message.includes(
        'account already exists'
      )
    ) {
      redirectInvitationStatus(
        'error',
        'An account already exists for this email address. Manage it in the Accounts section above.'
      )
    }

    if (
      message.includes(
        'active invitation already exists'
      )
    ) {
      redirectInvitationStatus(
        'error',
        'An active invitation already exists for this email address.'
      )
    }

    if (
      message.includes(
        'valid email address'
      )
    ) {
      redirectInvitationStatus(
        'error',
        'Enter a valid email address.'
      )
    }

    if (
      message.includes(
        'unavailable'
      )
    ) {
      redirectInvitationStatus(
        'error',
        'One or more selected papers are archived or otherwise unavailable.'
      )
    }

    redirectInvitationStatus(
      'error',
      'The invitation could not be created.'
    )
  }

  const result =
    await sendInvitation(
      supabase,
      String(invitationId)
    )

  revalidatePath('/dashboard/access')

  redirectInvitationStatus(
    result.ok
      ? 'notice'
      : 'error',
    result.message
  )
}

export async function retryAccessInvitation(
  formData: FormData
) {
  await requireDashboardOwner()

  const invitationId =
    getRequiredText(
      formData,
      'invitation_id'
    )

  if (!invitationId) {
    redirectInvitationStatus(
      'error',
      'Select an invitation to retry.'
    )
  }

  const supabase =
    await createClient()

  const result =
    await sendInvitation(
      supabase,
      invitationId
    )

  revalidatePath('/dashboard/access')

  redirectInvitationStatus(
    result.ok
      ? 'notice'
      : 'error',
    result.ok
      ? 'Invitation email sent.'
      : result.message
  )
}

export async function cancelAccessInvitation(
  formData: FormData
) {
  await requireDashboardOwner()

  const invitationId =
    getRequiredText(
      formData,
      'invitation_id'
    )

  if (!invitationId) {
    redirectInvitationStatus(
      'error',
      'Select an invitation to cancel.'
    )
  }

  const supabase =
    await createClient()

  const { data, error } =
    await supabase.rpc(
      'cancel_access_invitation',
      {
        p_invitation_id:
          invitationId,
      }
    )

  if (error) {
    console.error(
      'Invitation cancellation failed:',
      error
    )

    redirectInvitationStatus(
      'error',
      'The invitation could not be cancelled.'
    )
  }

  const authUserId =
    data &&
    typeof data === 'object' &&
    'auth_user_id' in data &&
    typeof data.auth_user_id === 'string'
      ? data.auth_user_id
      : null

  if (authUserId) {
    const {
      data: cleanup,
      error: cleanupError,
    } = await supabase.functions.invoke(
      'delete-dashboard-account',
      {
        body: {
          user_id: authUserId,
        },
      }
    )

    if (
      cleanupError ||
      !cleanup ||
      cleanup.ok !== true
    ) {
      console.error(
        'Cancelled invitation account cleanup failed:',
        cleanupError ?? cleanup
      )

      revalidatePath('/dashboard/access')

      redirectInvitationStatus(
        'error',
        'Invitation cancelled, but its unused onboarding account could not be removed automatically. It can be deleted from Accounts.'
      )
    }
  }

  revalidatePath('/dashboard/access')

  redirectInvitationStatus(
    'notice',
    authUserId
      ? 'Invitation cancelled and its unused onboarding account removed.'
      : 'Invitation cancelled. No dashboard permissions were activated.'
  )
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

  const paperIds =
    getPaperIds(formData)

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
      error.message.includes(
        'unavailable'
      )
        ? 'Archived papers cannot receive new Coauthor assignments.'
        : 'Coauthor paper assignments could not be saved.'
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
