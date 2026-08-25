import { redirect } from 'next/navigation'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

import { completeOnboarding } from './actions'

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

type InvitationPaper = {
  id: string
  short_title: string
  title: string
  archived: boolean
}

type InvitationData = {
  id: string
  email: string
  viewer_enabled: boolean
  owner_id: string
  owner_name: string | null
  papers: InvitationPaper[]
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params =
    await searchParams

  const supabase =
    await createClient()

  const { data: claimsData } =
    await supabase.auth.getClaims()

  const userId =
    claimsData?.claims?.sub

  if (typeof userId !== 'string') {
    redirect('/login')
  }

  const {
    data: invitationData,
    error: invitationError,
  } = await supabase.rpc(
    'get_my_pending_access_invitation'
  )

  if (invitationError) {
    throw new Error(
      `Could not load invitation: ${invitationError.message}`
    )
  }

  if (!invitationData) {
    const [
      dashboardMembershipResult,
      coauthorMembershipResult,
    ] = await Promise.all([
      supabase
        .from('dashboard_members')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle(),

      supabase
        .from('paper_members')
        .select('paper_id')
        .eq('user_id', userId)
        .eq('role', 'coauthor')
        .limit(1),
    ])

    if (
      dashboardMembershipResult.data
    ) {
      redirect('/dashboard')
    }

    if (
      (coauthorMembershipResult.data ?? [])
        .length > 0
    ) {
      redirect('/papers')
    }
  }

  const invitation =
    invitationData
      ? (invitationData as InvitationData)
      : null

  const {
    data: profile,
  } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .maybeSingle()

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex justify-center">
            <OxfordLogo className="w-[220px]" />
          </div>

          <div className="rounded-lg border border-oxford-stone bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-oxford-blue">
              Complete your Research Dashboard account
            </h1>

            {!invitation ? (
              <div className="mt-5">
                <p className="text-sm leading-6 text-oxford-ash">
                  No active invitation is available for this account. The invitation may have expired, been cancelled, or already been accepted.
                </p>

                <form
                  action="/auth/signout"
                  method="post"
                  className="mt-6"
                >
                  <Button
                    type="submit"
                    variant="secondary"
                  >
                    Sign out
                  </Button>
                </form>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-oxford-ash">
                  {invitation.owner_name
                    ? `${invitation.owner_name} invited you to collaborate in this Research Dashboard.`
                    : 'You have been invited to collaborate in this Research Dashboard.'}
                </p>

                <div className="mt-6 rounded-md border border-oxford-stone bg-oxford-off-white p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                    Invitation access
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {invitation.viewer_enabled && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                        Viewer · dashboard-wide read-only
                      </span>
                    )}

                    {invitation.papers.length > 0 && (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
                        Coauthor · {invitation.papers.length}{' '}
                        {invitation.papers.length === 1
                          ? 'paper'
                          : 'papers'}
                      </span>
                    )}
                  </div>

                  {invitation.papers.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {invitation.papers.map(
                        (paper) => (
                          <div
                            key={paper.id}
                            className="rounded-md border border-oxford-stone bg-white px-3 py-2.5"
                          >
                            <div className="text-sm font-medium text-oxford-charcoal">
                              {paper.short_title}
                            </div>
                            <div className="mt-0.5 text-xs leading-5 text-oxford-ash">
                              {paper.title}
                              {paper.archived
                                ? ' · Archived'
                                : ''}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <form
                  action={completeOnboarding}
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1 block text-sm font-medium text-oxford-charcoal"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={
                        profile?.email ??
                        invitation.email
                      }
                      disabled
                      className="w-full rounded-md border border-oxford-stone bg-oxford-shell px-3 py-2 text-oxford-ash"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="full_name"
                      className="mb-1 block text-sm font-medium text-oxford-charcoal"
                    >
                      Full name
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      required
                      minLength={2}
                      defaultValue={
                        profile?.full_name ?? ''
                      }
                      autoComplete="name"
                      className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="password"
                        className="mb-1 block text-sm font-medium text-oxford-charcoal"
                      >
                        Password
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm_password"
                        className="mb-1 block text-sm font-medium text-oxford-charcoal"
                      >
                        Confirm password
                      </label>
                      <input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                      />
                    </div>
                  </div>

                  <p className="text-xs leading-5 text-oxford-ash">
                    Use at least 8 characters. Completing onboarding activates only the permissions shown above.
                  </p>

                  {params.error && (
                    <p className="text-sm font-medium text-red-700">
                      {params.error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                  >
                    Complete account and accept invitation
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
