import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type DashboardRole =
  | 'owner'
  | 'viewer'

export type AppAccess = {
  userId: string
  dashboardOwnerId: string | null
  dashboardRole: DashboardRole | null
  hasDashboardAccess: boolean
  canEditDashboard: boolean
  hasWebsiteEditorAccess: boolean
  isWebsiteEditorOnly: boolean
}

export type DashboardAccess = {
  userId: string
  ownerId: string
  role: DashboardRole
  canEdit: boolean
}

async function requireAuthenticatedUser() {
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

  return {
    supabase,
    userId,
  }
}

export async function requireAppAccess(): Promise<AppAccess> {
  const {
    supabase,
    userId,
  } = await requireAuthenticatedUser()

  const [
    dashboardResult,
    websiteEditorResult,
  ] = await Promise.all([
    supabase
      .from('dashboard_members')
      .select('owner_id, role')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('paper_website_editors')
      .select('paper_id')
      .eq('user_id', userId)
      .limit(1),
  ])

  if (dashboardResult.error) {
    throw new Error(
      `Could not load dashboard access: ${dashboardResult.error.message}`
    )
  }

  if (websiteEditorResult.error) {
    throw new Error(
      `Could not load Website Editor access: ${websiteEditorResult.error.message}`
    )
  }

  const dashboardMembership =
    dashboardResult.data

  const dashboardRole =
    dashboardMembership &&
    ['owner', 'viewer'].includes(
      dashboardMembership.role
    )
      ? (dashboardMembership.role as DashboardRole)
      : null

  const hasWebsiteEditorAccess =
    (websiteEditorResult.data ?? [])
      .length > 0

  if (
    !dashboardRole &&
    !hasWebsiteEditorAccess
  ) {
    redirect('/access-denied')
  }

  return {
    userId,
    dashboardOwnerId:
      dashboardMembership?.owner_id ??
      null,
    dashboardRole,
    hasDashboardAccess:
      dashboardRole !== null,
    canEditDashboard:
      dashboardRole === 'owner',
    hasWebsiteEditorAccess,
    isWebsiteEditorOnly:
      dashboardRole === null &&
      hasWebsiteEditorAccess,
  }
}

export async function requireDashboardAccess(): Promise<DashboardAccess> {
  const access =
    await requireAppAccess()

  if (
    !access.dashboardRole ||
    !access.dashboardOwnerId
  ) {
    redirect('/website')
  }

  return {
    userId: access.userId,
    ownerId:
      access.dashboardOwnerId,
    role:
      access.dashboardRole,
    canEdit:
      access.canEditDashboard,
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

export async function requireWebsiteEditorAccess() {
  const access =
    await requireAppAccess()

  if (!access.hasWebsiteEditorAccess) {
    redirect(
      access.canEditDashboard
        ? '/papers'
        : '/dashboard'
    )
  }

  return access
}
