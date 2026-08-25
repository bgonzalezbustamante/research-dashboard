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

function clearManagedForms() {
  document
    .querySelectorAll<HTMLFormElement>(
      'form[data-coauthor-managed="true"]'
    )
    .forEach((form) => {
      delete form.dataset.coauthorManaged
      delete form.dataset.coauthorEditable
    })
}

function markCoauthorForms(
  ownNoteIds: Set<string>
) {
  clearManagedForms()

  document
    .querySelectorAll<HTMLFormElement>(
      '#milestones form, #presentations form'
    )
    .forEach((form) => {
      form.dataset.coauthorManaged =
        'true'
      form.dataset.coauthorEditable =
        'true'
    })

  document
    .querySelectorAll<HTMLFormElement>(
      '#notes form'
    )
    .forEach((form) => {
      const noteId =
        form.querySelector<HTMLInputElement>(
          'input[name="note_id"]'
        )?.value

      const editable =
        !noteId ||
        ownNoteIds.has(noteId)

      if (!editable) {
        return
      }

      form.dataset.coauthorManaged =
        'true'
      form.dataset.coauthorEditable =
        'true'
    })
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

    clearManagedForms()

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

      if (
        !active ||
        membershipError ||
        membership?.role !== 'coauthor'
      ) {
        if (active) {
          setIsCoauthor(false)
        }
        return
      }

      const {
        data: ownNotes,
        error: noteError,
      } = await supabase
        .from('paper_notes')
        .select('id')
        .eq('paper_id', paperId)
        .eq('created_by', userId)

      if (!active) {
        return
      }

      const ownNoteIds = new Set(
        noteError
          ? []
          : (ownNotes ?? []).map(
              (note) => note.id
            )
      )

      markCoauthorForms(
        ownNoteIds
      )
      setIsCoauthor(true)
    }

    void loadPermission()

    return () => {
      active = false
      clearManagedForms()
    }
  }, [paperId])

  if (
    !paperId ||
    !isCoauthor
  ) {
    return null
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-4xl leading-6">
        <strong className="font-medium">
          Coauthor permission.
        </strong>{' '}
        You can edit the full title,
        authors, abstract, target/current
        venue, research links, milestones,
        presentations, and your own notes.
        The short title and workflow fields
        remain owner-only.
      </div>

      <Link
        href={`/papers/${paperId}/coauthor-title`}
        className="shrink-0 rounded-md border border-green-300 bg-white px-3 py-2 font-medium text-green-900 transition hover:border-green-500"
      >
        Edit paper details
      </Link>
    </div>
  )
}
