// Values mirror the external_publications_language_check constraint, which
// reuses the Paper language vocabulary.
export const externalPublicationLanguages = [
  'English',
  'Spanish',
  'Portuguese',
  'Dutch',
  'German',
  'French',
  'Italian',
] as const

export type ExternalPublicationRow = {
  id: string
  title: string
  authors: string[]
  venue: string | null
  publication_year: number
  published_on: string | null
  doi_url: string | null
  publication_url: string | null
  language: string | null
  visibility: 'private' | 'public'
}
