import Link from 'next/link'

import { login } from './actions'
import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { error, message } = await searchParams

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <OxfordLogo className="w-[220px]" />
          </div>

          <div className="rounded-lg border border-oxford-stone bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-oxford-blue">
              Research Dashboard
            </h1>

            <p className="mb-6 mt-2 text-sm text-oxford-ash">
              Sign in to continue.
            </p>

            {message && (
              <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm leading-5 text-green-800">
                {message}
              </p>
            )}

            <form action={login} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-oxford-charcoal"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-oxford-charcoal"
                  >
                    Password
                  </label>

                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-oxford-blue underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                />
              </div>

              {error && (
                <p className="text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
              >
                Sign in
              </Button>
            </form>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
