type PaperWorkspaceNavProps = {
  milestoneCount: number
  historyCount: number
  presentationCount: number
  noteCount: number
  citationCount: number
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

export default function PaperWorkspaceNav(
  props: PaperWorkspaceNavProps
) {
  return (
    <nav
      aria-label="Paper workspace"
      className="mb-6 overflow-x-auto rounded-lg border border-oxford-stone bg-white"
    >
      <div className="flex min-w-max">
        {items.map((item) => {
          const count =
            item.countKey === null
              ? null
              : props[item.countKey]

          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 border-r border-oxford-stone px-4 py-3 text-sm font-medium text-oxford-charcoal transition last:border-r-0 hover:bg-oxford-shell hover:text-oxford-blue"
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
      </div>
    </nav>
  )
}