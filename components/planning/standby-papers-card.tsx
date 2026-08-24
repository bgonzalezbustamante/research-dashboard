import Link from 'next/link'

import Card from '@/components/ui/card'

type StandbyPaper = {
  id: string
  short_title: string
}

type StandbyPapersCardProps = {
  papers: StandbyPaper[]
}

export default function StandbyPapersCard({
  papers,
}: StandbyPapersCardProps) {
  return (
    <Card className="mb-6">
      <h2 className="font-serif text-lg font-semibold text-oxford-blue">
        Standby papers
      </h2>

      <p className="mt-1 text-sm text-oxford-ash">
        Open a standby paper before
        deciding whether to allocate
        capacity to it in this period.
      </p>

      {papers.length === 0 ? (
        <p className="mt-4 text-sm text-oxford-ash">
          No active standby papers.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {papers.map(
            (paper) => (
              <Link
                key={paper.id}
                href={`/papers/${paper.id}`}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900 transition hover:border-oxford-blue hover:bg-white hover:text-oxford-blue"
              >
                {paper.short_title}
              </Link>
            )
          )}
        </div>
      )}
    </Card>
  )
}
