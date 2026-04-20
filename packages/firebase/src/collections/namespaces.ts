import { getFirestore, CollectionReference, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { NamespaceDTO } from '@hato-tms/shared'
import type { FirestoreNamespace } from '../schema/firestore.types'

// ---- Converter ------------------------------------------------

export const namespaceConverter: FirestoreDataConverter<FirestoreNamespace> = {
  toFirestore(data: FirestoreNamespace): DocumentData {
    return data
  },
  fromFirestore(snap: QueryDocumentSnapshot): FirestoreNamespace {
    return snap.data() as FirestoreNamespace
  },
}

// ---- Collection ref -------------------------------------------

export function namespacesCol(): CollectionReference<FirestoreNamespace> {
  return getFirestore()
    .collection('namespaces')
    .withConverter(namespaceConverter)
}

// ---- DTO mapper -----------------------------------------------

export function toNamespaceDTO(id: string, doc: FirestoreNamespace): NamespaceDTO {
  return {
    id,
    path: doc.path,
    description: doc.description,
    platforms: doc.platforms,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  }
}
