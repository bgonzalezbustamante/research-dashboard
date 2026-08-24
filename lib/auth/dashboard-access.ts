import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type DashboardRole =
  | 'owner'
  | 'viewer'

export type DashboardAccess = {
  userId: string
  ownerId: string
  role: DashboardRole
  canEdit: boolean
}

export async function requireDashboardAccess(): Promise<DashboardAccess> {
  const supabase =
    await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const userId =
    data?.claims?.sub

  if (
    error ||
    typeof userId !== 'string'
  ) {
    redirect('/login')
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('dashboard_members')
    .select('owner_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    throw new Error(
      `Could not load dashboard access: ${membershipError.message}`
    )
  }

  if (
    !membership ||
    ![
      'owner',
      'viewer',
    ].includes(membership.role)
  ) {
    redirect('/access-denied')
  }

  const role =
    membership.role as DashboardRole

  return {
    userId,
    ownerId:
      membership.owner_id,
    role,
    canEdit:
      role === 'owner',
  }
}

export async function requireDashboardOwner() {
  const access =
    await requireDashboardAccess()

  if (!access.canEdit) {
    redirect('/dashboard')
  }

  return access
}
