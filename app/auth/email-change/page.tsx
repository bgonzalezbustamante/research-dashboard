import Link from 'next/link'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'

type EmailChangePageProps = {
  searchParams: Promise<{
    error?: string
    error_description?: string
  }>
}

export default async function EmailChangePage({
  searchParams,
}: EmailChangePageProps) {
  const params = await searchParams

  const errorMessage =
    params.error_description ??
    params.error ??
    ''

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <OxfordLogo className="w-[220px]" />
          </div>

          <div className="rounded-lg border border-oxford-stone bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-oxford-blue">
              Email change confirmation
            </h1>

            {errorMessage ? (
              <>
                <p className="mt-4 text-sm leading-6 text-red-700">
                  The email confirmation could not be completed: {errorMessage}
                </p>
                <p className="mt-3 text-sm leading-6 text-oxford-ash">
                  Return to your Account page and request the change again if necessary.
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-oxford-ash">
                  This email confirmation has been received.
                </p>
                <p className="mt-3 text-sm leading-6 text-oxford-ash">
                  If secure email change is enabled, you must complete the confirmation sent to both your current and new email addresses before the new address becomes your sign-in email.
                </p>
              </>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/account"
                className="text-sm font-medium text-oxford-blue underline-offset-4 hover:underline"
              >
                Go to Account
              </Link>

              <Link
                href="/login"
                className="text-sm font-medium text-oxford-ash underline-offset-4 hover:underline"
              >
                Go to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
