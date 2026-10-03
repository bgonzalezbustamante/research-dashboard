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
  parsePublicConferenceList,
  parsePublicConferencePresentation,
  parsePublicPaperDetailResponse,
  parsePublicPaperList,
  parsePublicProjectDetailResponse,
  parsePublicProjectList,
  parsePublicTeachingList,
  parsePublicTeachingSettingsResponse,
  parsePublicWorkAnalytics,
} from './validation.js'

export type {
  ConferencePresentationType,
  PaperLanguage,
  PublicAvailabilityItem,
  PublicAvailabilityType,
  ProjectRole,
  ProjectStatus,
  PublicConferencePresentation,
  PublicPaper,
  PublicPaperDetail,
  PublicProject,
  PublicTeachingItem,
  PublicTeachingSettings,
  PublicWorkAnalytics,
  PublicWorkDay,
  PublicationIndex,
  TeachingLevel,
  TeachingRole,
} from './types.js'
