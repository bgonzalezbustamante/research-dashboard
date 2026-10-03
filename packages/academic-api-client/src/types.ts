import {
  CONTROLLED_VOCABULARIES,
  RPC_FIELDS,
} from './contract.generated.js'

export type PublicationIndex =
  (typeof CONTROLLED_VOCABULARIES)['publication-index'][number]
export type PaperLanguage =
  (typeof CONTROLLED_VOCABULARIES)['paper-language'][number]
export type ProjectRole =
  (typeof CONTROLLED_VOCABULARIES)['project-role'][number]
export type ProjectStatus =
  (typeof CONTROLLED_VOCABULARIES)['project-status'][number]
export type ConferencePresentationType =
  (typeof CONTROLLED_VOCABULARIES)['conference-presentation-type'][number]
export type TeachingRole =
  (typeof CONTROLLED_VOCABULARIES)['teaching-role'][number]
export type TeachingLevel =
  (typeof CONTROLLED_VOCABULARIES)['teaching-level'][number]

export type PublicPaper = {
  slug: string
  title: string
  authors: string[]
  abstract: string | null
  venue: string | null
  publication_date: string | null
  doi_url: string | null
  publication_url: string | null
  preprint_url: string | null
  github_url: string | null
  dataset_url: string | null
  featured: boolean
  publication_index: PublicationIndex | null
  language: PaperLanguage | null
  google_scholar_citations: number | null
  google_scholar_citations_captured_on: string | null
  project_url: string | null
  si_file_url: string | null
}

export type PublicPaperDetail =
  PublicPaper & {
    citation: string | null
    highlight_text: string | null
    highlight_image_filename: string | null
    highlight_image_alt: string | null
    highlight_image_caption: string | null
  }

export type PublicConferencePresentation = {
  event_name: string
  event_short_name: string
  location: string | null
  presentation_date: string
  start_date: string
  end_date: string
  presentation_title: string | null
  authors: string[]
  presentation_type: ConferencePresentationType
  url: string | null
}

export type PublicProject = {
  slug: string
  short_title: string
  title: string
  abstract: string
  role: ProjectRole | null
  funder: string
  funder_note: string | null
  url: string | null
  start_year: number | null
  end_year: number | null
  status: ProjectStatus
  featured: boolean
  project_image_filename: string | null
  funder_image_filename: string | null
  publication_slugs: string[]
  conference_presentations: PublicConferencePresentation[]
}

export type PublicTeachingItem = {
  slug: string | null
  name: string
  institution: string
  summary: string
  role: TeachingRole | null
  start_year: number
  end_year: number | null
  is_current: boolean
  levels: TeachingLevel[]
  times_taught: number
  student_count: number
  course_image_filename: string | null
}

export type PublicWorkDay = {
  date: string
  net_minutes: number
  coffee_count: number
}

export type PublicWorkAnalytics = {
  year: number
  average_net_minutes_per_working_day: number
  average_coffees_per_working_day: number
  days: PublicWorkDay[]
}

type KeysEqual<
  TValue,
  TFields extends readonly string[],
> =
  Exclude<keyof TValue, TFields[number]> extends never
    ? Exclude<TFields[number], keyof TValue> extends never
      ? true
      : false
    : false

type Assert<T extends true> = T

export type PublicPaperContractKeysMatch = Assert<
  KeysEqual<
    PublicPaper,
    typeof RPC_FIELDS.list_public_papers
  >
>

export type PublicPaperDetailContractKeysMatch = Assert<
  KeysEqual<
    PublicPaperDetail,
    typeof RPC_FIELDS.get_public_paper
  >
>

export type PublicProjectContractKeysMatch = Assert<
  KeysEqual<
    PublicProject,
    typeof RPC_FIELDS.list_public_projects
  >
>

export type PublicConferenceContractKeysMatch = Assert<
  KeysEqual<
    PublicConferencePresentation,
    typeof RPC_FIELDS.list_public_conference_presentations
  >
>

export type PublicTeachingContractKeysMatch = Assert<
  KeysEqual<
    PublicTeachingItem,
    typeof RPC_FIELDS.list_public_teaching
  >
>

export type PublicWorkAnalyticsContractKeysMatch = Assert<
  KeysEqual<
    PublicWorkAnalytics,
    typeof RPC_FIELDS.get_public_work_analytics
  >
>
