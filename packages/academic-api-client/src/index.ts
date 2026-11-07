export {
  CONTROLLED_VOCABULARIES,
  PUBLIC_RPC_VERSION,
  RPC_FIELDS,
  RPC_PARAMETERS,
  WORK_ANALYTICS_DAY_FIELDS,
} from './contract.generated.js'

export {
  createAcademicApiClient,
} from './client.js'

export type {
  AcademicApiClient,
  AcademicApiRpcResult,
  AcademicApiRpcTransport,
} from './client.js'

export {
  createFetchTransport,
} from './transport.js'

export type {
  AcademicApiFetchInit,
  AcademicApiFetchTransportOptions,
} from './transport.js'

export {
  filterCollectionPublications,
  filterExternalPublicationsByCollection,
  filterProjectPublications,
  sortPublicationsByDate,
} from './helpers.js'

export {
  AcademicApiValidationError,
  parsePublicAvailabilityList,
  parsePublicCalendarSettingsResponse,
  parsePublicConferenceList,
  parsePublicConferencePresentation,
  parsePublicPaperDetailResponse,
  parsePublicPaperList,
  parsePublicPaperMilestoneList,
  parsePublicPlanningAllocationList,
  parsePublicProjectDetailResponse,
  parsePublicProjectList,
  parsePublicCollectionPublicationList,
  parsePublicExternalPublicationList,
  parsePublicProjectPublicationList,
  parsePublicSoftwareDetailResponse,
  parsePublicSoftwareList,
  parsePublicTeachingList,
  parsePublicTeachingSettingsResponse,
  parsePublicWorkAnalytics,
} from './validation.js'

export type {
  ConferencePresentationType,
  PaperLanguage,
  PublicAvailabilityItem,
  PublicAvailabilityType,
  PublicCalendarSettings,
  ProjectRole,
  ProjectStatus,
  RepositoryVisibility,
  SoftwareCategory,
  SoftwareDevelopmentStage,
  SoftwareStatus,
  PublicConferencePresentation,
  PublicPaper,
  PublicPaperDetail,
  PublicPaperMilestone,
  PublicPlanningAllocation,
  PublicProject,
  PublicCollectionPublication,
  PublicExternalPublication,
  PublicProjectPublication,
  PublicSoftwareItem,
  PublicTeachingItem,
  PublicTeachingSettings,
  PublicWorkAnalytics,
  PublicWorkDay,
  PublicationAuthorship,
  PublicationIndex,
  TeachingLevel,
  TeachingRole,
} from './types.js'
