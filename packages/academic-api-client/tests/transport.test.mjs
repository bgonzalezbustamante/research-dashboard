import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAcademicApiClient,
  createFetchTransport,
  filterCollectionPublications,
  filterExternalPublicationsByCollection,
  filterProjectPublications,
  sortPublicationsByDate,
} from '../../../node_modules/.cache/academic-api-client/index.js'

function fakeFetch(
  responder
) {
  const calls = []

  const implementation =
    async (url, init) => {
      calls.push({
        url,
        init,
      })

      return responder(
        url,
        init
      )
    }

  return {
    calls,
    implementation,
  }
}

function jsonResponse(
  body,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    }
  )
}

const externalRow = {
  slug: 'partner-study-2025',
  title: 'Partner study',
  authors: ['A. Partner'],
  venue: 'Journal',
  publication_date: '2025-03-01',
  publication_year: 2025,
  doi_url: 'https://doi.org/10.1/x',
  publication_url: null,
  language: 'English',
  project_slugs: [],
  collection_slugs: ['obpex'],
}

test('fetch transport posts to the Data API RPC endpoint with the publishable key', async () => {
  const fetch =
    fakeFetch(() =>
      jsonResponse([
        externalRow,
      ])
    )

  const client =
    createAcademicApiClient(
      createFetchTransport({
        url: 'https://example.supabase.co/',
        publishableKey: 'sb_publishable_test',
        fetch: fetch.implementation,
        init: {
          next: {
            revalidate: 3600,
          },
        },
      })
    )

  const rows =
    await client.listPublicExternalPublications()

  assert.equal(rows.length, 1)
  assert.equal(fetch.calls.length, 1)

  const [call] = fetch.calls

  assert.equal(
    call.url,
    'https://example.supabase.co/rest/v1/rpc/list_public_external_publications'
  )
  assert.equal(call.init.method, 'POST')
  assert.equal(call.init.body, '{}')
  assert.deepEqual(call.init.next, {
    revalidate: 3600,
  })
  assert.equal(
    call.init.headers.get('apikey'),
    'sb_publishable_test'
  )
  assert.equal(
    call.init.headers.get('Authorization'),
    'Bearer sb_publishable_test'
  )
})

test('fetch transport sends RPC arguments as JSON', async () => {
  const fetch =
    fakeFetch(() =>
      jsonResponse([])
    )

  const transport =
    createFetchTransport({
      url: 'https://example.supabase.co',
      publishableKey: 'key',
      fetch: fetch.implementation,
    })

  await transport.rpc(
    'list_public_availability',
    {
      p_year: 2026,
    }
  )

  assert.equal(
    fetch.calls[0].init.body,
    '{"p_year":2026}'
  )
})

test('fetch transport reports PostgREST errors, network failures and invalid names', async () => {
  const failing =
    createFetchTransport({
      url: 'https://example.supabase.co',
      publishableKey: 'key',
      fetch: fakeFetch(() =>
        jsonResponse(
          {
            code: '42501',
            message: 'permission denied',
          },
          401
        )
      ).implementation,
    })

  assert.deepEqual(
    await failing.rpc(
      'get_my_pending_access_invitation'
    ),
    {
      data: null,
      error: {
        message: 'permission denied',
      },
    }
  )

  const offline =
    createFetchTransport({
      url: 'https://example.supabase.co',
      publishableKey: 'key',
      fetch: async () => {
        throw new Error('offline')
      },
    })

  assert.equal(
    (await offline.rpc('list_public_papers'))
      .error.message,
    'Network error: offline'
  )

  assert.match(
    (await offline.rpc('../secret'))
      .error.message,
    /Invalid RPC name/
  )

  await assert.rejects(
    createAcademicApiClient(failing)
      .listPublicPapers(),
    /list_public_papers failed: permission denied/
  )
})

test('fetch transport rejects unusable options', () => {
  assert.throws(
    () =>
      createFetchTransport({
        url: 'not a url',
        publishableKey: 'key',
      }),
    /absolute URL/
  )

  assert.throws(
    () =>
      createFetchTransport({
        url: 'ftp://example.org',
        publishableKey: 'key',
      }),
    /HTTP\(S\)/
  )

  assert.throws(
    () =>
      createFetchTransport({
        url: 'https://example.supabase.co',
        publishableKey: ' ',
      }),
    /publishableKey/
  )
})

test('collection and Project filters keep only matching rows', () => {
  const rows = [
    externalRow,
    {
      ...externalRow,
      slug: 'other-2024',
      collection_slugs: ['sudakas'],
    },
  ]

  assert.deepEqual(
    filterExternalPublicationsByCollection(
      rows,
      'obpex'
    ).map((row) => row.slug),
    ['partner-study-2025']
  )

  const projectRows = [
    {
      project_slug: 'sudakas',
      authorship: 'own',
      publication_slug: 'own-paper',
      title: 'Own',
      authors: ['B. G.'],
      venue: null,
      publication_date: null,
      publication_year: 2024,
      doi_url: null,
      publication_url: null,
      language: null,
    },
    {
      project_slug: 'sudakas',
      authorship: 'external',
      publication_slug: 'partner-study-2025',
      title: 'Partner study',
      authors: ['A. Partner'],
      venue: null,
      publication_date: '2025-03-01',
      publication_year: 2025,
      doi_url: null,
      publication_url: null,
      language: null,
    },
    {
      project_slug: 'other',
      authorship: 'own',
      publication_slug: 'elsewhere',
      title: 'Elsewhere',
      authors: ['B. G.'],
      venue: null,
      publication_date: null,
      publication_year: 2023,
      doi_url: null,
      publication_url: null,
      language: null,
    },
  ]

  assert.equal(
    filterProjectPublications(
      projectRows,
      'sudakas'
    ).length,
    2
  )

  assert.deepEqual(
    filterProjectPublications(
      projectRows,
      'sudakas',
      'external'
    ).map((row) => row.publication_slug),
    ['partner-study-2025']
  )
})

test('sortPublicationsByDate orders newest first without mutating its input', () => {
  const rows = [
    {
      title: 'B year only',
      publication_date: null,
      publication_year: 2025,
    },
    {
      title: 'Undated',
      publication_date: null,
      publication_year: null,
    },
    {
      title: 'A dated',
      publication_date: '2025-06-01',
      publication_year: 2025,
    },
    {
      title: 'Older',
      publication_date: '2023-01-15',
      publication_year: 2023,
    },
  ]

  const snapshot =
    rows.map((row) => row.title)

  assert.deepEqual(
    sortPublicationsByDate(rows)
      .map((row) => row.title),
    [
      'A dated',
      'B year only',
      'Older',
      'Undated',
    ]
  )

  assert.deepEqual(
    sortPublicationsByDate(
      rows,
      'oldest'
    ).map((row) => row.title),
    [
      'Older',
      'B year only',
      'A dated',
      'Undated',
    ]
  )

  assert.deepEqual(
    rows.map((row) => row.title),
    snapshot
  )
})

test('collection publication filter keeps one collection and authorship', () => {
  const rows = [
    {
      collection_slug: 'obpex',
      authorship: 'own',
      publication_slug: 'own-paper',
      title: 'Own',
      authors: ['B. G.'],
      venue: null,
      publication_date: null,
      publication_year: null,
      doi_url: null,
      publication_url: null,
      language: null,
    },
    {
      collection_slug: 'obpex',
      authorship: 'external',
      publication_slug: 'partner-study-2025',
      title: 'Partner study',
      authors: ['A. Partner'],
      venue: null,
      publication_date: '2025-03-01',
      publication_year: 2025,
      doi_url: null,
      publication_url: null,
      language: null,
    },
    {
      collection_slug: 'sudakas',
      authorship: 'own',
      publication_slug: 'own-paper',
      title: 'Own',
      authors: ['B. G.'],
      venue: null,
      publication_date: null,
      publication_year: null,
      doi_url: null,
      publication_url: null,
      language: null,
    },
  ]

  assert.deepEqual(
    filterCollectionPublications(
      rows,
      'obpex'
    ).map((row) => row.publication_slug),
    ['own-paper', 'partner-study-2025']
  )

  assert.deepEqual(
    filterCollectionPublications(
      rows,
      'obpex',
      'own'
    ).map((row) => row.publication_slug),
    ['own-paper']
  )
})
