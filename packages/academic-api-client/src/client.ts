import type {
  PublicAvailabilityItem,
  PublicCalendarSettings,
  PublicConferencePresentation,
  PublicPaper,
  PublicPaperDetail,
  PublicProject,
  PublicSoftwareItem,
  PublicTeachingItem,
  PublicTeachingSettings,
  PublicWorkAnalytics,
} from './types.js'
import {
  parsePublicAvailabilityList,
  parsePublicCalendarSettingsResponse,
  parsePublicConferenceList,
  parsePublicPaperDetailResponse,
  parsePublicPaperList,
  parsePublicProjectDetailResponse,
  parsePublicProjectList,
  parsePublicSoftwareDetailResponse,
  parsePublicSoftwareList,
  parsePublicTeachingList,
  parsePublicTeachingSettingsResponse,
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
  listPublicSoftware(): Promise<
    PublicSoftwareItem[]
  >
  getPublicSoftware(
    slug: string
  ): Promise<
    PublicSoftwareItem | null
  >
  listPublicConferencePresentations(): Promise<
    PublicConferencePresentation[]
  >
  listPublicTeaching(): Promise<
    PublicTeachingItem[]
  >
  getPublicTeachingSettings(): Promise<
    PublicTeachingSettings
  >
  getPublicCalendarSettings(): Promise<
    PublicCalendarSettings
  >
  listPublicAvailability(
    year: number
  ): Promise<
    PublicAvailabilityItem[]
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

    async listPublicSoftware() {
      return parsePublicSoftwareList(
        await callRpc(
          transport,
          'list_public_software'
        )
      )
    },

    async getPublicSoftware(
      slug
    ) {
      assertSlug(
        slug,
        'Software slug'
      )

      return parsePublicSoftwareDetailResponse(
        await callRpc(
          transport,
          'get_public_software',
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

    async getPublicTeachingSettings() {
      return parsePublicTeachingSettingsResponse(
        await callRpc(
          transport,
          'get_public_teaching_settings'
        )
      )
    },

    async getPublicCalendarSettings() {
      return parsePublicCalendarSettingsResponse(
        await callRpc(
          transport,
          'get_public_calendar_settings'
        )
      )
    },

    async listPublicAvailability(
      year
    ) {
      return parsePublicAvailabilityList(
        await callRpc(
          transport,
          'list_public_availability',
          { p_year: year }
        ),
        year
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
