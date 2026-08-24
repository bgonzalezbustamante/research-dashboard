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

function redirectTitleError(
  paperId: string,
  message: string
): never {
  redirect(
    `/papers/${encodeURIComponent(
      paperId
    )}/coauthor-title?titleError=${encodeURIComponent(
      message
    )}#paper-title`
  )
}

export async function updateCoauthorPaperTitle(
  formData: FormData
) {
  const paperId = getRequiredText(
    formData,
    'paper_id'
  )

  const title = getRequiredText(
    formData,
    'title'
  )

  if (!paperId) {
    redirect('/papers')
  }

  if (!title) {
    redirectTitleError(
      paperId,
      'Full title is required.'
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
    redirectTitleError(
      paperId,
      'Coauthor access is required to change this title.'
    )
  }

  const {
    data: updatedPaper,
    error: updateError,
  } = await supabase
    .from('papers')
    .update({
      title,
    })
    .eq('id', paperId)
    .select('id')
    .maybeSingle()

  if (
    updateError ||
    updatedPaper?.id !== paperId
  ) {
    console.error(
      'Coauthor paper-title update failed:',
      updateError
    )

    redirectTitleError(
      paperId,
      'The paper title could not be updated.'
    )
  }

  revalidatePath('/papers')
  revalidatePath(
    `/papers/${paperId}`
  )

  redirect(
    `/papers/${paperId}#paper-title`
  )
}
