import type {
  PublicAvailabilityItem,
  PublicCalendarSettings,
  PublicConferencePresentation,
  PublicPaper,
  PublicPaperDetail,
  PublicPaperMilestone,
  PublicExternalPublication,
  PublicCollectionPublication,
  PublicProjectPublication,
  PublicPlanningAllocation,
  PublicProject,
  PublicSoftwareItem,
  PublicLegacyDocument,
  PublicSignedDocument,
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
  parsePublicPaperMilestoneList,
  parsePublicExternalPublicationList,
  parsePublicCollectionPublicationList,
  parsePublicProjectPublicationList,
  parsePublicPlanningAllocationList,
  parsePublicProjectDetailResponse,
  parsePublicProjectList,
  parsePublicSoftwareDetailResponse,
  parsePublicSoftwareList,
  parsePublicLegacyDocumentResponse,
  parsePublicSignedDocumentResponse,
  parsePublicSignedDocumentBySha256Response,
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

function normaliseSha256(
  sha256: string
) {
  const value =
    typeof sha256 === 'string'
      ? sha256
          .trim()
          .toLowerCase()
      : ''

  if (
    !/^[0-9a-f]{64}$/.test(
      value
    )
  ) {
    throw new Error(
      'PDF SHA-256 must be 64 hexadecimal characters.'
    )
  }

  return value
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
  getPublicSignedDocument(
    code: string
  ): Promise<
    PublicSignedDocument | null
  >
  getPublicSignedDocumentBySha256(
    sha256: string
  ): Promise<
    PublicSignedDocument | null
  >
  getPublicLegacyDocument(
    slug: string
  ): Promise<
    PublicLegacyDocument | null
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
  listPublicProjectPublications(): Promise<
    PublicProjectPublication[]
  >
  listPublicExternalPublications(): Promise<
    PublicExternalPublication[]
  >
  listPublicCollectionPublications(): Promise<
    PublicCollectionPublication[]
  >
  listPublicPaperMilestones(): Promise<
    PublicPaperMilestone[]
  >
  listPublicPlanningAllocations(): Promise<
    PublicPlanningAllocation[]
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

    async getPublicSignedDocument(
      code
    ) {
      assertSlug(
        code,
        'Document code'
      )

      return parsePublicSignedDocumentResponse(
        await callRpc(
          transport,
          'get_public_signed_document',
          { p_code: code }
        )
      )
    },

    async getPublicSignedDocumentBySha256(
      sha256
    ) {
      const normalisedSha256 =
        normaliseSha256(
          sha256
        )

      const document =
        parsePublicSignedDocumentBySha256Response(
          await callRpc(
            transport,
            'get_public_signed_document_by_sha256',
            { p_sha256: normalisedSha256 }
          )
        )

      if (
        document &&
        document.sha256 !==
          normalisedSha256
      ) {
        throw new Error(
          'get_public_signed_document_by_sha256 returned a document for a different hash.'
        )
      }

      return document
    },

    async getPublicLegacyDocument(
      slug
    ) {
      assertSlug(
        slug,
        'Legacy document slug'
      )

      return parsePublicLegacyDocumentResponse(
        await callRpc(
          transport,
          'get_public_legacy_document',
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

    async listPublicProjectPublications() {
      return parsePublicProjectPublicationList(
        await callRpc(transport, 'list_public_project_publications')
      )
    },

    async listPublicExternalPublications() {
      return parsePublicExternalPublicationList(
        await callRpc(transport, 'list_public_external_publications')
      )
    },

    async listPublicCollectionPublications() {
      return parsePublicCollectionPublicationList(
        await callRpc(transport, 'list_public_collection_publications')
      )
    },

    async listPublicPaperMilestones() {
      return parsePublicPaperMilestoneList(
        await callRpc(transport, 'list_public_paper_milestones')
      )
    },

    async listPublicPlanningAllocations() {
      return parsePublicPlanningAllocationList(
        await callRpc(transport, 'list_public_planning_allocations')
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
