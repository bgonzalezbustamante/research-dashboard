import PageHeader from '@/components/page-header'
import Card from '@/components/ui/card'
import ButtonLink from '@/components/ui/button-link'

export default function NewPaperPage() {
  return (
    <div>
      <PageHeader
        title="Add paper"
        description="Create a new paper in the research dashboard."
      />

      <Card>
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Paper details
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-oxford-ash">
          The paper creation form will be implemented in
          B.3. The route is already in place so navigation
          from the Papers page is functional.
        </p>

        <ButtonLink
          href="/papers"
          variant="secondary"
          className="mt-6"
        >
          Back to papers
        </ButtonLink>
      </Card>
    </div>
  )
}