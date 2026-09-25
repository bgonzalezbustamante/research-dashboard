'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ownerLinks = [
  {
    href: '/papers/authors',
    label: 'Authors',
  },
  {
    href: '/dashboard/access',
    label: 'Access',
  },
]

export default function OwnerUtilityNavigation({
  showOwnerLinks = true,
  accountLabel = 'Account',
}: {
  showOwnerLinks?: boolean
  accountLabel?: string
}) {
  const pathname = usePathname()

  const isActive = (
    href: string
  ) =>
    pathname === href ||
    pathname.startsWith(
      href + '/'
    )

  const outlineClass =
    'rounded-md border border-oxford-blue bg-transparent px-2.5 py-1.5 text-xs font-medium text-oxford-blue transition hover:bg-white'

  return (
    <div className="border-t border-oxford-stone bg-oxford-off-white">
      <div className="mx-auto flex max-w-7xl justify-end px-6 py-3">
        <nav
          className="flex flex-wrap items-center justify-end gap-2"
          aria-label="Utility navigation"
        >
          {showOwnerLinks &&
            ownerLinks.map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={
                    isActive(
                      link.href
                    )
                      ? 'page'
                      : undefined
                  }
                  className={
                    outlineClass
                  }
                >
                  {link.label}
                </Link>
              )
            )}

          <Link
            href="/account"
            aria-current={
              isActive('/account')
                ? 'page'
                : undefined
            }
            className={outlineClass}
          >
            {accountLabel}
          </Link>

          <form
            action="/auth/signout"
            method="post"
          >
            <button
              type="submit"
              className="rounded-md border border-oxford-blue bg-oxford-blue px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-oxford-blue-dark"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </div>
  )
}
