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
  {
    href: '/website',
    label: 'Website',
  },
]

export default function OwnerUtilityNavigation({
  showOwnerLinks = true,
}: {
  showOwnerLinks?: boolean
}) {
  const pathname = usePathname()

  return (
    <div className="border-t border-oxford-stone bg-oxford-off-white">
      <div className="mx-auto flex max-w-7xl justify-end px-6 py-3">
        <nav
          className="flex items-center gap-1"
          aria-label="Utility navigation"
        >
          {showOwnerLinks &&
            links.map((link) => {
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

          <form
            action="/auth/signout"
            method="post"
          >
            <button
              type="submit"
              className="rounded-md border border-oxford-blue bg-oxford-blue px-3 py-1.5 text-sm font-medium text-white transition hover:bg-oxford-blue-dark"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </div>
  )
}
