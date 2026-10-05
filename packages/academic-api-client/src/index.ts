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
  AcademicApiValidationError,
  parsePublicAvailabilityList,
  parsePublicCalendarSettingsResponse,
  parsePublicConferenceList,
  parsePublicConferencePresentation,
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
  PublicProject,
  PublicSoftwareItem,
  PublicTeachingItem,
  PublicTeachingSettings,
  PublicWorkAnalytics,
  PublicWorkDay,
  PublicationIndex,
  TeachingLevel,
  TeachingRole,
} from './types.js'
