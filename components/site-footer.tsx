import Link from 'next/link'

import { currentRelease } from '@/lib/releases'

export default function SiteFooter() {
  return (
    <footer className="border-t border-oxford-stone bg-white px-6 py-4">
      <div className="space-y-1 text-center text-sm text-oxford-ash">
        <p>
          <Link
            href="/release-notes"
            className="font-medium text-oxford-blue underline-offset-4 hover:underline"
          >
            Research Dashboard - {currentRelease.version} &quot;{currentRelease.codename}&quot;
          </Link>
        </p>

        <p>
          <a
            href="https://bgonzalezbustamante.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-oxford-blue hover:underline"
          >
            Dr. Bastián González-Bustamante
          </a>
          , developed by{' '}
          <a
            href="https://empirialab.cl/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-oxford-blue hover:underline"
          >
            Empiria Lab
          </a>
        </p>
      </div>
    </footer>
  )
}
