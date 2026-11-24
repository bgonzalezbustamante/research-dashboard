import { createClient } from '@/lib/supabase/server'

import { revalidatePath } from 'next/cache'

import {
  type NextRequest,
  NextResponse,
} from 'next/server'

export async function POST(
  request: NextRequest
) {
  // Only the Dashboard's own sign-out forms may end a session (same check as
  // the backups route); a form on another site gets 403.
  const origin =
    request.headers.get(
      'origin'
    )

  if (
    !origin ||
    origin !==
      new URL(
        request.url
      ).origin
  ) {
    return new NextResponse(
      'Sign-out requests must originate from Research Dashboard.',
      {
        status: 403,
      }
    )
  }

  const supabase =
    await createClient()

  const { data } =
    await supabase.auth.getClaims()

  if (data?.claims) {
    await supabase.auth.signOut()
  }

  revalidatePath(
    '/',
    'layout'
  )

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(
      request.url
    ).origin

  return NextResponse.redirect(
    new URL(
      '/login',
      siteUrl
    ),
    {
      status: 302,
    }
  )
}