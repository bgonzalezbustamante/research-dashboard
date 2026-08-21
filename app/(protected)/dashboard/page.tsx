import PageHeader from '@/components/page-header'
import Card from '@/components/ui/card'
import Button from '@/components/ui/button'
import StatusBadge from '@/components/ui/status-badge'

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your research activity, planning, and papers."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Working hours
          </h2>

          <p className="mt-2 text-sm text-oxford-ash">
            No working hours recorded yet.
          </p>

          <Button variant="secondary" className="mt-4">
            View hours
          </Button>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Current planning
          </h2>

          <p className="mt-2 text-sm text-oxford-ash">
            No planning allocations yet.
          </p>

          <Button variant="secondary" className="mt-4">
            View planning
          </Button>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                Papers
              </h2>

              <p className="mt-2 text-sm text-oxford-ash">
                No papers added yet.
              </p>
            </div>

            <StatusBadge status="writing" />
          </div>

          <Button variant="secondary" className="mt-4">
            View papers
          </Button>
        </Card>
      </div>
    </div>
  )
}