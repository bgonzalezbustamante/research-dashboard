import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
    return null
  }

  const tail = corpus.slice(start)
  const end = tail.indexOf(';')

  if (end < 0) {
    fail('Could not parse constraint ' + constraintName + '.')
  }

  return tail.slice(0, end + 1)
}

function latestCreateTableBlock(corpus, tableName) {
  const start = lastMatchIndex(
    corpus,
    new RegExp(
      'create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+public\\.' +
        tableName +
        '\\s*\\(',
      'gi'
    )
  )

  if (start < 0) {
    fail(
      'No migration CREATE TABLE found for public.' +
        tableName +
        '.'
    )
  }

  const tail = corpus.slice(start)
  const end = tail.indexOf('\n);')

  if (end < 0) {
    fail(
      'Could not parse CREATE TABLE block for public.' +
        tableName +
        '.'
    )
  }

  return tail.slice(0, end + 3)
}

function vocabularyMigrationBlock(corpus, vocabulary) {
  if (vocabulary.sourceFunction) {
    return latestFunctionBlock(
      corpus,
      vocabulary.sourceFunction
    )
  }

  const namedConstraint = latestConstraintBlock(
    corpus,
    vocabulary.constraint
  )

  if (namedConstraint) {
    return namedConstraint
  }

  if (vocabulary.id === 'project-status') {
    return latestCreateTableBlock(corpus, 'projects')
  }

  fail(
    'No migration definition found for constraint ' +
      vocabulary.constraint +
      '.'
  )
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
    'list_public_availability',
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
    const block = vocabularyMigrationBlock(
      corpus,
      vocabulary
    )
    const actualValues = quotedValues(block)

    if (vocabulary.sourceFunction) {
      const missingValues =
        vocabulary.values.filter(
          (value) =>
            !actualValues.includes(value)
        )

      if (missingValues.length > 0) {
        fail(
          vocabulary.label +
            ' is missing values from ' +
            vocabulary.sourceFunction +
            '(). Missing: ' +
            missingValues.join(', ')
        )
      }

      continue
    }

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

async function liveCheck() {
  const live =
    process.argv.includes('--live')

  if (!live) {
    console.log(
      '• Live RPC validation skipped (run npm run check:public-api:live).'
    )
    return
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (
    !url ||
    !publishableKey
  ) {
    fail(
      'Live validation requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  const referenceClientPath =
    path.join(
      root,
      'node_modules',
      '.cache',
      'academic-api-client',
      'index.js'
    )

  if (
    !fs.existsSync(
      referenceClientPath
    )
  ) {
    fail(
      'Academic API reference client build is missing. Run npm run build:academic-api-client before the live checker.'
    )
  }

  const [
    { createClient },
    { createAcademicApiClient },
  ] = await Promise.all([
    import(
      '@supabase/supabase-js'
    ),
    import(
      pathToFileURL(
        referenceClientPath
      ).href
    ),
  ])

  const supabase =
    createClient(
      url,
      publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )

  const api =
    createAcademicApiClient(
      supabase
    )

  const papers =
    await api.listPublicPapers()

  if (
    papers.length > 0
  ) {
    const detail =
      await api.getPublicPaper(
        papers[0].slug
      )

    if (!detail) {
      fail(
        'get_public_paper(text) did not resolve a listed public slug.'
      )
    }
  }

  const missingPaper =
    await api.getPublicPaper(
      '__academic-api-contract-missing__'
    )

  if (
    missingPaper !== null
  ) {
    fail(
      'get_public_paper(text) must return no row for an unknown/non-public slug.'
    )
  }

  const projects =
    await api.listPublicProjects()

  if (
    projects.length > 0
  ) {
    const detail =
      await api.getPublicProject(
        projects[0].slug
      )

    if (!detail) {
      fail(
        'get_public_project(text) did not resolve a listed public slug.'
      )
    }
  }

  const missingProject =
    await api.getPublicProject(
      '__academic-api-contract-missing__'
    )

  if (
    missingProject !== null
  ) {
    fail(
      'get_public_project(text) must return no row for an unknown/non-public slug.'
    )
  }

  await api
    .listPublicConferencePresentations()

  await api
    .listPublicTeaching()

  const year =
    Number(
      new Intl.DateTimeFormat(
        'en-GB',
        {
          timeZone:
            'Europe/Amsterdam',
          year: 'numeric',
        }
      ).format(
        new Date()
      )
    )

  await api
    .getPublicWorkAnalytics(
      year
    )

  await api
    .listPublicAvailability(
      year
    )

  const privateTables = [
    'papers',
    'paper_public_metadata',
    'citation_snapshots',
    'projects',
    'project_public_metadata',
    'conference_presentations',
    'teaching_portfolio',
    'teaching_public_metadata',
    'daily_logs',
    'work_sessions',
    'planning_blocked_events',
    'planning_source_period_states',
  ]

  for (
    const table of
    privateTables
  ) {
    const result =
      await supabase
        .from(table)
        .select('*')
        .limit(1)

    if (!result.error) {
      fail(
        'Anonymous direct table access unexpectedly succeeded for: ' +
          table
      )
    }
  }

  console.log(
    '✓ Live Public RPC v1 responses passed reference client validation'
  )
  console.log(
    '✓ Anonymous direct table access remains blocked'
  )
}

async function main() {
  const contract = loadContract()
  const corpus = loadMigrationCorpus()
  const operations = assertManifest(contract)

  assertMigrations(contract, operations, corpus)
  await liveCheck()

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
