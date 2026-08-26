import PageHeader from '@/components/page-header'
import Card from '@/components/ui/card'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import AccountCard from './account-card'
import InvitationCard from './invitation-card'
import InviteAccountForm from './invite-account-form'
import type {
  AccessInvitationRow,
  PaperRow,
  ProfileRow,
} from './types'

type AccessPageProps = {
  searchParams: Promise<{
    notice?: string
    error?: string
    section?: string
  }>
}

type DashboardMemberRow = {
  user_id: string
  role: string
}

type PaperMemberRow = {
  paper_id: string
  user_id: string
  role: string
}

type InvitationPaperRow = {
  invitation_id: string
  paper_id: string
}

function displayName(
  profile: ProfileRow
) {
  return (
    profile.full_name?.trim() ||
    profile.email?.trim() ||
    'Unnamed account'
  )
}

export default async function AccessPage({
  searchParams,
}: AccessPageProps) {
  const params =
    await searchParams

  const access =
    await requireDashboardOwner()

  const supabase =
    await createClient()

  const [
    profilesResult,
    dashboardMembersResult,
    papersResult,
    paperMembersResult,
    invitationsResult,
    invitationPapersResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, email, full_name, deactivated_at'
      )
      .order('full_name', {
        ascending: true,
        nullsFirst: false,
      }),

    supabase
      .from('dashboard_members')
      .select('user_id, role')
      .eq('owner_id', access.ownerId),

    supabase
      .from('papers')
      .select(
        'id, short_title, title, archived_at'
      )
      .eq('owner_id', access.ownerId)
      .order('short_title', {
        ascending: true,
      }),

    supabase
      .from('paper_members')
      .select('paper_id, user_id, role')
      .eq('role', 'coauthor'),

    supabase
      .from('access_invitations')
      .select(
        'id, email, viewer_enabled, status, auth_user_id, sent_at, created_at, last_error'
      )
      .eq('owner_id', access.ownerId)
      .in(
        'status',
        ['pending', 'sent', 'failed']
      )
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('access_invitation_papers')
      .select('invitation_id, paper_id'),
  ])

  if (profilesResult.error) {
    throw new Error(
      `Could not load profiles: ${profilesResult.error.message}`
    )
  }

  if (dashboardMembersResult.error) {
    throw new Error(
      `Could not load dashboard memberships: ${dashboardMembersResult.error.message}`
    )
  }

  if (papersResult.error) {
    throw new Error(
      `Could not load papers: ${papersResult.error.message}`
    )
  }

  if (paperMembersResult.error) {
    throw new Error(
      `Could not load paper memberships: ${paperMembersResult.error.message}`
    )
  }

  if (invitationsResult.error) {
    throw new Error(
      `Could not load invitations: ${invitationsResult.error.message}`
    )
  }

  if (invitationPapersResult.error) {
    throw new Error(
      `Could not load invitation papers: ${invitationPapersResult.error.message}`
    )
  }

  const profiles =
    (profilesResult.data ?? []) as ProfileRow[]

  const dashboardMembers =
    (dashboardMembersResult.data ?? []) as DashboardMemberRow[]

  const papers =
    (papersResult.data ?? []) as PaperRow[]

  const paperMembers =
    (paperMembersResult.data ?? []) as PaperMemberRow[]

  const invitations =
    (invitationsResult.data ?? []) as AccessInvitationRow[]

  const invitationPapers =
    (invitationPapersResult.data ?? []) as InvitationPaperRow[]

  const ownerProfile =
    profiles.find(
      (profile) =>
        profile.id === access.userId
    )

  const invitedUserIds =
    new Set(
      invitations
        .map(
          (invitation) =>
            invitation.auth_user_id
        )
        .filter(
          (userId): userId is string =>
            Boolean(userId)
        )
    )

  const accounts =
    profiles.filter(
      (profile) =>
        profile.id !== access.userId &&
        !profile.deactivated_at &&
        !invitedUserIds.has(profile.id)
    )

  const viewerIds =
    new Set(
      dashboardMembers
        .filter(
          (member) =>
            member.role === 'viewer'
        )
        .map(
          (member) =>
            member.user_id
        )
    )

  const coauthorPaperIdsByUser =
    new Map<string, Set<string>>()

  for (const member of paperMembers) {
    if (member.role !== 'coauthor') {
      continue
    }

    const existing =
      coauthorPaperIdsByUser.get(
        member.user_id
      ) ?? new Set<string>()

    existing.add(member.paper_id)

    coauthorPaperIdsByUser.set(
      member.user_id,
      existing
    )
  }

  const invitationPaperIds =
    new Map<string, Set<string>>()

  for (const row of invitationPapers) {
    const existing =
      invitationPaperIds.get(
        row.invitation_id
      ) ?? new Set<string>()

    existing.add(row.paper_id)

    invitationPaperIds.set(
      row.invitation_id,
      existing
    )
  }

  const papersById =
    new Map(
      papers.map(
        (paper) => [
          paper.id,
          paper,
        ] as const
      )
    )

  const coauthorAccountIds =
    new Set(
      [...coauthorPaperIdsByUser.entries()]
        .filter(
          ([, paperIds]) =>
            paperIds.size > 0
        )
        .map(([userId]) => userId)
    )

  const combinedCount =
    accounts.filter(
      (profile) =>
        viewerIds.has(profile.id) &&
        coauthorAccountIds.has(
          profile.id
        )
    ).length

  const invitationStatus =
    params.section === 'invitations'

  return (
    <div>
      <PageHeader
        title="Access management"
        description="Manage existing collaborator accounts, then invite new Viewers and paper-scoped Coauthors."
      />

      {!invitationStatus && params.notice && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {params.notice}
        </div>
      )}

      {!invitationStatus && params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Existing accounts
          </div>
          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {accounts.length}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Viewers
          </div>
          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {viewerIds.size}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Coauthors
          </div>
          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {coauthorAccountIds.size}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Viewer + Coauthor
          </div>
          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {combinedCount}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Pending invitations
          </div>
          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {invitations.length}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Dashboard owner
            </div>
            <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
              {ownerProfile
                ? displayName(ownerProfile)
                : 'Owner'}
            </h2>
            {ownerProfile?.email && (
              <p className="mt-1 text-sm text-oxford-ash">
                {ownerProfile.email}
              </p>
            )}
          </div>

          <span className="inline-flex w-fit rounded-full border border-oxford-sky-blue bg-oxford-cool-grey px-2.5 py-1 text-xs font-medium text-oxford-blue">
            Owner · full access
          </span>
        </div>
      </Card>

      <div className="mb-4">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Accounts
        </h2>
        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Edit account names, delete obsolete accounts, and manage dashboard-wide Viewer access and paper-scoped Coauthor assignments.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card className="mb-6">
          <div className="py-6 text-center">
            <h3 className="font-serif text-lg font-semibold text-oxford-blue">
              No active collaborator accounts
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-oxford-ash">
              Use the invitation form below to add a new Viewer, Coauthor, or combined account.
            </p>
          </div>
        </Card>
      ) : (
        <div className="mb-8 space-y-5">
          {accounts.map((profile) => (
            <AccountCard
              key={profile.id}
              profile={profile}
              isViewer={
                viewerIds.has(profile.id)
              }
              assignedPaperIds={[
                ...(
                  coauthorPaperIdsByUser.get(
                    profile.id
                  ) ?? new Set<string>()
                ),
              ]}
              papers={papers}
            />
          ))}
        </div>
      )}

      <div
        id="invitations"
        className="mb-4 mt-8 scroll-mt-6 border-t border-oxford-stone pt-8"
      >
        {invitationStatus && params.notice && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {params.notice}
          </div>
        )}

        {invitationStatus && params.error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error}
          </div>
        )}

        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Invitations
        </h2>
        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Invite new collaborators after managing existing accounts. Permissions remain inactive until onboarding is completed.
        </p>
      </div>

      <InviteAccountForm papers={papers} />

      {invitations.length > 0 && (
        <div className="mb-6">
          <div className="mb-4">
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Pending invitations
            </h3>
            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              These accounts have not completed onboarding, so their Viewer and Coauthor permissions are not active yet.
            </p>
          </div>

          <div className="space-y-4">
            {invitations.map(
              (invitation) => {
                const selectedPapers = [
                  ...(
                    invitationPaperIds.get(
                      invitation.id
                    ) ?? new Set<string>()
                  ),
                ]
                  .map(
                    (paperId) =>
                      papersById.get(paperId)
                  )
                  .filter(
                    (paper): paper is PaperRow =>
                      Boolean(paper)
                  )

                return (
                  <InvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    papers={selectedPapers}
                  />
                )
              }
            )}
          </div>
        </div>
      )}

      <Card className="mt-6 border-dashed">
        <h2 className="font-serif text-lg font-semibold text-oxford-blue">
          Next: F.6 audit and hardening
        </h2>
        <p className="mt-2 text-sm leading-6 text-oxford-ash">
          The final Phase F checkpoint will audit permission transitions, invitation cancellation and stale accounts, archived-paper behaviour, direct API mutation attempts and access-change traceability before Misty Delta is tagged.
        </p>
      </Card>
    </div>
  )
}
