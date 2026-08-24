import PageHeader from '@/components/page-header'
import PaperForm from '@/components/papers/paper-form'
import { createPaper } from '../actions'

type NewPaperPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewPaperPage({
  searchParams,
}: NewPaperPageProps) {
  const { error } = await searchParams

  return (
    <div>
      <PageHeader
        title="Add paper"
        description="Create a new paper and its core research record."
      />

      <PaperForm
        action={createPaper}
        submitLabel="Create paper"
        cancelHref="/papers"
        error={error}
        initialValues={{
          authors:
            'Bastián González-Bustamante',
        }}
      />
    </div>
  )
}
