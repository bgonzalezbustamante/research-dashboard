'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { createClient } from '@/lib/supabase/client'

function getPaperId(
  pathname: string
) {
  const match =
    pathname.match(
      /^\/papers\/([^/]+)\/?$/
    )

  return match?.[1] ?? null
}

export default function CoauthorPaperShortcut() {
  const pathname = usePathname()

  const paperId = useMemo(
    () => getPaperId(pathname),
    [pathname]
  )

  const [isCoauthor, setIsCoauthor] =
    useState(false)

  useEffect(() => {
    let active = true

    async function loadPermission() {
      if (!paperId) {
        if (active) {
          setIsCoauthor(false)
        }
        return
      }

      const supabase = createClient()

      const {
        data: claimsData,
        error: claimsError,
      } = await supabase.auth.getClaims()

      const userId =
        claimsData?.claims?.sub

      if (
        claimsError ||
        typeof userId !== 'string'
      ) {
        if (active) {
          setIsCoauthor(false)
        }
        return
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from('paper_members')
        .select('role')
        .eq('paper_id', paperId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!active) {
        return
      }

      setIsCoauthor(
        !membershipError &&
        membership?.role === 'coauthor'
      )
    }

    void loadPermission()

    return () => {
      active = false
    }
  }, [paperId])

  if (
    !paperId ||
    !isCoauthor
  ) {
    return null
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <strong className="font-medium">
          Coauthor permission.
        </strong>{' '}
        You can edit this paper&apos;s
        full title; all other fields
        remain read-only.
      </div>

      <Link
        href={`/papers/${paperId}/coauthor-title`}
        className="shrink-0 rounded-md border border-green-300 bg-white px-3 py-2 font-medium text-green-900 transition hover:border-green-500"
      >
        Edit full title
      </Link>
    </div>
  )
}
