'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  {
    href: '/papers/authors',
    label: 'Authors',
  },
  {
    href: '/dashboard/access',
    label: 'Access',
  },
]

export default function OwnerUtilityNavigation() {
  const pathname = usePathname()

  return (
    <div className="border-t border-oxford-stone bg-oxford-off-white">
      <div className="mx-auto flex max-w-7xl justify-end px-6 py-3">
        <nav
          className="flex items-center gap-1"
          aria-label="Owner utilities"
        >
          {links.map((link) => {
            const active =
              pathname === link.href ||
              pathname.startsWith(
                `${link.href}/`
              )

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'rounded-md bg-oxford-blue px-3 py-1.5 text-sm font-medium text-white'
                    : 'rounded-md px-3 py-1.5 text-sm font-medium text-oxford-ash transition hover:bg-white hover:text-oxford-blue'
                }
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
