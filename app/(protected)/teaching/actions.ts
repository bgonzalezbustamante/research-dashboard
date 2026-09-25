'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  requireDashboardOwner,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const allowedLevels = new Set([
  'undergraduate',
  'master',
  'phd',
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

function getInteger(
  formData: FormData,
  name: string
) {
  const value =
    getRequiredText(
      formData,
      name
    )

  if (!/^\d+$/.test(value)) {
    return Number.NaN
  }

  return Number.parseInt(
    value,
    10
  )
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

function teachingRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted',
  value: string
): never {
  redirect(
    `/teaching?${key}=${encodeURIComponent(
      value
    )}`
  )
}

type ValidTeachingFields = {
  ok: true
  name: string
  institution: string
  summary: string
  startYear: number
  endYear: number | null
  isCurrent: boolean
  level: string
  timesTaught: number
  studentCount: number
  visibility: string
  slug: string | null
  courseImageFilename: string | null
  activityLabelIds: string[]
}

type InvalidTeachingFields = {
  ok: false
  error: string
}

type TeachingValidationResult =
  | ValidTeachingFields
  | InvalidTeachingFields

function validateTeachingFields(
  formData: FormData
): TeachingValidationResult {
  const name =
    getRequiredText(
      formData,
      'name'
    )

  const institution =
    getRequiredText(
      formData,
      'institution'
    )

  const summary =
    getRequiredText(
      formData,
      'summary'
    )

  const startYear =
    getInteger(
      formData,
      'start_year'
    )

  const isCurrent =
    formData.get(
      'is_current'
    ) === 'on'

  const endYear =
    isCurrent
      ? null
      : getOptionalYear(
          formData,
          'end_year'
        )

  const level =
    getRequiredText(
      formData,
      'level'
    )

  const timesTaught =
    getInteger(
      formData,
      'times_taught'
    )

  const studentCount =
    getInteger(
      formData,
      'student_count'
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

  const courseImageFilename =
    getOptionalText(
      formData,
      'course_image_filename'
    )

  if (
    !name ||
    !institution ||
    !summary
  ) {
    return {
      ok: false,
      error:
        'Course/activity name, institution, and summary are required.',
    }
  }

  if (
    name.length > 300 ||
    institution.length > 300
  ) {
    return {
      ok: false,
      error:
        'Course/activity name and institution must each be 300 characters or fewer.',
    }
  }

  if (summary.length > 4000) {
    return {
      ok: false,
      error:
        'Course summary must be 4,000 characters or fewer.',
    }
  }

  if (
    !Number.isInteger(
      startYear
    ) ||
    startYear < 1900 ||
    startYear > 2100
  ) {
    return {
      ok: false,
      error:
        'Start year must use four digits between 1900 and 2100.',
    }
  }

  if (
    !isCurrent &&
    endYear === null
  ) {
    return {
      ok: false,
      error:
        'Enter an end year or mark the course as still taught.',
    }
  }

  if (
    endYear !== null &&
    (
      !Number.isInteger(
        endYear
      ) ||
      endYear < 1900 ||
      endYear > 2100
    )
  ) {
    return {
      ok: false,
      error:
        'End year must use four digits between 1900 and 2100.',
    }
  }

  if (
    endYear !== null &&
    endYear < startYear
  ) {
    return {
      ok: false,
      error:
        'End year cannot be earlier than the start year.',
    }
  }

  if (
    !allowedLevels.has(
      level
    )
  ) {
    return {
      ok: false,
      error:
        'Select Undergraduate, Master, or PhD as the course level.',
    }
  }

  if (
    !Number.isInteger(
      timesTaught
    ) ||
    timesTaught < 1
  ) {
    return {
      ok: false,
      error:
        'Number of times taught must be at least 1.',
    }
  }

  if (
    !Number.isInteger(
      studentCount
    ) ||
    studentCount < 0
  ) {
    return {
      ok: false,
      error:
        'Number of students must be 0 or greater.',
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
        'Invalid Website visibility.',
    }
  }

  if (
    slug &&
    !slugPattern.test(slug)
  ) {
    return {
      ok: false,
      error:
        'Optional public slug must use lowercase letters, numbers, and single hyphens only.',
    }
  }

  if (
    courseImageFilename &&
    !assetFilenamePattern.test(
      courseImageFilename
    )
  ) {
    return {
      ok: false,
      error:
        'Course image filename must be a single PNG, WebP, JPG, or JPEG filename without folders.',
    }
  }

  return {
    ok: true,
    name,
    institution,
    summary,
    startYear,
    endYear,
    isCurrent,
    level,
    timesTaught,
    studentCount,
    visibility,
    slug,
    courseImageFilename,
    activityLabelIds:
      getUuidList(
        formData,
        'activity_label_ids'
      ),
  }
}

function getTeachingErrorMessage(
  code?: string,
  message?: string
) {
  if (code === '23505') {
    if (
      message?.includes(
        'activity_label_id'
      )
    ) {
      return 'One of the selected Teaching activity labels is already assigned to another course.'
    }

    if (
      message?.includes(
        'slug'
      )
    ) {
      return 'That optional public teaching slug is already in use.'
    }

    return 'A Teaching Portfolio item with that course/activity name and institution already exists.'
  }

  if (code === '23514') {
    return 'One of the selected activity labels is not a valid Teaching label, or one of the course fields is inconsistent.'
  }

  return 'The Teaching Portfolio item could not be saved.'
}

export async function createTeachingItem(
  formData: FormData
) {
  await requireDashboardOwner()

  const fields =
    validateTeachingFields(
      formData
    )

  if (!fields.ok) {
    teachingRedirect(
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
    'create_teaching_with_details',
    {
      p_name:
        fields.name,
      p_institution:
        fields.institution,
      p_summary:
        fields.summary,
      p_start_year:
        fields.startYear,
      p_end_year:
        fields.endYear,
      p_is_current:
        fields.isCurrent,
      p_level:
        fields.level,
      p_times_taught:
        fields.timesTaught,
      p_student_count:
        fields.studentCount,
      p_visibility:
        fields.visibility,
      p_slug:
        fields.slug,
      p_course_image_filename:
        fields.courseImageFilename,
      p_activity_label_ids:
        fields.activityLabelIds,
    }
  )

  if (error) {
    console.error(
      'Teaching Portfolio creation failed:',
      error
    )

    teachingRedirect(
      'error',
      getTeachingErrorMessage(
        error.code,
        error.message
      )
    )
  }

  revalidatePath('/teaching')

  teachingRedirect(
    'created',
    typeof data === 'string'
      ? data
      : '1'
  )
}

export async function updateTeachingItem(
  formData: FormData
) {
  await requireDashboardOwner()

  const teachingId =
    getRequiredText(
      formData,
      'teaching_id'
    )

  if (!teachingId) {
    teachingRedirect(
      'error',
      'Teaching Portfolio item ID is required.'
    )
  }

  const fields =
    validateTeachingFields(
      formData
    )

  if (!fields.ok) {
    teachingRedirect(
      'error',
      fields.error
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'update_teaching_with_details',
      {
        p_teaching_id:
          teachingId,
        p_name:
          fields.name,
        p_institution:
          fields.institution,
        p_summary:
          fields.summary,
        p_start_year:
          fields.startYear,
        p_end_year:
          fields.endYear,
        p_is_current:
          fields.isCurrent,
        p_level:
          fields.level,
        p_times_taught:
          fields.timesTaught,
        p_student_count:
          fields.studentCount,
        p_visibility:
          fields.visibility,
        p_slug:
          fields.slug,
        p_course_image_filename:
          fields.courseImageFilename,
        p_activity_label_ids:
          fields.activityLabelIds,
      }
    )

  if (error) {
    console.error(
      'Teaching Portfolio update failed:',
      error
    )

    teachingRedirect(
      'error',
      getTeachingErrorMessage(
        error.code,
        error.message
      )
    )
  }

  revalidatePath('/teaching')

  teachingRedirect(
    'saved',
    teachingId
  )
}

export async function deleteTeachingItem(
  formData: FormData
) {
  await requireDashboardOwner()

  const teachingId =
    getRequiredText(
      formData,
      'teaching_id'
    )

  if (!teachingId) {
    teachingRedirect(
      'error',
      'Teaching Portfolio item ID is required.'
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from('teaching_portfolio')
    .delete()
    .eq(
      'id',
      teachingId
    )
    .select('id')
    .maybeSingle()

  if (error) {
    console.error(
      'Teaching Portfolio deletion failed:',
      error
    )

    teachingRedirect(
      'error',
      'The Teaching Portfolio item could not be deleted.'
    )
  }

  if (!data) {
    teachingRedirect(
      'error',
      'Teaching Portfolio item not found.'
    )
  }

  revalidatePath('/teaching')

  teachingRedirect(
    'deleted',
    teachingId
  )
}
