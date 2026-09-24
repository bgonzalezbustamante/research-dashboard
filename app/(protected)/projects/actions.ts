'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  requireDashboardOwner,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const allowedStatuses = new Set([
  'active',
  'completed',
])

const allowedVisibilities = new Set([
  'private',
  'public',
])

const slugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const assetFilenamePattern =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$/i

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value =
    getRequiredText(
      formData,
      name
    )

  return value.length > 0
    ? value
    : null
}

function getUuidList(
  formData: FormData,
  name: string
) {
  return formData
    .getAll(name)
    .filter(
      (value):
        value is string =>
        typeof value ===
        'string'
    )
    .map((value) =>
      value.trim()
    )
    .filter(Boolean)
}

function projectsRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted',
  value: string
): never {
  redirect(
    `/projects?${key}=${encodeURIComponent(
      value
    )}`
  )
}

type ValidProjectFields = {
  ok: true
  shortTitle: string
  title: string
  abstract: string
  funder: string
  status: string
  visibility: string
  slug: string | null
  projectImageFilename: string | null
  funderImageFilename: string | null
  paperIds: string[]
  activityLabelIds: string[]
}

type InvalidProjectFields = {
  ok: false
  error: string
}

type ProjectValidationResult =
  | ValidProjectFields
  | InvalidProjectFields

function validateProjectFields(
  formData: FormData
): ProjectValidationResult {
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

  const abstract =
    getRequiredText(
      formData,
      'abstract'
    )

  const funder =
    getRequiredText(
      formData,
      'funder'
    )

  const status =
    getRequiredText(
      formData,
      'status'
    )

  const visibility =
    getRequiredText(
      formData,
      'visibility'
    )

  const rawSlug =
    getOptionalText(
      formData,
      'slug'
    )

  const slug =
    rawSlug?.toLowerCase() ??
    null

  const projectImageFilename =
    getOptionalText(
      formData,
      'project_image_filename'
    )

  const funderImageFilename =
    getOptionalText(
      formData,
      'funder_image_filename'
    )

  if (
    !shortTitle ||
    !title ||
    !abstract ||
    !funder
  ) {
    return {
      ok: false,
      error:
        'Short title, long title, abstract, and funder are required.',
    }
  }

  if (
    !allowedStatuses.has(
      status
    )
  ) {
    return {
      ok: false,
      error:
        'Invalid project status.',
    }
  }

  if (
    !allowedVisibilities.has(
      visibility
    )
  ) {
    return {
      ok: false,
      error:
        'Invalid public visibility.',
    }
  }

  if (
    slug &&
    !slugPattern.test(slug)
  ) {
    return {
      ok: false,
      error:
        'Public slug must use lowercase letters, numbers, and single hyphens only.',
    }
  }

  if (
    visibility === 'public' &&
    !slug
  ) {
    return {
      ok: false,
      error:
        'Public projects require a slug.',
    }
  }

  for (const [
    label,
    filename,
  ] of [
    [
      'Project image',
      projectImageFilename,
    ],
    [
      'Funder image',
      funderImageFilename,
    ],
  ] as const) {
    if (
      filename &&
      !assetFilenamePattern.test(
        filename
      )
    ) {
      return {
        error:
          `${label} filename must be a single PNG, WebP, JPG, or JPEG filename without folders.`,
      }
    }
  }

  return {
    ok: true,
    shortTitle,
    title,
    abstract,
    funder,
    status,
    visibility,
    slug,
    projectImageFilename,
    funderImageFilename,
    paperIds:
      getUuidList(
        formData,
        'paper_ids'
      ),
    activityLabelIds:
      getUuidList(
        formData,
        'activity_label_ids'
      ),
  }
}

function getProjectErrorMessage(
  code?: string,
  message?: string
) {
  if (code === '23505') {
    if (
      message?.includes(
        'activity_label_id'
      )
    ) {
      return 'One of the selected activity labels is already assigned to another project.'
    }

    if (
      message?.includes(
        'slug'
      )
    ) {
      return 'That public project slug is already in use.'
    }

    return 'A project with that short title already exists, or one of the selected values conflicts with another project.'
  }

  if (code === '23514') {
    return 'One of the selected papers or activity labels is not valid for this project.'
  }

  return 'The project could not be saved.'
}

export async function createProject(
  formData: FormData
) {
  await requireDashboardOwner()

  const fields =
    validateProjectFields(
      formData
    )

  if (!fields.ok) {
    projectsRedirect(
      'error',
      fields.error
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.rpc(
    'create_project_with_details',
    {
      p_short_title:
        fields.shortTitle,
      p_title:
        fields.title,
      p_abstract:
        fields.abstract,
      p_funder:
        fields.funder,
      p_status:
        fields.status,
      p_visibility:
        fields.visibility,
      p_slug:
        fields.slug,
      p_project_image_filename:
        fields.projectImageFilename,
      p_funder_image_filename:
        fields.funderImageFilename,
      p_paper_ids:
        fields.paperIds,
      p_activity_label_ids:
        fields.activityLabelIds,
    }
  )

  if (error) {
    console.error(
      'Project creation failed:',
      error
    )

    projectsRedirect(
      'error',
      getProjectErrorMessage(
        error.code,
        error.message
      )
    )
  }

  revalidatePath('/projects')

  projectsRedirect(
    'created',
    typeof data === 'string'
      ? data
      : '1'
  )
}

export async function updateProject(
  formData: FormData
) {
  await requireDashboardOwner()

  const projectId =
    getRequiredText(
      formData,
      'project_id'
    )

  if (!projectId) {
    projectsRedirect(
      'error',
      'Project ID is required.'
    )
  }

  const fields =
    validateProjectFields(
      formData
    )

  if (!fields.ok) {
    projectsRedirect(
      'error',
      fields.error
    )
  }

  const supabase =
    await createClient()

  const {
    error,
  } = await supabase.rpc(
    'update_project_with_details',
    {
      p_project_id:
        projectId,
      p_short_title:
        fields.shortTitle,
      p_title:
        fields.title,
      p_abstract:
        fields.abstract,
      p_funder:
        fields.funder,
      p_status:
        fields.status,
      p_visibility:
        fields.visibility,
      p_slug:
        fields.slug,
      p_project_image_filename:
        fields.projectImageFilename,
      p_funder_image_filename:
        fields.funderImageFilename,
      p_paper_ids:
        fields.paperIds,
      p_activity_label_ids:
        fields.activityLabelIds,
    }
  )

  if (error) {
    console.error(
      'Project update failed:',
      error
    )

    projectsRedirect(
      'error',
      getProjectErrorMessage(
        error.code,
        error.message
      )
    )
  }

  revalidatePath('/projects')

  projectsRedirect(
    'saved',
    projectId
  )
}

export async function deleteProject(
  formData: FormData
) {
  await requireDashboardOwner()

  const projectId =
    getRequiredText(
      formData,
      'project_id'
    )

  if (!projectId) {
    projectsRedirect(
      'error',
      'Project ID is required.'
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error(
      'Project deletion failed:',
      error
    )

    projectsRedirect(
      'error',
      'The project could not be deleted.'
    )
  }

  if (!data) {
    projectsRedirect(
      'error',
      'Project not found.'
    )
  }

  revalidatePath('/projects')

  projectsRedirect(
    'deleted',
    projectId
  )
}
