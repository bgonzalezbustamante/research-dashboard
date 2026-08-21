'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const allowedStatuses = new Set([
  'writing',
  'under-review',
  'revise-round',
  'published',
  'standby',
  'deprecated',
])

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function getOptionalDate(
  formData: FormData,
  name: string
) {
  const value = getOptionalText(
    formData,
    name
  )

  if (!value) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null
}

function getOptionalPositiveInteger(
  formData: FormData,
  name: string
) {
  const value = getOptionalText(
    formData,
    name
  )

  if (!value) {
    return null
  }

  const parsed = Number.parseInt(
    value,
    10
  )

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return null
  }

  return parsed
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

function parseAuthors(formData: FormData) {
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

function parseLinks(formData: FormData) {
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

  for (const [
    index,
    field,
  ] of fields.entries()) {
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

function getPaperPayload(
  formData: FormData
) {
  const shortTitle =
    getRequiredText(
      formData,
      'short_title'
    )

  const title =
    getRequiredText(
      formData,
      'title'
    )

  const status =
    getRequiredText(
      formData,
      'status'
    )

  const authors =
    parseAuthors(formData)

  if (!shortTitle || !title) {
    return {
      error:
        'Short title and full title are required.',
    }
  }

  if (!allowedStatuses.has(status)) {
    return {
      error: 'Invalid paper status.',
    }
  }

  if (authors.length === 0) {
    return {
      error:
        'At least one author is required.',
    }
  }

  const revisionRound =
    getOptionalPositiveInteger(
      formData,
      'revision_round'
    )

  if (
    status === 'revise-round' &&
    !revisionRound
  ) {
    return {
      error:
        'Revision round is required when the status is Revise round.',
    }
  }

  let links

  try {
    links = parseLinks(formData)
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Invalid URL.',
    }
  }

  return {
    payload: {
      shortTitle,
      title,
      status,
      authors,
      revisionRound,
      links,
      abstract: getOptionalText(
        formData,
        'abstract'
      ),
      targetVenue: getOptionalText(
        formData,
        'target_venue'
      ),
      currentVenue: getOptionalText(
        formData,
        'current_venue'
      ),
      startedOn: getOptionalDate(
        formData,
        'started_on'
      ),
      publishedOn: getOptionalDate(
        formData,
        'published_on'
      ),
    },
  }
}

async function requireAuth() {
  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.auth.getClaims()

  if (
    error ||
    !data?.claims
  ) {
    redirect('/login')
  }

  return supabase
}

export async function createPaper(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const result =
    getPaperPayload(formData)

  if (!result.payload) {
    redirect(
      `/papers/new?error=${encodeURIComponent(
        result.error ??
          'Invalid paper.'
      )}`
    )
  }

  const payload = result.payload

  const {
    data: paperId,
    error,
  } = await supabase.rpc(
    'create_paper_with_details',
    {
      p_short_title:
        payload.shortTitle,
      p_title: payload.title,
      p_abstract:
        payload.abstract,
      p_status:
        payload.status,
      p_revision_round:
        payload.status ===
        'revise-round'
          ? payload.revisionRound
          : null,
      p_target_venue:
        payload.targetVenue,
      p_current_venue:
        payload.currentVenue,
      p_started_on:
        payload.startedOn,
      p_published_on:
        payload.publishedOn,
      p_authors:
        payload.authors,
      p_links:
        payload.links,
    }
  )

  if (
    error ||
    typeof paperId !== 'string'
  ) {
    console.error(
      'Paper creation failed:',
      error
    )

    redirect(
      '/papers/new?error=The paper could not be created. Please check the form and try again.'
    )
  }

  revalidatePath('/papers')

  redirect(
    `/papers/${paperId}`
  )
}

export async function updatePaper(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/papers')
  }

  const result =
    getPaperPayload(formData)

  if (!result.payload) {
    redirect(
      `/papers/${paperId}/edit?error=${encodeURIComponent(
        result.error ??
          'Invalid paper.'
      )}`
    )
  }

  const payload = result.payload

  const {
    data: updatedPaperId,
    error,
  } = await supabase.rpc(
    'update_paper_with_details',
    {
      p_paper_id:
        paperId,
      p_short_title:
        payload.shortTitle,
      p_title:
        payload.title,
      p_abstract:
        payload.abstract,
      p_status:
        payload.status,
      p_revision_round:
        payload.status ===
        'revise-round'
          ? payload.revisionRound
          : null,
      p_target_venue:
        payload.targetVenue,
      p_current_venue:
        payload.currentVenue,
      p_started_on:
        payload.startedOn,
      p_published_on:
        payload.publishedOn,
      p_authors:
        payload.authors,
      p_links:
        payload.links,
    }
  )

  if (
    error ||
    typeof updatedPaperId !==
      'string'
  ) {
    console.error(
      'Paper update failed:',
      error
    )

    redirect(
      `/papers/${paperId}/edit?error=The paper could not be updated. Please check the form and try again.`
    )
  }

  revalidatePath('/papers')
  revalidatePath(
    `/papers/${paperId}`
  )

  redirect(
    `/papers/${paperId}`
  )
}

export async function archivePaper(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('papers')
    .update({
      archived_at:
        new Date().toISOString(),
    })
    .eq('id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(
      'The paper could not be archived.'
    )
  }

  revalidatePath('/papers')
  revalidatePath(
    `/papers/${paperId}`
  )

  redirect(
    '/papers?archive=archived'
  )
}

export async function restorePaper(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('papers')
    .update({
      archived_at: null,
    })
    .eq('id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(
      'The paper could not be restored.'
    )
  }

  revalidatePath('/papers')
  revalidatePath(
    `/papers/${paperId}`
  )

  redirect(
    `/papers/${paperId}`
  )
}