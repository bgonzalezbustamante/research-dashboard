import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const repositoryRoot = path.resolve(packageRoot, '..', '..')
const manifestPath = path.join(
  repositoryRoot,
  'lib',
  'academic-api-contract.json'
)
const outputPath = path.join(
  packageRoot,
  'src',
  'contract.generated.ts'
)

const contract = JSON.parse(
  fs.readFileSync(manifestPath, 'utf8')
)

const rpcFields = {}
const rpcParameters = {}

for (const resource of contract.resources) {
  for (const operation of resource.operations) {
    rpcFields[operation.name] =
      operation.fields.map((field) => field.name)
    rpcParameters[operation.name] =
      operation.parameters.map(
        (parameter) => parameter.name
      )
  }
}

const controlledVocabularies =
  Object.fromEntries(
    contract.controlledVocabularies.map(
      (vocabulary) => [
        vocabulary.id,
        vocabulary.values,
      ]
    )
  )

const workAnalytics =
  contract.resources
    .flatMap((resource) => resource.operations)
    .find(
      (operation) =>
        operation.name ===
        'get_public_work_analytics'
    )

if (!workAnalytics) {
  throw new Error(
    'Academic API contract is missing get_public_work_analytics.'
  )
}

const topLevelWorkFields =
  new Set(
    workAnalytics.fields.map(
      (field) => field.name
    )
  )

const workAnalyticsDayFields =
  (workAnalytics.jsonKeys ?? []).filter(
    (key) =>
      !topLevelWorkFields.has(key)
  )

const generated =
  `// Generated from lib/academic-api-contract.json.
// Do not edit by hand. Run npm run generate:academic-api-client.

export const PUBLIC_RPC_VERSION = ${JSON.stringify(contract.version)} as const

export const RPC_FIELDS = ${JSON.stringify(rpcFields, null, 2)} as const

export const RPC_PARAMETERS = ${JSON.stringify(rpcParameters, null, 2)} as const

export const CONTROLLED_VOCABULARIES = ${JSON.stringify(controlledVocabularies, null, 2)} as const

export const WORK_ANALYTICS_DAY_FIELDS = ${JSON.stringify(workAnalyticsDayFields, null, 2)} as const

export type AcademicApiRpcName = keyof typeof RPC_FIELDS
`

if (process.argv.includes('--check')) {
  const current =
    fs.existsSync(outputPath)
      ? fs.readFileSync(outputPath, 'utf8')
      : ''

  if (current !== generated) {
    console.error(
      'Academic API client contract metadata is stale. Run npm run generate:academic-api-client and commit the result.'
    )
    process.exitCode = 1
  } else {
    console.log(
      '✓ Academic API client contract metadata matches the manifest'
    )
  }
} else {
  fs.writeFileSync(
    outputPath,
    generated
  )
  console.log(
    '✓ Generated Academic API client contract metadata'
  )
}
