'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value = getRequiredText(
    formData,
    name
  )

  return value || null
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function parseAuthors(
  formData: FormData
) {
  const raw = getRequiredText(
    formData,
    'authors'
  )

  const seen = new Set<string>()

  return raw
    .split(/\r?\n/)
    .map((author) => author.trim())
    .filter(Boolean)
    .filter((author) => {
      const key =
        author.toLocaleLowerCase()

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .map((fullName) => ({
      full_name: fullName,
    }))
}

function parseLinks(
  formData: FormData
) {
  const fields = [
    {
      field: 'overleaf_url',
      link_type: 'overleaf',
      label: 'Overleaf',
    },
    {
      field: 'dataverse_url',
      link_type: 'dataverse',
      label: 'Dataverse',
    },
    {
      field: 'github_url',
      link_type: 'github',
      label: 'GitHub',
    },
    {
      field: 'preprint_url',
      link_type: 'preprint',
      label: 'Preprint',
    },
    {
      field: 'publication_url',
      link_type: 'publication',
      label: 'DOI / publication',
    },
  ]

  const links = []

  for (const [index, field] of
    fields.entries()) {
    const url = getOptionalText(
      formData,
      field.field
    )

    if (!url) {
      continue
    }

    if (!isValidHttpUrl(url)) {
      throw new Error(
        `${field.label} must be a valid HTTP or HTTPS URL.`
      )
    }

    links.push({
      link_type: field.link_type,
      label: field.label,
      url,
      sort_order: index + 1,
    })
  }

  return links
}

function redirectEditError(
  paperId: string,
  message: string
): never {
  redirect(
    `/papers/${encodeURIComponent(
      paperId
    )}/coauthor-title?editError=${encodeURIComponent(
      message
    )}#paper-collaboration`
  )
}

export async function updateCoauthorPaperDetails(
  formData: FormData
) {
  const paperId = getRequiredText(
    formData,
    'paper_id'
  )

  if (!paperId) {
    redirect('/papers')
  }

  const title = getRequiredText(
    formData,
    'title'
  )

  if (!title) {
    redirectEditError(
      paperId,
      'Full title is required.'
    )
  }

  const authors =
    parseAuthors(formData)

  if (authors.length === 0) {
    redirectEditError(
      paperId,
      'At least one author is required.'
    )
  }

  let links

  try {
    links = parseLinks(formData)
  } catch (error) {
    redirectEditError(
      paperId,
      error instanceof Error
        ? error.message
        : 'Invalid research link.'
    )
  }

  const supabase =
    await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const userId =
    data?.claims?.sub

  if (
    error ||
    typeof userId !== 'string'
  ) {
    redirect('/login')
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
    membershipError ||
    membership?.role !== 'coauthor'
  ) {
    redirectEditError(
      paperId,
      'Coauthor access is required to edit these paper fields.'
    )
  }

  const {
    data: updatedPaperId,
    error: updateError,
  } = await supabase.rpc(
    'update_coauthor_paper_collaboration',
    {
      p_paper_id: paperId,
      p_title: title,
      p_abstract: getOptionalText(
        formData,
        'abstract'
      ),
      p_target_venue: getOptionalText(
        formData,
        'target_venue'
      ),
      p_current_venue: getOptionalText(
        formData,
        'current_venue'
      ),
      p_authors: authors,
      p_links: links,
    }
  )

  if (
    updateError ||
    updatedPaperId !== paperId
  ) {
    console.error(
      'Coauthor paper update failed:',
      updateError
    )

    redirectEditError(
      paperId,
      'The collaborative paper fields could not be updated.'
    )
  }

  revalidatePath('/papers')
  revalidatePath(
    `/papers/${paperId}`
  )

  redirect(
    `/papers/${paperId}#overview`
  )
}
