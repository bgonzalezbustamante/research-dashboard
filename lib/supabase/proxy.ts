import { createServerClient } from '@supabase/ssr'

import {
  NextResponse,
  type NextRequest,
} from 'next/server'

function isDashboardOnlyPath(
  pathname: string
) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/hours' ||
    pathname.startsWith('/hours/') ||
    pathname === '/planning' ||
    pathname.startsWith('/planning/')
  )
}

function isPublicPath(
  pathname: string
) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname === '/release-notes'
  )
}

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    })

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },

          setAll(
            cookiesToSet,
            headers
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) =>
                request.cookies.set(
                  name,
                  value
                )
            )

            supabaseResponse =
              NextResponse.next({
                request,
              })

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) =>
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options
                )
            )

            Object.entries(
              headers
            ).forEach(
              ([
                key,
                value,
              ]) =>
                supabaseResponse.headers.set(
                  key,
                  value
                )
            )
          },
        },
      }
    )

  const { data } =
    await supabase.auth.getClaims()

  const user =
    data?.claims

  if (
    !user &&
    !isPublicPath(
      request.nextUrl.pathname
    )
  ) {
    const siteUrl =
      process.env
        .NEXT_PUBLIC_SITE_URL ??
      request.nextUrl.origin

    return NextResponse.redirect(
      new URL(
        '/login',
        siteUrl
      )
    )
  }

  const userId =
    user?.sub

  if (
    typeof userId === 'string' &&
    isDashboardOnlyPath(
      request.nextUrl.pathname
    )
  ) {
    const {
      data: dashboardMembership,
      error: membershipError,
    } = await supabase
      .from('dashboard_members')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (
      !membershipError &&
      !dashboardMembership
    ) {
      const siteUrl =
        process.env
          .NEXT_PUBLIC_SITE_URL ??
        request.nextUrl.origin

      return NextResponse.redirect(
        new URL(
          '/papers',
          siteUrl
        )
      )
    }
  }

  return supabaseResponse
}
