'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const allowedCategories = new Set([
  'Application',
  'Website',
  'Utility',
  'Reusable component',
  'Package/library',
  'API/service',
  'Data product',
  'Template',
  'Other',
])

const allowedDevelopmentStages = new Set([
  'Alpha',
  'Beta',
  'Release candidate',
  'Stable',
  'Maintenance',
])

const allowedStatuses = new Set([
  'active',
  'paused',
  'completed',
  'archived',
])

const allowedRepositoryVisibilities = new Set([
  'public',
  'private',
])

const allowedPublicVisibilities = new Set([
  'private',
  'public',
])

const slugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

function getOptionalYear(
  formData: FormData,
  name: string
) {
  const value =
    getOptionalText(
      formData,
      name
    )

  if (!value) {
    return null
  }

  if (!/^\d{4}$/.test(value)) {
    return Number.NaN
  }

  return Number.parseInt(
    value,
    10
  )
}

function isValidHttpUrl(
  value: string
) {
  try {
    const url =
      new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function softwareRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted',
  value: string
): never {
  redirect(
    `/software?${key}=${encodeURIComponent(
      value
    )}`
  )
}

type ValidSoftwareFields = {
  ok: true
  name: string
  slug: string
  shortDescription: string
  category: string
  currentVersion: string | null
  developmentStage: string
  status: string
  repositoryVisibility: string
  repositoryUrl: string | null
  productionUrl: string | null
  documentationUrl: string | null
  startYear: number | null
  endYear: number | null
  featured: boolean
  publicVisibility: string
}

type InvalidSoftwareFields = {
  ok: false
  error: string
}

type SoftwareValidationResult =
  | ValidSoftwareFields
  | InvalidSoftwareFields

function validateSoftwareFields(
  formData: FormData
): SoftwareValidationResult {
  const name =
    getRequiredText(
      formData,
      'name'
    )

  const slug =
    getRequiredText(
      formData,
      'slug'
    ).toLowerCase()

  const shortDescription =
    getRequiredText(
      formData,
      'short_description'
    )

  const category =
    getRequiredText(
      formData,
      'category'
    )

  const currentVersion =
    getOptionalText(
      formData,
      'current_version'
    )

  const developmentStage =
    getRequiredText(
      formData,
      'development_stage'
    )

  const status =
    getRequiredText(
      formData,
      'status'
    )

  const repositoryVisibility =
    getRequiredText(
      formData,
      'repository_visibility'
    )

  const repositoryUrl =
    getOptionalText(
      formData,
      'repository_url'
    )

  const productionUrl =
    getOptionalText(
      formData,
      'production_url'
    )

  const documentationUrl =
    getOptionalText(
      formData,
      'documentation_url'
    )

  const startYear =
    getOptionalYear(
      formData,
      'start_year'
    )

  const endYear =
    getOptionalYear(
      formData,
      'end_year'
    )

  const publicVisibility =
    getRequiredText(
      formData,
      'public_visibility'
    )

  if (!name) {
    return {
      ok: false,
      error:
        'Software name is required.',
    }
  }

  if (name.length > 200) {
    return {
      ok: false,
      error:
        'Software name must be 200 characters or fewer.',
    }
  }

  if (
    !slug ||
    !slugPattern.test(slug) ||
    slug.length > 120
  ) {
    return {
      ok: false,
      error:
        'Slug must use lowercase letters, numbers, and single hyphens only, with at most 120 characters.',
    }
  }

  if (
    !shortDescription ||
    shortDescription.length > 500
  ) {
    return {
      ok: false,
      error:
        'Short description is required and must be 500 characters or fewer.',
    }
  }

  if (
    !allowedCategories.has(
      category
    )
  ) {
    return {
      ok: false,
      error:
        'Select a valid software category.',
    }
  }

  if (
    currentVersion &&
    currentVersion.length > 100
  ) {
    return {
      ok: false,
      error:
        'Current version must be 100 characters or fewer.',
    }
  }

  if (
    !allowedDevelopmentStages.has(
      developmentStage
    )
  ) {
    return {
      ok: false,
      error:
        'Select a valid development stage.',
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
        'Select a valid software status.',
    }
  }

  if (
    !allowedRepositoryVisibilities.has(
      repositoryVisibility
    )
  ) {
    return {
      ok: false,
      error:
        'Select a valid repository visibility.',
    }
  }

  if (
    !allowedPublicVisibilities.has(
      publicVisibility
    )
  ) {
    return {
      ok: false,
      error:
        'Select a valid public exposure setting.',
    }
  }

  for (const [
    label,
    value,
  ] of [
    [
      'Repository URL',
      repositoryUrl,
    ],
    [
      'Production/demo URL',
      productionUrl,
    ],
    [
      'Documentation URL',
      documentationUrl,
    ],
  ] as const) {
    if (
      value &&
      !isValidHttpUrl(value)
    ) {
      return {
        ok: false,
        error:
          `${label} must be a valid HTTP or HTTPS URL.`,
      }
    }
  }

  if (
    startYear !== null &&
    (
      !Number.isInteger(
        startYear
      ) ||
      startYear < 1000 ||
      startYear > 9999
    )
  ) {
    return {
      ok: false,
      error:
        'Start year must use four digits.',
    }
  }

  if (
    endYear !== null &&
    (
      !Number.isInteger(
        endYear
      ) ||
      endYear < 1000 ||
      endYear > 9999
    )
  ) {
    return {
      ok: false,
      error:
        'End year must use four digits.',
    }
  }

  if (
    startYear !== null &&
    endYear !== null &&
    endYear < startYear
  ) {
    return {
      ok: false,
      error:
        'End year cannot be earlier than start year.',
    }
  }

  return {
    ok: true,
    name,
    slug,
    shortDescription,
    category,
    currentVersion,
    developmentStage,
    status,
    repositoryVisibility,
    repositoryUrl,
    productionUrl,
    documentationUrl,
    startYear,
    endYear,
    featured:
      formData.get(
        'featured'
      ) === 'on',
    publicVisibility,
  }
}

function getSoftwareErrorMessage(
  code?: string,
  message?: string
) {
  if (code === '23505') {
    if (
      message?.includes(
        'slug'
      )
    ) {
      return 'That software slug is already in use.'
    }

    return 'A software item with that name already exists.'
  }

  if (code === '23514') {
    return 'One of the software fields contains an invalid controlled value.'
  }

  return 'The software item could not be saved.'
}

export async function createSoftware(
  formData: FormData
) {
  await requireDashboardOwner()

  const fields =
    validateSoftwareFields(
      formData
    )

  if (!fields.ok) {
    softwareRedirect(
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
    'create_software_with_details',
    {
      p_name:
        fields.name,
      p_slug:
        fields.slug,
      p_short_description:
        fields.shortDescription,
      p_category:
        fields.category,
      p_current_version:
        fields.currentVersion,
      p_development_stage:
        fields.developmentStage,
      p_status:
        fields.status,
      p_repository_visibility:
        fields.repositoryVisibility,
      p_repository_url:
        fields.repositoryUrl,
      p_production_url:
        fields.productionUrl,
      p_documentation_url:
        fields.documentationUrl,
      p_start_year:
        fields.startYear,
      p_end_year:
        fields.endYear,
      p_featured:
        fields.featured,
      p_public_visibility:
        fields.publicVisibility,
    }
  )

  if (error) {
    console.error(
      'Software creation failed:',
      error
    )

    softwareRedirect(
      'error',
      getSoftwareErrorMessage(
        error.code,
        error.message
      )
    )
  }

  revalidatePath('/software')

  softwareRedirect(
    'created',
    typeof data === 'string'
      ? data
      : '1'
  )
}

export async function updateSoftware(
  formData: FormData
) {
  await requireDashboardOwner()

  const softwareId =
    getRequiredText(
      formData,
      'software_id'
    )

  if (!softwareId) {
    softwareRedirect(
      'error',
      'Software ID is required.'
    )
  }

  const fields =
    validateSoftwareFields(
      formData
    )

  if (!fields.ok) {
    softwareRedirect(
      'error',
      fields.error
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'update_software_with_details',
      {
        p_software_id:
          softwareId,
        p_name:
          fields.name,
        p_slug:
          fields.slug,
        p_short_description:
          fields.shortDescription,
        p_category:
          fields.category,
        p_current_version:
          fields.currentVersion,
        p_development_stage:
          fields.developmentStage,
        p_status:
          fields.status,
        p_repository_visibility:
          fields.repositoryVisibility,
        p_repository_url:
          fields.repositoryUrl,
        p_production_url:
          fields.productionUrl,
        p_documentation_url:
          fields.documentationUrl,
        p_start_year:
          fields.startYear,
        p_featured:
          fields.featured,
        p_public_visibility:
          fields.publicVisibility,
      }
    )

  if (error) {
    console.error(
      'Software update failed:',
      error
    )

    softwareRedirect(
      'error',
      getSoftwareErrorMessage(
        error.code,
        error.message
      )
    )
  }

  revalidatePath('/software')

  softwareRedirect(
    'saved',
    softwareId
  )
}

export async function deleteSoftware(
  formData: FormData
) {
  await requireDashboardOwner()

  const softwareId =
    getRequiredText(
      formData,
      'software_id'
    )

  if (!softwareId) {
    softwareRedirect(
      'error',
      'Software ID is required.'
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from('software_items')
    .delete()
    .eq('id', softwareId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error(
      'Software deletion failed:',
      error
    )

    softwareRedirect(
      'error',
      'The software item could not be deleted.'
    )
  }

  if (!data) {
    softwareRedirect(
      'error',
      'Software item not found.'
    )
  }

  revalidatePath('/software')

  softwareRedirect(
    'deleted',
    softwareId
  )
}
