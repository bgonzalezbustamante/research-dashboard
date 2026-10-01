import type { Metadata } from 'next'
import Link from 'next/link'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import academicApiContract from '@/lib/academic-api-contract.json'

type ApiField = {
  name: string
  type: string
}

type ApiParameter = {
  name: string
  type: string
  note?: string
}

type ApiOperation = {
  name: string
  signature: string
  kind: string
  purpose: string
  parameters: ApiParameter[]
  fields: ApiField[]
  detailOnly: string[]
  listingOnly: string[]
  notes: string[]
}

type ApiResource = {
  id: string
  title: string
  summary: string
  notExposed: string[]
  forbiddenFields: string[]
  operations: ApiOperation[]
}

type ApiConsumer = {
  name: string
  url: string
  rpcs: string[]
}

type ApiVocabulary = {
  id: string
  label: string
  constraint: string
  values: string[]
}

type AcademicApiContract = {
  name: string
  version: string
  status: string
  access: {
    mode: string
    transport: string
    credential: string
    architecture: string
  }
  consumers: ApiConsumer[]
  resources: ApiResource[]
  controlledVocabularies: ApiVocabulary[]
}

const contract =
  academicApiContract as AcademicApiContract

export const metadata: Metadata = {
  title:
    'Academic API | Research Dashboard',
  description:
    'Public RPC v1 documentation for the Research Dashboard Academic API.',
}

function consumersFor(
  operationName: string
) {
  return contract.consumers.filter(
    (consumer) =>
      consumer.rpcs.includes(
        operationName
      )
  )
}

function CodePill({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <code className="rounded-md border border-oxford-stone bg-oxford-off-white px-2 py-1 text-xs font-medium text-oxford-blue">
      {children}
    </code>
  )
}

export default function AcademicApiPage() {
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

          <nav
            aria-label="Public information"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium"
          >
            <Link
              href="/release-notes"
              className="text-oxford-blue underline-offset-4 hover:underline"
            >
              Release notes
            </Link>
            <Link
              href="/dashboard"
              className="text-oxford-blue underline-offset-4 hover:underline"
            >
              Back to dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-5xl">
          <section className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-wide text-oxford-ash">
              Academic API
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-oxford-blue">
              Public academic data contracts
            </h1>
            <p className="mt-4 text-base leading-7 text-oxford-ash">
              Research Dashboard is the
              canonical administrative
              source for the academic
              metadata documented here.
              Downstream applications do
              not query Dashboard tables
              directly: they use a
              deliberately curated,
              anonymous-safe Supabase RPC
              layer.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-oxford-sky-blue bg-oxford-cool-grey px-3 py-1 text-xs font-medium text-oxford-blue">
                {contract.version}
              </span>
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                {contract.status}
              </span>
              <span className="rounded-full border border-oxford-stone bg-white px-3 py-1 text-xs font-medium text-oxford-ash">
                {contract.access.mode}
              </span>
            </div>
          </section>

          <section
            aria-labelledby="overview-heading"
            className="mt-10"
          >
            <h2
              id="overview-heading"
              className="font-serif text-2xl font-semibold text-oxford-blue"
            >
              Overview
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-oxford-stone bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  Canonical source
                </h3>
                <p className="mt-2 text-sm leading-6 text-oxford-ash">
                  Research Dashboard
                  maintains the canonical
                  administrative records.
                  Public contracts select
                  only the fields and
                  records intended for
                  external consumption.
                </p>
              </div>

              <div className="rounded-xl border border-oxford-stone bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  Access model
                </h3>
                <p className="mt-2 text-sm leading-6 text-oxford-ash">
                  Public consumers use the
                  Supabase Data API with a
                  publishable key and call
                  only the RPC functions
                  below. Anonymous consumers
                  have no direct SELECT
                  access to the underlying
                  Dashboard tables.
                </p>
              </div>

              <div className="rounded-xl border border-oxford-stone bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  Public boundary
                </h3>
                <p className="mt-2 text-sm leading-6 text-oxford-ash">
                  Papers, projects and
                  Teaching Portfolio items
                  apply their explicit
                  Public visibility rules.
                  Conferences expose the
                  documented presentation
                  shape for all stored
                  presentation records, and
                  work analytics expose only
                  aggregate measures.
                </p>
              </div>

              <div className="rounded-xl border border-oxford-stone bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  Versioned interface
                </h3>
                <p className="mt-2 text-sm leading-6 text-oxford-ash">
                  {contract.version} is the
                  current stable public
                  contract within Distant
                  Forge. Contract changes are
                  recorded in Dashboard
                  release documentation and
                  validated against the
                  migration history.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-oxford-stone bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
              How consumers connect
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-oxford-ash">
              The machine interface remains
              Supabase RPC; this page does
              not introduce a parallel REST
              façade. Public applications
              configure the project URL and
              publishable key, then call the
              documented functions through
              the Supabase client.
            </p>

            <div className="mt-5 overflow-x-auto rounded-lg border border-oxford-stone bg-oxford-charcoal p-4 text-sm text-white">
              <pre>
                <code>{`const { data, error } = await supabase.rpc(
  'list_public_papers'
)`}</code>
              </pre>
            </div>

            <div className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Architecture
              </p>
              <p className="mt-2 font-mono text-sm text-oxford-blue">
                {contract.access.architecture}
              </p>
            </div>
          </section>

          <nav
            aria-label="Academic API resources"
            className="mt-8 flex flex-wrap gap-2"
          >
            {contract.resources.map(
              (resource) => (
                <a
                  key={resource.id}
                  href={`#${resource.id}`}
                  className="rounded-full border border-oxford-stone bg-white px-3 py-1.5 text-sm font-medium text-oxford-blue transition hover:bg-oxford-shell"
                >
                  {resource.title}
                </a>
              )
            )}
            <a
              href="#controlled-vocabularies"
              className="rounded-full border border-oxford-stone bg-white px-3 py-1.5 text-sm font-medium text-oxford-blue transition hover:bg-oxford-shell"
            >
              Controlled vocabularies
            </a>
          </nav>

          <div className="mt-10 space-y-10">
            {contract.resources.map(
              (resource) => (
                <section
                  id={resource.id}
                  key={resource.id}
                  className="scroll-mt-6"
                >
                  <div className="max-w-4xl">
                    <p className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                      Resource
                    </p>
                    <h2 className="mt-1 font-serif text-3xl font-semibold text-oxford-blue">
                      {resource.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-oxford-ash">
                      {resource.summary}
                    </p>
                  </div>

                  <div className="mt-5 space-y-5">
                    {resource.operations.map(
                      (operation) => {
                        const consumers =
                          consumersFor(
                            operation.name
                          )

                        return (
                          <article
                            key={
                              operation.name
                            }
                            className="rounded-xl border border-oxford-stone bg-white p-6 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <code className="text-sm font-semibold text-oxford-blue">
                                  {
                                    operation.signature
                                  }
                                </code>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-oxford-ash">
                                  {
                                    operation.purpose
                                  }
                                </p>
                              </div>

                              <span className="w-fit rounded-full border border-oxford-sky-blue bg-oxford-cool-grey px-2.5 py-1 text-xs font-medium text-oxford-blue">
                                {
                                  operation.kind
                                }
                              </span>
                            </div>

                            {operation.parameters
                              .length >
                              0 && (
                              <div className="mt-5">
                                <h3 className="text-sm font-semibold text-oxford-charcoal">
                                  Parameters
                                </h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {operation.parameters.map(
                                    (
                                      parameter
                                    ) => (
                                      <span
                                        key={
                                          parameter.name
                                        }
                                        className="text-sm text-oxford-ash"
                                      >
                                        <CodePill>
                                          {
                                            parameter.name
                                          }
                                          :{' '}
                                          {
                                            parameter.type
                                          }
                                        </CodePill>
                                        {parameter.note &&
                                          ` — ${parameter.note}`}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-5">
                              <h3 className="text-sm font-semibold text-oxford-charcoal">
                                Public return
                                fields
                              </h3>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {operation.fields.map(
                                  (field) => (
                                    <div
                                      key={
                                        field.name
                                      }
                                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-oxford-stone bg-oxford-off-white px-3 py-2"
                                    >
                                      <code className="min-w-0 break-all text-xs font-medium text-oxford-blue">
                                        {
                                          field.name
                                        }
                                      </code>
                                      <span className="shrink-0 text-xs text-oxford-ash">
                                        {
                                          field.type
                                        }
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>

                            {operation.detailOnly
                              .length >
                              0 && (
                              <div className="mt-5 rounded-lg border border-oxford-sky-blue bg-oxford-cool-grey p-4">
                                <h3 className="text-sm font-semibold text-oxford-blue">
                                  Detail-only
                                  fields
                                </h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {operation.detailOnly.map(
                                    (field) => (
                                      <CodePill
                                        key={
                                          field
                                        }
                                      >
                                        {
                                          field
                                        }
                                      </CodePill>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {operation.notes
                              .length >
                              0 && (
                              <div className="mt-5">
                                <h3 className="text-sm font-semibold text-oxford-charcoal">
                                  Notes
                                </h3>
                                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-oxford-ash">
                                  {operation.notes.map(
                                    (note) => (
                                      <li
                                        key={
                                          note
                                        }
                                        className="flex gap-2"
                                      >
                                        <span
                                          aria-hidden="true"
                                          className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-blue"
                                        />
                                        <span>
                                          {note}
                                        </span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            {consumers.length >
                              0 && (
                              <p className="mt-5 border-t border-oxford-stone pt-4 text-xs text-oxford-ash">
                                Known consumers:{' '}
                                {consumers.map(
                                  (
                                    consumer,
                                    index
                                  ) => (
                                    <span
                                      key={
                                        consumer.name
                                      }
                                    >
                                      {index >
                                        0 &&
                                        ', '}
                                      <a
                                        href={
                                          consumer.url
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-oxford-blue underline-offset-4 hover:underline"
                                      >
                                        {
                                          consumer.name
                                        }
                                      </a>
                                    </span>
                                  )
                                )}
                              </p>
                            )}
                          </article>
                        )
                      }
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-oxford-stone bg-oxford-shell p-5">
                    <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                      Not exposed
                    </h3>
                    <ul className="mt-3 grid gap-2 text-sm leading-6 text-oxford-charcoal md:grid-cols-2">
                      {resource.notExposed.map(
                        (item) => (
                          <li
                            key={item}
                            className="flex gap-2"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-peach"
                            />
                            <span>
                              {item}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </section>
              )
            )}
          </div>

          <section
            id="controlled-vocabularies"
            className="mt-12 scroll-mt-6"
          >
            <div className="max-w-4xl">
              <p className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Contract rules
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-oxford-blue">
                Controlled vocabularies
              </h2>
              <p className="mt-3 text-sm leading-6 text-oxford-ash">
                These values are enforced by
                the Dashboard database and
                form part of Public RPC v1.
                Consumers should not invent
                additional values.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {contract.controlledVocabularies.map(
                (vocabulary) => (
                  <article
                    key={vocabulary.id}
                    className="rounded-xl border border-oxford-stone bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                      {vocabulary.label}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {vocabulary.values.map(
                        (value) => (
                          <CodePill
                            key={value}
                          >
                            {value}
                          </CodePill>
                        )
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-oxford-stone bg-white p-6 shadow-sm">
              <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
                Consumers
              </h2>
              <p className="mt-3 text-sm leading-6 text-oxford-ash">
                These applications consume
                the public interface but are
                not dependencies of Research
                Dashboard.
              </p>

              <div className="mt-5 space-y-4">
                {contract.consumers.map(
                  (consumer) => (
                    <div
                      key={consumer.name}
                    >
                      <a
                        href={consumer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-oxford-blue underline-offset-4 hover:underline"
                      >
                        {consumer.name}
                      </a>
                      <p className="mt-1 text-xs leading-5 text-oxford-ash">
                        {
                          consumer.rpcs
                            .length
                        }{' '}
                        documented Public RPC
                        {consumer.rpcs
                          .length === 1
                          ? ''
                          : 's'}{' '}
                        in current use.
                      </p>
                    </div>
                  )
                )}
              </div>
            </article>

            <article className="rounded-xl border border-oxford-stone bg-white p-6 shadow-sm">
              <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
                Privacy and access
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-oxford-charcoal">
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-blue"
                  />
                  <span>
                    Anonymous access is
                    read-only and limited to
                    the RPC surface documented
                    on this page.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-blue"
                  />
                  <span>
                    The publishable key is a
                    public client credential;
                    service-role or secret
                    credentials are never part
                    of the public interface.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-blue"
                  />
                  <span>
                    Workflow, ownership,
                    access-control and raw
                    activity data remain
                    behind the authenticated
                    Dashboard boundary.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oxford-blue"
                  />
                  <span>
                    Public contracts are
                    versioned interfaces, not
                    direct table schemas.
                  </span>
                </li>
              </ul>
            </article>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
