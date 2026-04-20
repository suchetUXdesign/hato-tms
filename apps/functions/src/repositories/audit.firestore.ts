import { Timestamp } from 'firebase-admin/firestore'
import { auditLogsCol, toAuditLogDTO } from '@hato-tms/firebase'
import type { IAuditRepository, LogAuditInput } from '@hato-tms/firebase'
import type { AuditLogDTO } from '@hato-tms/shared'

export class FirestoreAuditRepository implements IAuditRepository {

  /** Never throws — failures are silently swallowed */
  async log(input: LogAuditInput): Promise<void> {
    try {
      await auditLogsCol().add({
        action:     input.action,
        entityType: input.entityType,
        entityId:   input.entityId,
        actorId:    input.actorId,
        actorName:  input.actorName,
        diff:       input.diff ?? null,
        createdAt:  Timestamp.now(),
      })
    } catch (e) {
      console.error('[audit] Failed to write audit log', e)
    }
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLogDTO[]> {
    const snap = await auditLogsCol()
      .where('entityType', '==', entityType)
      .where('entityId',   '==', entityId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    return snap.docs.map((d) => toAuditLogDTO(d.id, d.data()))
  }
}
