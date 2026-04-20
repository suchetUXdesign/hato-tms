import { getFirestore, CollectionReference, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { ChangeRequestDTO } from '@hato-tms/shared'
import type { FirestoreChangeRequest } from '../schema/firestore.types'

// ---- Converter ------------------------------------------------

export const changeRequestConverter: FirestoreDataConverter<FirestoreChangeRequest> = {
  toFirestore(data: FirestoreChangeRequest): DocumentData {
    return data
  },
  fromFirestore(snap: QueryDocumentSnapshot): FirestoreChangeRequest {
    return snap.data() as FirestoreChangeRequest
  },
}

// ---- Collection ref -------------------------------------------

export function changeRequestsCol(): CollectionReference<FirestoreChangeRequest> {
  return getFirestore()
    .collection('changeRequests')
    .withConverter(changeRequestConverter)
}

// ---- DTO mapper -----------------------------------------------

export function toChangeRequestDTO(id: string, doc: FirestoreChangeRequest): ChangeRequestDTO {
  return {
    id,
    title:       doc.title,
    status:      doc.status,
    authorId:    doc.authorId,
    authorName:  doc.authorName,
    reviewerIds: doc.reviewers.map((r) => r.id),
    items:       doc.items.map((item) => ({
      id:       item.id,
      keyId:    item.keyId,
      fullKey:  item.fullKey,
      locale:   item.locale,
      oldValue: item.oldValue,
      newValue: item.newValue,
      comment:  item.comment,
    })),
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  }
}
