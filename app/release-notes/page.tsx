import Link from 'next/link'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import { releases } from '@/lib/releases'

export default function ReleaseNotesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <header className="border-b border-oxford-stone bg-white px-6 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-4"
          >
            <OxfordLogo className="w-[190px]" />
            <span className="font-serif text-xl font-semibold text-oxford-blue">
              Research Dashboard
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-medium text-oxford-blue underline-offset-4 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-oxford-ash">
              Release notes
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-oxford-blue">
              What changed between versions
            </h1>
            <p className="mt-4 text-base leading-7 text-oxford-ash">
              A plain-language history of the Research Dashboard. Each release explains what changed from the version before it, with emphasis on features and behaviour rather than implementation details.
            </p>
          </div>

          <div className="mt-10 space-y-8">
            {releases.map((release) => (
              <article
                key={release.version}
                className="rounded-xl border border-oxford-stone bg-white p-6 shadow-sm sm:p-8"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
                        {release.version} &quot;{release.codename}&quot;
                      </h2>

                      {release.status && (
                        <span className="rounded-full border border-oxford-sky-blue bg-oxford-cool-grey px-2.5 py-1 text-xs font-medium text-oxford-blue">
                          {release.status}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm font-medium text-oxford-charcoal">
                      {release.comparison}
                    </p>
                  </div>
                </div>

                <p className="mt-5 max-w-4xl text-sm leading-6 text-oxford-ash">
                  {release.summary}
                </p>

                <div className="mt-7 grid gap-6 lg:grid-cols-2">
                  {release.sections.map((section) => (
                    <section
                      key={section.title}
                      className="rounded-lg border border-oxford-stone bg-oxford-off-white p-5"
                    >
                      <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                        {section.title}
                      </h3>

                      <ul className="mt-3 space-y-2 text-sm leading-6 text-oxford-charcoal">
                        {section.items.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-blue"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
