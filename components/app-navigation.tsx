'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  {
    href: '/dashboard',
    label: 'Dashboard',
  },
  {
    href: '/hours',
    label: 'Hours',
  },
  {
    href: '/planning',
    label: 'Planning',
  },
  {
    href: '/papers',
    label: 'Papers',
  },
]

export default function AppNavigation() {
  const pathname = usePathname()

  return (
    <nav
      className="flex flex-wrap items-center gap-1"
      aria-label="Main navigation"
    >
      {links.map((link) => {
        const active =
          pathname === link.href ||
          pathname.startsWith(`${link.href}/`)

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-md bg-oxford-blue px-3 py-2 text-sm font-medium text-white'
                : 'rounded-md px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue'
            }
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}