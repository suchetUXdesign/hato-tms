import { getFirestore, CollectionReference, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { AuditLogDTO } from '@hato-tms/shared'
import type { FirestoreAuditLog } from '../schema/firestore.types'

// ---- Converter ------------------------------------------------

export const auditLogConverter: FirestoreDataConverter<FirestoreAuditLog> = {
  toFirestore(data: FirestoreAuditLog): DocumentData {
    return data
  },
  fromFirestore(snap: QueryDocumentSnapshot): FirestoreAuditLog {
    return snap.data() as FirestoreAuditLog
  },
}

// ---- Collection ref -------------------------------------------

/**
 * Append-only — never delete audit logs.
 * Indexed by: entityType+entityId, actorId, createdAt (see firestore.indexes.json)
 */
export function auditLogsCol(): CollectionReference<FirestoreAuditLog> {
  return getFirestore()
    .collection('auditLogs')
    .withConverter(auditLogConverter)
}

// ---- DTO mapper -----------------------------------------------

export function toAuditLogDTO(id: string, doc: FirestoreAuditLog): AuditLogDTO {
  return {
    id,
    action:     doc.action,
    entityType: doc.entityType,
    entityId:   doc.entityId,
    actorId:    doc.actorId,
    actorName:  doc.actorName,
    timestamp:  doc.createdAt.toDate().toISOString(),
    diff:       doc.diff,
  }
}
