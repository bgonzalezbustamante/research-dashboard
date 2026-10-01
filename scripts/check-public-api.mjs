import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const contractPath = path.join(root, 'lib', 'academic-api-contract.json')
const migrationsDir = path.join(root, 'supabase', 'migrations')

function fail(message) {
  throw new Error(message)
}

function sameArray(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function unique(values) {
  return [...new Set(values)]
}

function fieldNames(operation) {
  return operation.fields.map((field) => field.name)
}

function loadContract() {
  return JSON.parse(fs.readFileSync(contractPath, 'utf8'))
}

function loadMigrationCorpus() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  return files
    .map((file) => {
      const content = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf8'
      )
      return '-- FILE: ' + file + '\n' + content
    })
    .join('\n\n')
}

function lastMatchIndex(corpus, regex) {
  let index = -1
  let match
  regex.lastIndex = 0

  while ((match = regex.exec(corpus))) {
    index = match.index
  }

  return index
}

function latestFunctionBlock(corpus, functionName) {
  const start = lastMatchIndex(
    corpus,
    new RegExp(
      'create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.' +
        functionName +
        '\\s*\\(',
      'gi'
    )
  )

  if (start < 0) {
    fail(
      'No migration definition found for public.' +
        functionName +
        '().'
    )
  }

  const tail = corpus.slice(start)
  const endings = [
    tail.indexOf('\n$$;'),
    tail.indexOf('\n$function$;'),
  ].filter((index) => index >= 0)

  if (endings.length === 0) {
    return tail.slice(0, Math.min(tail.length, 50000))
  }

  const firstEnd = Math.min(...endings)
  const marker = tail
    .slice(firstEnd)
    .startsWith('\n$function$;')
    ? '\n$function$;'
    : '\n$$;'

  return tail.slice(0, firstEnd + marker.length)
}

function parseTableFields(functionBlock, functionName) {
  const match = functionBlock.match(
    /returns\s+table\s*\(([\s\S]*?)\)\s*language/i
  )

  if (!match) {
    fail(
      'Could not parse TABLE return shape for ' +
        functionName +
        '().'
    )
  }

  return match[1]
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => field.split(/\s+/)[0])
}

function latestConstraintBlock(corpus, constraintName) {
  const start = lastMatchIndex(
    corpus,
    new RegExp(
      'add\\s+constraint\\s+' + constraintName + '\\b',
      'gi'
    )
  )

  if (start < 0) {
    fail(
      'No migration definition found for constraint ' +
        constraintName +
        '.'
    )
  }

  const tail = corpus.slice(start)
  const end = tail.indexOf(';')

  if (end < 0) {
    fail('Could not parse constraint ' + constraintName + '.')
  }

  return tail.slice(0, end + 1)
}

function quotedValues(block) {
  return unique(
    [...block.matchAll(/'([^']+)'/g)].map((match) => match[1])
  )
}

function assertManifest(contract) {
  if (
    contract.name !== 'Academic API' ||
    contract.version !== 'Public RPC v1'
  ) {
    fail('Academic API identity/version changed unexpectedly.')
  }

  const expectedRpcs = [
    'list_public_papers',
    'get_public_paper',
    'list_public_projects',
    'get_public_project',
    'list_public_conference_presentations',
    'list_public_teaching',
    'get_public_work_analytics',
  ]

  const operations = contract.resources.flatMap((resource) =>
    resource.operations.map((operation) => ({
      resource,
      operation,
    }))
  )

  const rpcNames = operations.map(({ operation }) => operation.name)

  if (
    !sameArray(
      [...rpcNames].sort(),
      [...expectedRpcs].sort()
    )
  ) {
    fail(
      'Manifest RPC surface differs from Public RPC v1. Found: ' +
        rpcNames.join(', ')
    )
  }

  for (const { resource, operation } of operations) {
    const fields = fieldNames(operation)

    if (unique(fields).length !== fields.length) {
      fail(operation.signature + ' contains duplicate fields.')
    }

    for (const forbidden of resource.forbiddenFields) {
      if (fields.includes(forbidden)) {
        fail(
          operation.signature +
            ' exposes forbidden private field: ' +
            forbidden
        )
      }
    }
  }

  for (const consumer of contract.consumers) {
    for (const rpc of consumer.rpcs) {
      if (!rpcNames.includes(rpc)) {
        fail(
          consumer.name + ' references unknown RPC: ' + rpc
        )
      }
    }
  }

  const publications = contract.resources.find(
    (resource) => resource.id === 'publications'
  )
  const paperList = publications.operations.find(
    (operation) => operation.name === 'list_public_papers'
  )
  const paperDetail = publications.operations.find(
    (operation) => operation.name === 'get_public_paper'
  )

  const paperListFields = fieldNames(paperList)
  const paperDetailFields = fieldNames(paperDetail)

  const actualDetailOnly = paperDetailFields.filter(
    (field) => !paperListFields.includes(field)
  )
  const actualListingOnly = paperListFields.filter(
    (field) => !paperDetailFields.includes(field)
  )

  if (
    !sameArray(actualDetailOnly, paperDetail.detailOnly) ||
    !sameArray(actualListingOnly, paperDetail.listingOnly)
  ) {
    fail(
      'Publication listing/detail field boundary differs from the manifest.'
    )
  }

  const projects = contract.resources.find(
    (resource) => resource.id === 'projects'
  )
  const projectList = projects.operations.find(
    (operation) => operation.name === 'list_public_projects'
  )
  const projectDetail = projects.operations.find(
    (operation) => operation.name === 'get_public_project'
  )

  if (
    !sameArray(
      fieldNames(projectList),
      fieldNames(projectDetail)
    )
  ) {
    fail(
      'Project listing/detail shapes are expected to match in Public RPC v1.'
    )
  }

  console.log('✓ Academic API manifest invariants')

  return operations
}

function assertMigrations(contract, operations, corpus) {
  for (const { operation } of operations) {
    const block = latestFunctionBlock(corpus, operation.name)
    const expectedFields = fieldNames(operation)

    if (operation.name === 'get_public_work_analytics') {
      if (!/returns\s+jsonb/i.test(block)) {
        fail('get_public_work_analytics(year) must return jsonb.')
      }

      for (const key of operation.jsonKeys) {
        if (!block.includes("'" + key + "'")) {
          fail(
            'get_public_work_analytics(year) definition is missing JSON key: ' +
              key
          )
        }
      }

      continue
    }

    const actualFields = parseTableFields(
      block,
      operation.name
    )

    if (!sameArray(actualFields, expectedFields)) {
      fail(
        operation.signature +
          ' return shape differs from the Academic API manifest.\nExpected: ' +
          expectedFields.join(', ') +
          '\nActual: ' +
          actualFields.join(', ')
      )
    }
  }

  for (const vocabulary of contract.controlledVocabularies) {
    const block = latestConstraintBlock(
      corpus,
      vocabulary.constraint
    )
    const actualValues = quotedValues(block)

    if (!sameArray(actualValues, vocabulary.values)) {
      fail(
        vocabulary.label +
          ' differs from the database constraint snapshot.\nExpected: ' +
          vocabulary.values.join(', ') +
          '\nActual: ' +
          actualValues.join(', ')
      )
    }
  }

  console.log('✓ RPC return shapes match migrations')
  console.log('✓ Controlled vocabularies match migrations')
}

function assertExactKeys(record, expected, label) {
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()

  if (!sameArray(actual, wanted)) {
    fail(
      label +
        ' keys differ from Public RPC v1.\nExpected: ' +
        wanted.join(', ') +
        '\nActual: ' +
        actual.join(', ')
    )
  }
}

async function liveCheck(contract) {
  const live = process.argv.includes('--live')

  if (!live) {
    console.log(
      '• Live RPC validation skipped (run npm run check:public-api -- --live with Supabase public environment variables exported).'
    )
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    fail(
      'Live validation requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const byName = new Map(
    contract.resources
      .flatMap((resource) => resource.operations)
      .map((operation) => [operation.name, operation])
  )

  async function call(name, args) {
    const result = await supabase.rpc(name, args)

    if (result.error) {
      fail(name + ' live call failed: ' + result.error.message)
    }

    return result.data
  }

  const papers =
    (await call('list_public_papers')) ?? []

  for (const paper of papers) {
    assertExactKeys(
      paper,
      fieldNames(byName.get('list_public_papers')),
      'Public paper listing row'
    )
  }

  if (papers.length > 0) {
    const details = await call('get_public_paper', {
      p_slug: papers[0].slug,
    })
    const detail = details?.[0]

    if (!detail) {
      fail(
        'get_public_paper(text) did not resolve a listed Public slug.'
      )
    }

    assertExactKeys(
      detail,
      fieldNames(byName.get('get_public_paper')),
      'Public paper detail row'
    )
  }

  const projects =
    (await call('list_public_projects')) ?? []

  for (const project of projects) {
    assertExactKeys(
      project,
      fieldNames(byName.get('list_public_projects')),
      'Public project listing row'
    )
  }

  if (projects.length > 0) {
    const details = await call('get_public_project', {
      p_slug: projects[0].slug,
    })
    const detail = details?.[0]

    if (!detail) {
      fail(
        'get_public_project(text) did not resolve a listed Public slug.'
      )
    }

    assertExactKeys(
      detail,
      fieldNames(byName.get('get_public_project')),
      'Public project detail row'
    )
  }

  const conferences =
    (await call('list_public_conference_presentations')) ?? []

  for (const conference of conferences) {
    assertExactKeys(
      conference,
      fieldNames(
        byName.get('list_public_conference_presentations')
      ),
      'Public conference row'
    )
  }

  const teaching =
    (await call('list_public_teaching')) ?? []

  for (const item of teaching) {
    assertExactKeys(
      item,
      fieldNames(byName.get('list_public_teaching')),
      'Public teaching row'
    )
  }

  const year = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
    }).format(new Date())
  )

  const analytics = await call('get_public_work_analytics', {
    p_year: year,
  })

  assertExactKeys(
    analytics,
    fieldNames(byName.get('get_public_work_analytics')),
    'Public work analytics payload'
  )

  for (const day of analytics.days ?? []) {
    assertExactKeys(
      day,
      ['date', 'net_minutes'],
      'Public work analytics day'
    )
  }

  const vocab = new Map(
    contract.controlledVocabularies.map((item) => [
      item.id,
      new Set(item.values),
    ])
  )

  for (const paper of papers) {
    if (
      paper.publication_index != null &&
      !vocab
        .get('publication-index')
        .has(paper.publication_index)
    ) {
      fail(
        'Live paper payload contains an unknown publication_index.'
      )
    }

    if (
      paper.language != null &&
      !vocab.get('paper-language').has(paper.language)
    ) {
      fail('Live paper payload contains an unknown language.')
    }
  }

  for (const project of projects) {
    if (
      project.role != null &&
      !vocab.get('project-role').has(project.role)
    ) {
      fail('Live project payload contains an unknown role.')
    }

    if (!vocab.get('project-status').has(project.status)) {
      fail('Live project payload contains an unknown status.')
    }
  }

  for (const presentation of conferences) {
    if (
      !vocab
        .get('conference-presentation-type')
        .has(presentation.presentation_type)
    ) {
      fail(
        'Live conference payload contains an unknown presentation_type.'
      )
    }
  }

  for (const item of teaching) {
    if (
      item.role != null &&
      !vocab.get('teaching-role').has(item.role)
    ) {
      fail('Live teaching payload contains an unknown role.')
    }

    for (const level of item.levels ?? []) {
      if (!vocab.get('teaching-level').has(level)) {
        fail('Live teaching payload contains an unknown level.')
      }
    }
  }

  console.log('✓ Live Public RPC v1 payload validation')
}

async function main() {
  const contract = loadContract()
  const corpus = loadMigrationCorpus()
  const operations = assertManifest(contract)

  assertMigrations(contract, operations, corpus)
  await liveCheck(contract)

  console.log('✓ Academic API contract validation passed.')
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? '✗ ' + error.message
      : '✗ Academic API validation failed.'
  )
  process.exitCode = 1
})
