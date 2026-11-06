import Link from 'next/link'

const tabs = [
  {
    href: '/papers',
    label: 'My papers',
  },
  {
    href: '/papers/others',
    label: 'Other papers',
  },
] as const

export default function PapersTabs({
  active,
}: {
  active: '/papers' | '/papers/others'
}) {
  return (
    <nav
      aria-label="Paper categories"
      className="-mt-4 mb-6 flex gap-1 border-b border-oxford-stone"
    >
      {tabs.map((tab) => {
        const isActive =
          tab.href === active

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={
              isActive
                ? 'page'
                : undefined
            }
            className={
              isActive
                ? '-mb-px rounded-t-md border border-b-white border-oxford-stone bg-white px-4 py-2 text-sm font-medium text-oxford-blue'
                : '-mb-px rounded-t-md border border-transparent px-4 py-2 text-sm font-medium text-oxford-ash transition hover:text-oxford-blue'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
