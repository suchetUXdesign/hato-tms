import type { AuditLogDTO, AuditAction } from '@hato-tms/shared'

export interface LogAuditInput {
  action: AuditAction
  entityType: string
  entityId: string
  actorId: string
  actorName: string
  diff?: Record<string, unknown>
}

/**
 * Database-agnostic interface for AuditLog operations.
 * Append-only — no update/delete methods.
 */
export interface IAuditRepository {
  /**
   * Write an audit log entry. Never throws — failures are silently caught
   * so they never break the main operation (same behaviour as existing codebase).
   */
  log(input: LogAuditInput): Promise<void>

  /** Query audit history for a specific entity */
  findByEntity(entityType: string, entityId: string): Promise<AuditLogDTO[]>
}
