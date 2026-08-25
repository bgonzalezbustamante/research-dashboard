import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  cancelAccessInvitation,
  createAccessInvitation,
  retryAccessInvitation,
  saveCoauthorAssignments,
  setViewerAccess,
} from './actions'

type AccessPageProps = {
  searchParams: Promise<{
    notice?: string
    error?: string
  }>
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

type DashboardMemberRow = {
  user_id: string
  role: string
}

type PaperRow = {
  id: string
  short_title: string
  title: string
  archived_at: string | null
}

type PaperMemberRow = {
  paper_id: string
  user_id: string
  role: string
}

type AccessInvitationRow = {
  id: string
  email: string
  viewer_enabled: boolean
  status:
    | 'pending'
    | 'sent'
    | 'failed'
  auth_user_id: string | null
  sent_at: string | null
  created_at: string
  last_error: string | null
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

function formatTimestamp(
  value: string | null
) {
  if (!value) {
    return 'Not sent yet'
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }
  ).format(new Date(value))
}

function invitationStatusLabel(
  status: AccessInvitationRow['status']
) {
  switch (status) {
    case 'sent':
      return 'Sent'
    case 'failed':
      return 'Send failed'
    default:
      return 'Pending'
  }
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
      .select('id, email, full_name')
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

  return (
    <div>
      <PageHeader
        title="Access management"
        description="Invite collaborators and manage dashboard-wide Viewer access and paper-scoped Coauthor assignments."
      />

      {params.notice && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {params.notice}
        </div>
      )}

      {params.error && (
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

      <Card className="mb-6">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Invite account
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-oxford-ash">
          Send a new collaborator an invitation by email. The selected permissions remain inactive until the recipient accepts the email, creates a password and completes onboarding.
        </p>

        <form
          action={createAccessInvitation}
          className="mt-5"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
            <div>
              <label
                htmlFor="invite_email"
                className="mb-1 block text-sm font-medium text-oxford-charcoal"
              >
                Email address
              </label>
              <input
                id="invite_email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="collaborator@example.com"
                className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
              />

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-oxford-stone bg-oxford-off-white p-3">
                <input
                  type="checkbox"
                  name="viewer_enabled"
                  value="true"
                  className="mt-1 h-4 w-4 accent-oxford-blue"
                />
                <span>
                  <span className="block text-sm font-medium text-oxford-charcoal">
                    Dashboard Viewer
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                    Read-only access to Dashboard, Hours, Planning and all Papers.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <h3 className="text-sm font-medium text-oxford-charcoal">
                Paper Coauthor
              </h3>
              <p className="mt-1 text-xs leading-5 text-oxford-ash">
                Optionally select the papers this person may collaborate on. Viewer and Coauthor permissions can be combined.
              </p>

              {papers.length === 0 ? (
                <p className="mt-3 rounded-md border border-oxford-stone bg-oxford-shell px-4 py-3 text-sm text-oxford-ash">
                  No papers are available for assignment.
                </p>
              ) : (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-md border border-oxford-stone bg-oxford-off-white p-3">
                  {papers.map(
                    (paper) => (
                      <label
                        key={paper.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-2.5 text-sm transition hover:bg-oxford-shell"
                      >
                        <input
                          type="checkbox"
                          name="paper_id"
                          value={paper.id}
                          className="mt-1 h-4 w-4 accent-oxford-blue"
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-oxford-charcoal">
                            {paper.short_title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                            {paper.title}
                            {paper.archived_at
                              ? ' · Archived'
                              : ''}
                          </span>
                        </span>
                      </label>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="mt-5"
          >
            Send invitation
          </Button>
        </form>
      </Card>

      {invitations.length > 0 && (
        <div className="mb-6">
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
              Pending invitations
            </h2>
            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              These accounts have not completed onboarding, so their Viewer and Coauthor permissions are not active yet.
            </p>
          </div>

          <div className="space-y-4">
            {invitations.map(
              (invitation) => {
                const selectedPaperIds =
                  invitationPaperIds.get(
                    invitation.id
                  ) ?? new Set<string>()

                const selectedPapers =
                  [...selectedPaperIds]
                    .map(
                      (paperId) =>
                        papersById.get(paperId)
                    )
                    .filter(
                      (paper): paper is PaperRow =>
                        Boolean(paper)
                    )

                return (
                  <Card key={invitation.id}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                          {invitation.email}
                        </h3>
                        <p className="mt-1 text-xs text-oxford-ash">
                          {invitation.sent_at
                            ? `Sent ${formatTimestamp(invitation.sent_at)}`
                            : `Created ${formatTimestamp(invitation.created_at)}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={
                          invitation.status === 'failed'
                            ? 'rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700'
                            : invitation.status === 'sent'
                              ? 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                              : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800'
                        }>
                          {invitationStatusLabel(
                            invitation.status
                          )}
                        </span>

                        {invitation.viewer_enabled && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                            Viewer
                          </span>
                        )}

                        {selectedPapers.length > 0 && (
                          <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
                            Coauthor · {selectedPapers.length}{' '}
                            {selectedPapers.length === 1
                              ? 'paper'
                              : 'papers'}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedPapers.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedPapers.map(
                          (paper) => (
                            <span
                              key={paper.id}
                              className="rounded-md border border-oxford-stone bg-oxford-off-white px-2.5 py-1 text-xs text-oxford-charcoal"
                            >
                              {paper.short_title}
                              {paper.archived_at
                                ? ' · Archived'
                                : ''}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {invitation.status === 'failed' &&
                      invitation.last_error && (
                        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {invitation.last_error}
                        </p>
                      )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {(invitation.status === 'pending' ||
                        invitation.status === 'failed') && (
                        <form action={retryAccessInvitation}>
                          <input
                            type="hidden"
                            name="invitation_id"
                            value={invitation.id}
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                          >
                            Retry email
                          </Button>
                        </form>
                      )}

                      <form action={cancelAccessInvitation}>
                        <input
                          type="hidden"
                          name="invitation_id"
                          value={invitation.id}
                        />
                        <Button
                          type="submit"
                          variant="danger"
                        >
                          Cancel invitation
                        </Button>
                      </form>
                    </div>
                  </Card>
                )
              }
            )}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Accounts
        </h2>
        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Viewer access is dashboard-wide and read-only. Coauthor access is assigned paper by paper and exposes only the collaborative fields permitted by Phase F.3.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <div className="py-6 text-center">
            <h3 className="font-serif text-lg font-semibold text-oxford-blue">
              No active collaborator accounts
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-oxford-ash">
              Use the invitation form above to add a new Viewer, Coauthor, or combined account.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {accounts.map(
            (profile) => {
              const isViewer =
                viewerIds.has(profile.id)

              const assignedPaperIds =
                coauthorPaperIdsByUser.get(
                  profile.id
                ) ?? new Set<string>()

              const isCoauthor =
                assignedPaperIds.size > 0

              return (
                <Card key={profile.id}>
                  <div className="flex flex-col gap-4 border-b border-oxford-stone pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-serif text-xl font-semibold text-oxford-blue">
                        {displayName(profile)}
                      </h3>

                      {profile.email && (
                        <p className="mt-1 text-sm text-oxford-ash">
                          {profile.email}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isViewer && (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                          Viewer
                        </span>
                      )}

                      {isCoauthor && (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
                          Coauthor · {assignedPaperIds.size}{' '}
                          {assignedPaperIds.size === 1
                            ? 'paper'
                            : 'papers'}
                        </span>
                      )}

                      {!isViewer &&
                        !isCoauthor && (
                          <span className="rounded-full border border-oxford-stone bg-oxford-shell px-2.5 py-1 text-xs font-medium text-oxford-ash">
                            No access
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
                    <div>
                      <h4 className="font-medium text-oxford-charcoal">
                        Dashboard Viewer
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-oxford-ash">
                        Read-only access to Dashboard, Hours, Planning and all Papers.
                      </p>

                      <form
                        action={setViewerAccess}
                        className="mt-4"
                      >
                        <input
                          type="hidden"
                          name="user_id"
                          value={profile.id}
                        />
                        <input
                          type="hidden"
                          name="enabled"
                          value={
                            isViewer
                              ? 'false'
                              : 'true'
                          }
                        />

                        <Button
                          type="submit"
                          variant={
                            isViewer
                              ? 'secondary'
                              : 'primary'
                          }
                        >
                          {isViewer
                            ? 'Remove Viewer access'
                            : 'Grant Viewer access'}
                        </Button>
                      </form>
                    </div>

                    <div>
                      <h4 className="font-medium text-oxford-charcoal">
                        Paper Coauthor
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-oxford-ash">
                        Select the papers this account may collaborate on. Saving an empty selection removes all Coauthor assignments.
                      </p>

                      <form
                        action={saveCoauthorAssignments}
                        className="mt-4"
                      >
                        <input
                          type="hidden"
                          name="user_id"
                          value={profile.id}
                        />

                        {papers.length === 0 ? (
                          <p className="rounded-md border border-oxford-stone bg-oxford-shell px-4 py-3 text-sm text-oxford-ash">
                            No papers are available for assignment.
                          </p>
                        ) : (
                          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-oxford-stone bg-oxford-off-white p-3">
                            {papers.map(
                              (paper) => (
                                <label
                                  key={paper.id}
                                  className="flex cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-2.5 text-sm transition hover:bg-oxford-shell"
                                >
                                  <input
                                    type="checkbox"
                                    name="paper_id"
                                    value={paper.id}
                                    defaultChecked={
                                      assignedPaperIds.has(
                                        paper.id
                                      )
                                    }
                                    className="mt-1 h-4 w-4 accent-oxford-blue"
                                  />

                                  <span className="min-w-0">
                                    <span className="font-medium text-oxford-charcoal">
                                      {paper.short_title}
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                                      {paper.title}
                                      {paper.archived_at
                                        ? ' · Archived'
                                        : ''}
                                    </span>
                                  </span>
                                </label>
                              )
                            )}
                          </div>
                        )}

                        <Button
                          type="submit"
                          variant="primary"
                          className="mt-4"
                          disabled={papers.length === 0}
                        >
                          Save paper access
                        </Button>
                      </form>
                    </div>
                  </div>
                </Card>
              )
            }
          )}
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
