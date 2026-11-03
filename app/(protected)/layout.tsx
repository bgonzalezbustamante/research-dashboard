import Link from 'next/link'

import AppNavigation from '@/components/app-navigation'
import OxfordLogo from '@/components/oxford-logo'
import OwnerUtilityNavigation from '@/components/owner-utility-navigation'
import FormattingHints from '@/components/papers/formatting-hints'
import ResearchTextEnhancer from '@/components/papers/research-text-enhancer'
import ReadOnlyMode from '@/components/read-only-mode'
import SiteFooter from '@/components/site-footer'
import { requireAppAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const access =
    await requireAppAccess()

  const supabase =
    await createClient()

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', access.userId)
    .maybeSingle()

  if (profileError) {
    throw new Error(
      `Could not load profile: ${profileError.message}`
    )
  }

  const fullName =
    profile?.full_name?.trim() ??
    ''

  const isOwner =
    access.canEditDashboard

  const isViewer =
    access.dashboardRole === 'viewer'

  const isWebsiteEditor =
    !isOwner &&
    access.hasWebsiteEditorAccess

  const homeHref =
    access.hasDashboardAccess
      ? '/dashboard'
      : '/website'

  const readOnlyByDefault =
    !isOwner

  let accessMessage = ''

  if (isViewer && isWebsiteEditor) {
    accessMessage =
      'Viewer + Website Editor access. Dashboard-wide access is read-only; under Website you can edit the public Website content of assigned papers.'
  } else if (isViewer) {
    accessMessage =
      'Read-only access. You can browse Dashboard, Hours, Planning, and Papers, but changes are disabled.'
  } else if (isWebsiteEditor) {
    accessMessage =
      'Website Editor access. You can edit the public Website content of the papers assigned to you.'
  }

  return (
    <div
      data-app-read-only={
        readOnlyByDefault
          ? 'true'
          : 'false'
      }
      data-has-dashboard-access={
        access.hasDashboardAccess
          ? 'true'
          : 'false'
      }
      data-dashboard-role={
        access.dashboardRole ??
        'website-editor'
      }
      className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal"
    >
      <ReadOnlyMode
        enabled={readOnlyByDefault}
      />

      <FormattingHints />
      <ResearchTextEnhancer />

      <header className="border-b border-oxford-stone bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Link
                href={homeHref}
                aria-label={
                  access.hasDashboardAccess
                    ? 'Go to dashboard'
                    : 'Go to website editing'
                }
                className="inline-flex"
              >
                <OxfordLogo className="w-[190px]" />
              </Link>

              <div className="hidden h-10 w-px bg-oxford-stone sm:block" />

              <Link
                href={homeHref}
                className="font-serif text-lg font-semibold text-oxford-blue transition hover:opacity-80"
              >
                Research Dashboard
              </Link>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <AppNavigation
                showDashboardModules={
                  access.hasDashboardAccess
                }
                showWebsiteEditor={
                  isWebsiteEditor
                }
              />

              {(isViewer || isWebsiteEditor) && (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {isViewer && (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                      Viewer
                    </span>
                  )}

                  {isWebsiteEditor && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
                      Website Editor
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {accessMessage && (
        <div className="border-b border-sky-200 bg-sky-50">
          <div className="mx-auto max-w-7xl px-6 py-3 text-sm text-sky-900">
            {accessMessage}
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </main>

      <OwnerUtilityNavigation
        showOwnerLinks={isOwner}
        accountLabel={
          fullName || 'Account'
        }
      />

      <SiteFooter />
    </div>
  )
}
