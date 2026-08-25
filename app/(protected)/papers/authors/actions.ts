'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
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

function normaliseAuthorName(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function authorNameKey(
  value: string
) {
  return normaliseAuthorName(value)
    .toLocaleLowerCase()
}

function redirectWithError(
  message: string
): never {
  redirect(
    `/papers/authors?error=${encodeURIComponent(
      message
    )}`
  )
}

function redirectWithMessage(
  message: string
): never {
  redirect(
    `/papers/authors?message=${encodeURIComponent(
      message
    )}`
  )
}

export async function renameAuthor(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const authorId =
    getRequiredText(
      formData,
      'author_id'
    )

  const fullName =
    normaliseAuthorName(
      getRequiredText(
        formData,
        'full_name'
      )
    )

  if (!authorId) {
    redirectWithError(
      'The author could not be identified.'
    )
  }

  if (!fullName) {
    redirectWithError(
      'Author name is required.'
    )
  }

  const supabase =
    await createClient()

  const {
    data: authors,
    error: authorsError,
  } = await supabase
    .from('authors')
    .select('id, full_name')
    .eq('owner_id', access.ownerId)

  if (authorsError) {
    console.error(
      'Author directory duplicate check failed:',
      authorsError
    )

    redirectWithError(
      'The author directory could not be checked.'
    )
  }

  const duplicate =
    (authors ?? []).find(
      (author) =>
        author.id !== authorId &&
        authorNameKey(
          author.full_name
        ) ===
          authorNameKey(fullName)
    )

  if (duplicate) {
    redirectWithError(
      `An author named “${duplicate.full_name}” already exists. Rename or reconcile the records before using the same canonical name.`
    )
  }

  const {
    data: updated,
    error: updateError,
  } = await supabase
    .from('authors')
    .update({
      full_name: fullName,
    })
    .eq('id', authorId)
    .eq('owner_id', access.ownerId)
    .select('id')
    .maybeSingle()

  if (
    updateError ||
    !updated
  ) {
    console.error(
      'Author rename failed:',
      updateError
    )

    redirectWithError(
      'The author could not be renamed.'
    )
  }

  revalidatePath('/papers')
  revalidatePath('/papers/authors')

  redirectWithMessage(
    'Author updated.'
  )
}

export async function deleteUnusedAuthor(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const authorId =
    getRequiredText(
      formData,
      'author_id'
    )

  if (!authorId) {
    redirectWithError(
      'The author could not be identified.'
    )
  }

  const supabase =
    await createClient()

  const {
    data: author,
    error: authorError,
  } = await supabase
    .from('authors')
    .select('id, full_name')
    .eq('id', authorId)
    .eq('owner_id', access.ownerId)
    .maybeSingle()

  if (
    authorError ||
    !author
  ) {
    redirectWithError(
      'The author could not be found.'
    )
  }

  const {
    count,
    error: usageError,
  } = await supabase
    .from('paper_authors')
    .select('paper_id', {
      count: 'exact',
      head: true,
    })
    .eq('author_id', authorId)

  if (usageError) {
    console.error(
      'Author usage check failed:',
      usageError
    )

    redirectWithError(
      'The author usage could not be checked.'
    )
  }

  if ((count ?? 0) > 0) {
    redirectWithError(
      'This author is still attached to one or more papers and cannot be deleted.'
    )
  }

  const {
    data: deleted,
    error: deleteError,
  } = await supabase
    .from('authors')
    .delete()
    .eq('id', authorId)
    .eq('owner_id', access.ownerId)
    .select('id')
    .maybeSingle()

  if (
    deleteError ||
    !deleted
  ) {
    console.error(
      'Unused author deletion failed:',
      deleteError
    )

    redirectWithError(
      'The unused author could not be deleted.'
    )
  }

  revalidatePath('/papers')
  revalidatePath('/papers/authors')

  redirectWithMessage(
    `Removed unused author “${author.full_name}”.`
  )
}
