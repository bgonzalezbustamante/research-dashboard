import { createClient } from '@/lib/supabase/server'

import { revalidatePath } from 'next/cache'

import {
  type NextRequest,
  NextResponse,
} from 'next/server'

export async function POST(
  request: NextRequest
) {
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