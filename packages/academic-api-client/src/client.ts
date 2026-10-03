import type {
  PublicConferencePresentation,
  PublicPaper,
  PublicPaperDetail,
  PublicProject,
  PublicTeachingItem,
  PublicWorkAnalytics,
} from './types.js'
import {
  parsePublicConferenceList,
  parsePublicPaperDetailResponse,
  parsePublicPaperList,
  parsePublicProjectDetailResponse,
  parsePublicProjectList,
  parsePublicTeachingList,
  parsePublicWorkAnalytics,
} from './validation.js'

export type AcademicApiRpcResult = {
  data: unknown
  error:
    | {
        message: string
      }
    | null
}

export type AcademicApiRpcTransport = {
  rpc(
    name: string,
    args?: Record<string, unknown>
  ): PromiseLike<AcademicApiRpcResult>
}

async function callRpc(
  transport: AcademicApiRpcTransport,
  name: string,
  args?: Record<string, unknown>
) {
  const result =
    await transport.rpc(
      name,
      args
    )

  if (result.error) {
    throw new Error(
      `${name} failed: ${result.error.message}`
    )
  }

  return result.data
}

function assertSlug(
  slug: string,
  label: string
) {
  if (
    typeof slug !== 'string' ||
    slug.trim().length === 0
  ) {
    throw new Error(
      `${label} must be a non-empty string.`
    )
  }
}

export type AcademicApiClient = {
  listPublicPapers(): Promise<
    PublicPaper[]
  >
  getPublicPaper(
    slug: string
  ): Promise<
    PublicPaperDetail | null
  >
  listPublicProjects(): Promise<
    PublicProject[]
  >
  getPublicProject(
    slug: string
  ): Promise<
    PublicProject | null
  >
  listPublicConferencePresentations(): Promise<
    PublicConferencePresentation[]
  >
  listPublicTeaching(): Promise<
    PublicTeachingItem[]
  >
  getPublicWorkAnalytics(
    year: number
  ): Promise<
    PublicWorkAnalytics
  >
}

export function createAcademicApiClient(
  transport: AcademicApiRpcTransport
): AcademicApiClient {
  return {
    async listPublicPapers() {
      return parsePublicPaperList(
        await callRpc(
          transport,
          'list_public_papers'
        )
      )
    },

    async getPublicPaper(
      slug
    ) {
      assertSlug(
        slug,
        'Paper slug'
      )

      return parsePublicPaperDetailResponse(
        await callRpc(
          transport,
          'get_public_paper',
          { p_slug: slug }
        )
      )
    },

    async listPublicProjects() {
      return parsePublicProjectList(
        await callRpc(
          transport,
          'list_public_projects'
        )
      )
    },

    async getPublicProject(
      slug
    ) {
      assertSlug(
        slug,
        'Project slug'
      )

      return parsePublicProjectDetailResponse(
        await callRpc(
          transport,
          'get_public_project',
          { p_slug: slug }
        )
      )
    },

    async listPublicConferencePresentations() {
      return parsePublicConferenceList(
        await callRpc(
          transport,
          'list_public_conference_presentations'
        )
      )
    },

    async listPublicTeaching() {
      return parsePublicTeachingList(
        await callRpc(
          transport,
          'list_public_teaching'
        )
      )
    },

    async getPublicWorkAnalytics(
      year
    ) {
      return parsePublicWorkAnalytics(
        await callRpc(
          transport,
          'get_public_work_analytics',
          { p_year: year }
        ),
        year
      )
    },
  }
}
