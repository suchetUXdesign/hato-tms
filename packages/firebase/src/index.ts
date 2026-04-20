// ---- Firebase App ----
export { getFirebaseApp } from './app'

// ---- Firestore Document Types (raw) ----
export type {
  FirestoreNamespace,
  FirestoreTranslationKey,
  FirestoreValueEntry,
  FirestoreChangeRequest,
  FirestoreReviewer,
  FirestoreCRItem,
  FirestoreUser,
  FirestoreAuditLog,
} from './schema/firestore.types'

// ---- Collections ----
export { namespacesCol, toNamespaceDTO }       from './collections/namespaces'
export { translationKeysCol, toTranslationKeyDTO } from './collections/translationKeys'
export { changeRequestsCol, toChangeRequestDTO }   from './collections/changeRequests'
export { usersCol, toUserDTO }                 from './collections/users'
export { auditLogsCol, toAuditLogDTO }         from './collections/auditLogs'

// ---- Repository Interfaces ----
export type { IKeyRepository }            from './repositories/IKeyRepository'
export type { INamespaceRepository,
              CreateNamespaceInput,
              UpdateNamespaceInput }       from './repositories/INamespaceRepository'
export type { IChangeRequestRepository,
              CreateCRInput,
              ReviewCRInput }             from './repositories/IChangeRequestRepository'
export type { IUserRepository,
              CreateUserInput,
              UpdateUserInput }           from './repositories/IUserRepository'
export type { IAuditRepository,
              LogAuditInput }             from './repositories/IAuditRepository'
