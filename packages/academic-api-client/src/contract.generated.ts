// Generated from lib/academic-api-contract.json.
// Do not edit by hand. Run npm run generate:academic-api-client.

export const PUBLIC_RPC_VERSION = "Public RPC v1" as const

export const RPC_FIELDS = {
  "list_public_papers": [
    "slug",
    "title",
    "authors",
    "abstract",
    "venue",
    "publication_date",
    "doi_url",
    "publication_url",
    "preprint_url",
    "github_url",
    "dataset_url",
    "featured",
    "publication_index",
    "language",
    "google_scholar_citations",
    "google_scholar_citations_captured_on",
    "project_url",
    "si_file_url"
  ],
  "get_public_paper": [
    "slug",
    "title",
    "authors",
    "abstract",
    "venue",
    "publication_date",
    "doi_url",
    "publication_url",
    "preprint_url",
    "github_url",
    "dataset_url",
    "featured",
    "publication_index",
    "language",
    "google_scholar_citations",
    "google_scholar_citations_captured_on",
    "citation",
    "highlight_text",
    "highlight_image_filename",
    "highlight_image_alt",
    "highlight_image_caption",
    "project_url",
    "si_file_url"
  ],
  "list_public_projects": [
    "slug",
    "short_title",
    "title",
    "abstract",
    "role",
    "funder",
    "funder_note",
    "url",
    "start_year",
    "end_year",
    "status",
    "featured",
    "project_image_filename",
    "funder_image_filename",
    "publication_slugs",
    "conference_presentations"
  ],
  "get_public_project": [
    "slug",
    "short_title",
    "title",
    "abstract",
    "role",
    "funder",
    "funder_note",
    "url",
    "start_year",
    "end_year",
    "status",
    "featured",
    "project_image_filename",
    "funder_image_filename",
    "publication_slugs",
    "conference_presentations"
  ],
  "list_public_conference_presentations": [
    "event_name",
    "event_short_name",
    "location",
    "presentation_date",
    "start_date",
    "end_date",
    "presentation_title",
    "authors",
    "presentation_type",
    "url"
  ],
  "list_public_teaching": [
    "slug",
    "name",
    "institution",
    "summary",
    "role",
    "start_year",
    "end_year",
    "is_current",
    "levels",
    "times_taught",
    "student_count",
    "course_image_filename"
  ],
  "get_public_work_analytics": [
    "year",
    "average_net_minutes_per_working_day",
    "average_coffees_per_working_day",
    "days"
  ]
} as const

export const RPC_PARAMETERS = {
  "list_public_papers": [],
  "get_public_paper": [
    "p_slug"
  ],
  "list_public_projects": [],
  "get_public_project": [
    "p_slug"
  ],
  "list_public_conference_presentations": [],
  "list_public_teaching": [],
  "get_public_work_analytics": [
    "p_year"
  ]
} as const

export const CONTROLLED_VOCABULARIES = {
  "publication-index": [
    "WoS-SSCI",
    "Scopus",
    "WoS-ESCI",
    "Book chapter",
    "SciELO/Latindex",
    "Working paper",
    "Preprint"
  ],
  "paper-language": [
    "English",
    "Spanish",
    "Portuguese",
    "Dutch",
    "German",
    "French",
    "Italian"
  ],
  "project-role": [
    "Principal Investigator",
    "Research Associate",
    "Consultancy Chief",
    "Consultant"
  ],
  "project-status": [
    "active",
    "completed"
  ],
  "conference-presentation-type": [
    "Conference paper",
    "Keynote",
    "Workshop"
  ],
  "teaching-role": [
    "Course Convenor",
    "Lecturer",
    "Tutor",
    "Thesis Supervisor",
    "Examiner"
  ],
  "teaching-level": [
    "undergraduate",
    "master",
    "phd"
  ]
} as const

export const WORK_ANALYTICS_DAY_FIELDS = [
  "date",
  "net_minutes",
  "coffee_count"
] as const

export type AcademicApiRpcName = keyof typeof RPC_FIELDS
