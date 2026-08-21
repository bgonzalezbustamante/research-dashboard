type PaperWorkspaceNavProps = {
  milestoneCount: number
  historyCount: number
  presentationCount: number
  noteCount: number
  citationCount: number
  totalMinutes: number
}

const items = [
  {
    href: '#overview',
    label: 'Overview',
    countKey: null,
  },
  {
    href: '#milestones',
    label: 'Milestones',
    countKey: 'milestoneCount',
  },
  {
    href: '#history',
    label: 'History',
    countKey: 'historyCount',
  },
  {
    href: '#presentations',
    label: 'Presentations',
    countKey: 'presentationCount',
  },
  {
    href: '#notes',
    label: 'Notes',
    countKey: 'noteCount',
  },
  {
    href: '#citations',
    label: 'Citations',
    countKey: 'citationCount',
  },
] as const

function formatDuration(
  minutes: number
) {
  if (minutes === 0) {
    return '0h'
  }

  const hours =
    Math.floor(
      minutes / 60
    )

  const remainder =
    minutes % 60

  if (
    hours > 0 &&
    remainder > 0
  ) {
    return `${hours}h ${remainder}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${remainder}m`
}

export default function PaperWorkspaceNav(
  props: PaperWorkspaceNavProps
) {
  return (
    <nav
      aria-label="Paper workspace"
      className="mb-6 overflow-x-auto rounded-lg border border-oxford-stone bg-white"
    >
      <div className="flex min-w-max items-stretch">
        {items.map((item) => {
          const count =
            item.countKey === null
              ? null
              : props[
                  item.countKey
                ]

          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 border-r border-oxford-stone px-4 py-3 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
            >
              {item.label}

              {count !== null && (
                <span className="rounded-full bg-oxford-off-white px-2 py-0.5 text-xs font-medium text-oxford-ash">
                  {count}
                </span>
              )}
            </a>
          )
        })}

        <div className="flex items-center gap-2 px-4 py-3 text-sm">
          <span className="font-medium text-oxford-ash">
            Hours
          </span>

          <span className="rounded-full bg-oxford-blue px-2.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(
              props.totalMinutes
            )}
          </span>
        </div>
      </div>
    </nav>
  )
}