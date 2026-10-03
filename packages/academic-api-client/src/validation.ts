import {
  CONTROLLED_VOCABULARIES,
  RPC_FIELDS,
  WORK_ANALYTICS_DAY_FIELDS,
} from './contract.generated.js'
import type {
  ConferencePresentationType,
  PaperLanguage,
  ProjectRole,
  ProjectStatus,
  PublicConferencePresentation,
  PublicPaper,
  PublicPaperDetail,
  PublicProject,
  PublicTeachingItem,
  PublicWorkAnalytics,
  PublicWorkDay,
  PublicationIndex,
  TeachingLevel,
  TeachingRole,
} from './types.js'

type RecordValue =
  Record<string, unknown>

export class AcademicApiValidationError
  extends Error {
  readonly path: string

  constructor(
    path: string,
    message: string
  ) {
    super(
      path
        ? `${path}: ${message}`
        : message
    )
    this.name =
      'AcademicApiValidationError'
    this.path = path
  }
}

function fail(
  path: string,
  message: string
): never {
  throw new AcademicApiValidationError(
    path,
    message
  )
}

function isRecord(
  value: unknown
): value is RecordValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function assertRecord(
  value: unknown,
  path: string
): asserts value is RecordValue {
  if (!isRecord(value)) {
    fail(
      path,
      'expected an object'
    )
  }
}

function assertExactKeys(
  value: RecordValue,
  expected: readonly string[],
  path: string
) {
  const actual =
    Object.keys(value).sort()
  const wanted =
    [...expected].sort()

  if (
    actual.length !== wanted.length ||
    actual.some(
      (key, index) =>
        key !== wanted[index]
    )
  ) {
    fail(
      path,
      `unexpected object shape; expected keys [${wanted.join(', ')}], received [${actual.join(', ')}]`
    )
  }
}

function assertString(
  value: unknown,
  path: string,
  {
    nonEmpty = true,
  }: {
    nonEmpty?: boolean
  } = {}
): asserts value is string {
  if (typeof value !== 'string') {
    fail(path, 'expected a string')
  }

  if (
    nonEmpty &&
    value.trim().length === 0
  ) {
    fail(
      path,
      'expected a non-empty string'
    )
  }
}

function assertNullableString(
  value: unknown,
  path: string
): asserts value is string | null {
  if (value === null) {
    return
  }

  assertString(
    value,
    path,
    { nonEmpty: false }
  )
}

function assertBoolean(
  value: unknown,
  path: string
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'expected a boolean')
  }
}

function assertFiniteNumber(
  value: unknown,
  path: string
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    fail(
      path,
      'expected a finite number'
    )
  }
}

function assertInteger(
  value: unknown,
  path: string
): asserts value is number {
  assertFiniteNumber(value, path)

  if (!Number.isInteger(value)) {
    fail(path, 'expected an integer')
  }
}

function assertNonNegativeInteger(
  value: unknown,
  path: string
): asserts value is number {
  assertInteger(value, path)

  if (value < 0) {
    fail(
      path,
      'expected a non-negative integer'
    )
  }
}

function assertNonNegativeFiniteNumber(
  value: unknown,
  path: string
): asserts value is number {
  assertFiniteNumber(value, path)

  if (value < 0) {
    fail(
      path,
      'expected a non-negative number'
    )
  }
}

function assertNullableInteger(
  value: unknown,
  path: string
): asserts value is number | null {
  if (value === null) {
    return
  }

  assertInteger(value, path)
}

function assertIsoDate(
  value: unknown,
  path: string
): asserts value is string {
  assertString(value, path)

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    fail(
      path,
      'expected a valid YYYY-MM-DD calendar date'
    )
  }

  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !== day
  ) {
    fail(
      path,
      'expected a valid YYYY-MM-DD calendar date'
    )
  }
}

function assertNullableIsoDate(
  value: unknown,
  path: string
): asserts value is string | null {
  if (value === null) {
    return
  }

  assertIsoDate(value, path)
}

function assertHttpUrl(
  value: unknown,
  path: string
): asserts value is string {
  assertString(value, path)

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    fail(
      path,
      'expected an absolute HTTP(S) URL'
    )
  }

  if (
    parsed.protocol !== 'http:' &&
    parsed.protocol !== 'https:'
  ) {
    fail(
      path,
      'expected an absolute HTTP(S) URL'
    )
  }
}

function assertNullableHttpUrl(
  value: unknown,
  path: string
): asserts value is string | null {
  if (value === null) {
    return
  }

  assertHttpUrl(value, path)
}

function assertStringArray(
  value: unknown,
  path: string,
  {
    unique = false,
    minLength = 0,
  }: {
    unique?: boolean
    minLength?: number
  } = {}
): asserts value is string[] {
  if (!Array.isArray(value)) {
    fail(path, 'expected an array')
  }

  value.forEach(
    (entry, index) =>
      assertString(
        entry,
        `${path}[${index}]`
      )
  )

  if (value.length < minLength) {
    fail(
      path,
      `expected at least ${minLength} item(s)`
    )
  }

  if (
    unique &&
    new Set(value).size !==
      value.length
  ) {
    fail(
      path,
      'expected unique values'
    )
  }
}

function assertControlledValue<
  TValue extends string,
>(
  value: unknown,
  allowed: readonly TValue[],
  path: string
): asserts value is TValue {
  assertString(value, path)

  if (
    !allowed.includes(
      value as TValue
    )
  ) {
    fail(
      path,
      `unexpected value "${value}"; expected one of [${allowed.join(', ')}]`
    )
  }
}

function assertNullableControlledValue<
  TValue extends string,
>(
  value: unknown,
  allowed: readonly TValue[],
  path: string
): asserts value is TValue | null {
  if (value === null) {
    return
  }

  assertControlledValue(
    value,
    allowed,
    path
  )
}

function parseArray<T>(
  value: unknown,
  path: string,
  parser: (
    entry: unknown,
    path: string
  ) => T
): T[] {
  if (!Array.isArray(value)) {
    fail(path, 'expected an array')
  }

  return value.map(
    (entry, index) =>
      parser(
        entry,
        `${path}[${index}]`
      )
  )
}

function parsePaperBase(
  value: unknown,
  fields: readonly string[],
  path: string
): PublicPaper {
  assertRecord(value, path)
  assertExactKeys(
    value,
    fields,
    path
  )

  assertString(
    value.slug,
    `${path}.slug`
  )
  assertString(
    value.title,
    `${path}.title`
  )
  assertStringArray(
    value.authors,
    `${path}.authors`
  )
  assertNullableString(
    value.abstract,
    `${path}.abstract`
  )
  assertNullableString(
    value.venue,
    `${path}.venue`
  )
  assertNullableIsoDate(
    value.publication_date,
    `${path}.publication_date`
  )

  for (const field of [
    'doi_url',
    'publication_url',
    'preprint_url',
    'github_url',
    'dataset_url',
    'project_url',
    'si_file_url',
  ] as const) {
    assertNullableHttpUrl(
      value[field],
      `${path}.${field}`
    )
  }

  assertBoolean(
    value.featured,
    `${path}.featured`
  )
  assertNullableControlledValue<PublicationIndex>(
    value.publication_index,
    CONTROLLED_VOCABULARIES[
      'publication-index'
    ],
    `${path}.publication_index`
  )
  assertNullableControlledValue<PaperLanguage>(
    value.language,
    CONTROLLED_VOCABULARIES[
      'paper-language'
    ],
    `${path}.language`
  )

  if (
    value.google_scholar_citations !==
    null
  ) {
    assertNonNegativeInteger(
      value.google_scholar_citations,
      `${path}.google_scholar_citations`
    )
  }

  assertNullableIsoDate(
    value.google_scholar_citations_captured_on,
    `${path}.google_scholar_citations_captured_on`
  )

  const citationsPresent =
    value.google_scholar_citations !==
    null
  const capturedOnPresent =
    value.google_scholar_citations_captured_on !==
    null

  if (
    citationsPresent !==
    capturedOnPresent
  ) {
    fail(
      path,
      'google_scholar_citations and google_scholar_citations_captured_on must both be null or both be present'
    )
  }

  return value as unknown as PublicPaper
}

export function parsePublicPaperList(
  payload: unknown
): PublicPaper[] {
  return parseArray(
    payload,
    'list_public_papers response',
    (value, path) =>
      parsePaperBase(
        value,
        RPC_FIELDS.list_public_papers,
        path
      )
  )
}

export function parsePublicPaperDetailResponse(
  payload: unknown
): PublicPaperDetail | null {
  const rows =
    parseArray(
      payload,
      'get_public_paper response',
      (value, path) => {
        const paper =
          parsePaperBase(
            value,
            RPC_FIELDS.get_public_paper,
            path
          )

        const record =
          value as RecordValue

        for (const field of [
          'citation',
          'highlight_text',
          'highlight_image_filename',
          'highlight_image_alt',
          'highlight_image_caption',
        ] as const) {
          assertNullableString(
            record[field],
            `${path}.${field}`
          )
        }

        return value as unknown as PublicPaperDetail
      }
    )

  if (rows.length > 1) {
    fail(
      'get_public_paper response',
      'expected zero or one row'
    )
  }

  return rows[0] ?? null
}

export function parsePublicConferencePresentation(
  value: unknown,
  path =
    'conference presentation'
): PublicConferencePresentation {
  assertRecord(value, path)
  assertExactKeys(
    value,
    RPC_FIELDS.list_public_conference_presentations,
    path
  )

  assertString(
    value.event_name,
    `${path}.event_name`
  )
  assertString(
    value.event_short_name,
    `${path}.event_short_name`
  )
  assertNullableString(
    value.location,
    `${path}.location`
  )
  assertIsoDate(
    value.presentation_date,
    `${path}.presentation_date`
  )
  assertIsoDate(
    value.start_date,
    `${path}.start_date`
  )
  assertIsoDate(
    value.end_date,
    `${path}.end_date`
  )

  if (
    value.presentation_date !==
    value.start_date
  ) {
    fail(
      `${path}.presentation_date`,
      'must equal start_date while the deprecated compatibility alias remains in Public RPC v1'
    )
  }

  if (
    value.end_date <
    value.start_date
  ) {
    fail(
      `${path}.end_date`,
      'must be on or after start_date'
    )
  }

  assertNullableString(
    value.presentation_title,
    `${path}.presentation_title`
  )
  assertStringArray(
    value.authors,
    `${path}.authors`
  )
  assertControlledValue<ConferencePresentationType>(
    value.presentation_type,
    CONTROLLED_VOCABULARIES[
      'conference-presentation-type'
    ],
    `${path}.presentation_type`
  )
  assertNullableHttpUrl(
    value.url,
    `${path}.url`
  )

  return value as unknown as PublicConferencePresentation
}

export function parsePublicConferenceList(
  payload: unknown
): PublicConferencePresentation[] {
  return parseArray(
    payload,
    'list_public_conference_presentations response',
    parsePublicConferencePresentation
  )
}

function parsePublicProject(
  value: unknown,
  path: string
): PublicProject {
  assertRecord(value, path)
  assertExactKeys(
    value,
    RPC_FIELDS.list_public_projects,
    path
  )

  for (const field of [
    'slug',
    'short_title',
    'title',
    'abstract',
    'funder',
  ] as const) {
    assertString(
      value[field],
      `${path}.${field}`
    )
  }

  assertNullableControlledValue<ProjectRole>(
    value.role,
    CONTROLLED_VOCABULARIES[
      'project-role'
    ],
    `${path}.role`
  )
  assertNullableString(
    value.funder_note,
    `${path}.funder_note`
  )
  assertNullableHttpUrl(
    value.url,
    `${path}.url`
  )
  assertNullableInteger(
    value.start_year,
    `${path}.start_year`
  )
  assertNullableInteger(
    value.end_year,
    `${path}.end_year`
  )

  for (const field of [
    'start_year',
    'end_year',
  ] as const) {
    const year = value[field]

    if (
      year !== null &&
      (
        year < 1000 ||
        year > 9999
      )
    ) {
      fail(
        `${path}.${field}`,
        'expected a year from 1000 through 9999'
      )
    }
  }

  if (
    value.start_year !== null &&
    value.end_year !== null &&
    value.end_year <
      value.start_year
  ) {
    fail(
      `${path}.end_year`,
      'must be greater than or equal to start_year'
    )
  }

  assertControlledValue<ProjectStatus>(
    value.status,
    CONTROLLED_VOCABULARIES[
      'project-status'
    ],
    `${path}.status`
  )
  assertBoolean(
    value.featured,
    `${path}.featured`
  )
  assertNullableString(
    value.project_image_filename,
    `${path}.project_image_filename`
  )
  assertNullableString(
    value.funder_image_filename,
    `${path}.funder_image_filename`
  )
  assertStringArray(
    value.publication_slugs,
    `${path}.publication_slugs`,
    { unique: true }
  )

  const presentations =
    parseArray(
      value.conference_presentations,
      `${path}.conference_presentations`,
      parsePublicConferencePresentation
    )

  return {
    ...(value as unknown as Omit<
      PublicProject,
      'conference_presentations'
    >),
    conference_presentations:
      presentations,
  }
}

export function parsePublicProjectList(
  payload: unknown
): PublicProject[] {
  return parseArray(
    payload,
    'list_public_projects response',
    parsePublicProject
  )
}

export function parsePublicProjectDetailResponse(
  payload: unknown
): PublicProject | null {
  const rows =
    parseArray(
      payload,
      'get_public_project response',
      parsePublicProject
    )

  if (rows.length > 1) {
    fail(
      'get_public_project response',
      'expected zero or one row'
    )
  }

  return rows[0] ?? null
}

function parsePublicTeachingItem(
  value: unknown,
  path: string
): PublicTeachingItem {
  assertRecord(value, path)
  assertExactKeys(
    value,
    RPC_FIELDS.list_public_teaching,
    path
  )

  assertNullableString(
    value.slug,
    `${path}.slug`
  )

  for (const field of [
    'name',
    'institution',
    'summary',
  ] as const) {
    assertString(
      value[field],
      `${path}.${field}`
    )
  }

  assertNullableControlledValue<TeachingRole>(
    value.role,
    CONTROLLED_VOCABULARIES[
      'teaching-role'
    ],
    `${path}.role`
  )
  assertInteger(
    value.start_year,
    `${path}.start_year`
  )

  if (
    value.start_year < 1900 ||
    value.start_year > 2100
  ) {
    fail(
      `${path}.start_year`,
      'expected a year from 1900 through 2100'
    )
  }

  assertNullableInteger(
    value.end_year,
    `${path}.end_year`
  )
  assertBoolean(
    value.is_current,
    `${path}.is_current`
  )

  if (
    value.is_current &&
    value.end_year !== null
  ) {
    fail(
      `${path}.end_year`,
      'must be null when is_current is true'
    )
  }

  if (
    !value.is_current &&
    value.end_year === null
  ) {
    fail(
      `${path}.end_year`,
      'must be present when is_current is false'
    )
  }

  if (
    value.end_year !== null &&
    value.end_year <
      value.start_year
  ) {
    fail(
      `${path}.end_year`,
      'must be greater than or equal to start_year'
    )
  }

  assertStringArray(
    value.levels,
    `${path}.levels`,
    {
      unique: true,
      minLength: 1,
    }
  )

  if (value.levels.length > 3) {
    fail(
      `${path}.levels`,
      'expected at most 3 values'
    )
  }

  value.levels.forEach(
    (level, index) =>
      assertControlledValue<TeachingLevel>(
        level,
        CONTROLLED_VOCABULARIES[
          'teaching-level'
        ],
        `${path}.levels[${index}]`
      )
  )

  assertInteger(
    value.times_taught,
    `${path}.times_taught`
  )

  if (value.times_taught < 1) {
    fail(
      `${path}.times_taught`,
      'expected an integer of at least 1'
    )
  }

  assertNonNegativeInteger(
    value.student_count,
    `${path}.student_count`
  )
  assertNullableString(
    value.course_image_filename,
    `${path}.course_image_filename`
  )

  return value as unknown as PublicTeachingItem
}

export function parsePublicTeachingList(
  payload: unknown
): PublicTeachingItem[] {
  return parseArray(
    payload,
    'list_public_teaching response',
    parsePublicTeachingItem
  )
}

function daysInYear(
  year: number
) {
  return (
    Date.UTC(
      year + 1,
      0,
      1
    ) -
    Date.UTC(
      year,
      0,
      1
    )
  ) / 86400000
}

function parsePublicWorkDay(
  value: unknown,
  path: string,
  expectedYear: number
): PublicWorkDay {
  assertRecord(value, path)
  assertExactKeys(
    value,
    WORK_ANALYTICS_DAY_FIELDS,
    path
  )
  assertIsoDate(
    value.date,
    `${path}.date`
  )

  if (
    Number(
      value.date.slice(0, 4)
    ) !== expectedYear
  ) {
    fail(
      `${path}.date`,
      `falls outside requested year ${expectedYear}`
    )
  }

  assertNonNegativeInteger(
    value.net_minutes,
    `${path}.net_minutes`
  )
  assertNonNegativeInteger(
    value.coffee_count,
    `${path}.coffee_count`
  )

  return value as PublicWorkDay
}

export function parsePublicWorkAnalytics(
  payload: unknown,
  expectedYear: number
): PublicWorkAnalytics {
  if (
    !Number.isInteger(
      expectedYear
    ) ||
    expectedYear < 2000
  ) {
    fail(
      'get_public_work_analytics argument p_year',
      'expected an integer from 2000 onwards'
    )
  }

  assertRecord(
    payload,
    'get_public_work_analytics response'
  )
  assertExactKeys(
    payload,
    RPC_FIELDS.get_public_work_analytics,
    'get_public_work_analytics response'
  )

  if (
    payload.year !==
    expectedYear
  ) {
    fail(
      'get_public_work_analytics response.year',
      `returned ${String(payload.year)} instead of requested year ${expectedYear}`
    )
  }

  assertNonNegativeInteger(
    payload.average_net_minutes_per_working_day,
    'get_public_work_analytics response.average_net_minutes_per_working_day'
  )
  assertNonNegativeFiniteNumber(
    payload.average_coffees_per_working_day,
    'get_public_work_analytics response.average_coffees_per_working_day'
  )

  const days =
    parseArray(
      payload.days,
      'get_public_work_analytics response.days',
      (value, path) =>
        parsePublicWorkDay(
          value,
          path,
          expectedYear
        )
    )

  const seen =
    new Set<string>()

  for (const day of days) {
    if (seen.has(day.date)) {
      fail(
        'get_public_work_analytics response.days',
        `contains duplicate date ${day.date}`
      )
    }

    seen.add(day.date)
  }

  const expectedDays =
    daysInYear(expectedYear)

  if (
    days.length !==
    expectedDays
  ) {
    fail(
      'get_public_work_analytics response.days',
      `expected ${expectedDays} unique calendar days for ${expectedYear}, received ${days.length}`
    )
  }

  return {
    year: expectedYear,
    average_net_minutes_per_working_day:
      payload.average_net_minutes_per_working_day,
    average_coffees_per_working_day:
      payload.average_coffees_per_working_day,
    days,
  }
}
