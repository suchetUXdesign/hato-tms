import type {
  TranslationKeyDTO,
  SearchParams,
  PaginatedResponse,
  CreateKeyRequest,
  UpdateKeyRequest,
  UpdateValueRequest,
  AuditLogDTO,
} from '@hato-tms/shared'

/**
 * Database-agnostic interface for TranslationKey operations.
 * Implementations: FirestoreKeyRepository, PrismaKeyRepository (future SQL).
 */
export interface IKeyRepository {
  /** List + filter keys (paginated, excludes soft-deleted) */
  findMany(params: SearchParams): Promise<PaginatedResponse<TranslationKeyDTO>>

  /** Single key with full value history */
  findById(id: string): Promise<TranslationKeyDTO | null>

  /** Create key + initial TH/EN values atomically */
  create(data: CreateKeyRequest, actorId: string, actorName: string): Promise<TranslationKeyDTO>

  /** Update metadata (description, tags, platforms) */
  update(id: string, data: UpdateKeyRequest, actorId: string): Promise<TranslationKeyDTO>

  /**
   * Append a new version for a locale value (never mutates existing).
   * Auto-recalculates status: TRANSLATED | PENDING.
   */
  updateValue(id: string, data: UpdateValueRequest, actorId: string, actorName: string): Promise<TranslationKeyDTO>

  /** Soft delete — sets deletedAt, never removes document */
  softDelete(id: string): Promise<void>

  /** Bulk soft delete */
  bulkDelete(ids: string[]): Promise<void>

  /** Bulk add tags */
  bulkAddTags(ids: string[], tags: string[]): Promise<void>

  /** Bulk move to a different namespace */
  bulkMove(ids: string[], namespaceId: string, namespacePath: string): Promise<void>

  /** Audit history for a specific key */
  findHistory(keyId: string): Promise<AuditLogDTO[]>
}
