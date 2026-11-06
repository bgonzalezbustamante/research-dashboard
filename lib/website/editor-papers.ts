import type { PaperWebsiteContent } from '@/lib/website/paper-content'

// Row shape returned by list_my_website_editor_papers() and
// get_website_editor_paper(p_paper_id).
export type WebsiteEditorPaper =
  PaperWebsiteContent & {
    paper_id: string
    short_title: string
    title: string
    abstract: string | null
    authors: string[]
    archived: boolean
    visibility: 'private' | 'public'
    slug: string | null
    featured: boolean
  }
