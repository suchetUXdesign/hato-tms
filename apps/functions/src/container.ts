import type {
  IKeyRepository,
  INamespaceRepository,
  IChangeRequestRepository,
  IUserRepository,
  IAuditRepository,
} from '@hato-tms/firebase'

import { FirestoreKeyRepository }           from './repositories/key.firestore'
import { FirestoreNamespaceRepository }     from './repositories/namespace.firestore'
import { FirestoreChangeRequestRepository } from './repositories/changeRequest.firestore'
import { FirestoreUserRepository }          from './repositories/user.firestore'
import { FirestoreAuditRepository }         from './repositories/audit.firestore'

// ---- Simple DI container ----

const registry = new Map<string, unknown>()

export function bindRepositories(): void {
  const driver = process.env.DB_DRIVER ?? 'firestore'

  if (driver === 'firestore') {
    registry.set('KeyRepository',           new FirestoreKeyRepository())
    registry.set('NamespaceRepository',     new FirestoreNamespaceRepository())
    registry.set('ChangeRequestRepository', new FirestoreChangeRequestRepository())
    registry.set('UserRepository',          new FirestoreUserRepository())
    registry.set('AuditRepository',         new FirestoreAuditRepository())
  } else {
    // TODO: Swap to Prisma implementations when DB_DRIVER=sql
    // registry.set('KeyRepository', new PrismaKeyRepository())
    throw new Error(`DB_DRIVER "${driver}" is not yet implemented`)
  }
}

export function get<T>(token: string): T {
  const instance = registry.get(token)
  if (!instance) throw new Error(`[container] No binding found for "${token}"`)
  return instance as T
}

// Typed getters — avoids string token typos in route files
export const getKeyRepository           = (): IKeyRepository           => get('KeyRepository')
export const getNamespaceRepository     = (): INamespaceRepository     => get('NamespaceRepository')
export const getChangeRequestRepository = (): IChangeRequestRepository => get('ChangeRequestRepository')
export const getUserRepository          = (): IUserRepository          => get('UserRepository')
export const getAuditRepository         = (): IAuditRepository         => get('AuditRepository')
