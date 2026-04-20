import { getFirestore, CollectionReference, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { TranslationKeyDTO } from '@hato-tms/shared'
import type { FirestoreTranslationKey } from '../schema/firestore.types'
import { Locale } from '@hato-tms/shared'

// ---- Converter ------------------------------------------------

export const translationKeyConverter: FirestoreDataConverter<FirestoreTranslationKey> = {
  toFirestore(data: FirestoreTranslationKey): DocumentData {
    return data
  },
  fromFirestore(snap: QueryDocumentSnapshot): FirestoreTranslationKey {
    return snap.data() as FirestoreTranslationKey
  },
}

// ---- Collection ref -------------------------------------------

export function translationKeysCol(): CollectionReference<FirestoreTranslationKey> {
  return getFirestore()
    .collection('translationKeys')
    .withConverter(translationKeyConverter)
}

// ---- DTO mapper -----------------------------------------------

export function toTranslationKeyDTO(id: string, doc: FirestoreTranslationKey): TranslationKeyDTO {
  const sortedValues = Object.entries(doc.values ?? {}).map(([locale, entry]) => ({
    id:        `${id}_${locale}`,
    locale:    locale as Locale,
    value:     entry.value,
    version:   entry.version,
    updatedBy: entry.updatedByName,
    updatedAt: entry.updatedAt.toDate().toISOString(),
  }))

  return {
    id,
    namespaceId:   doc.namespaceId,
    namespacePath: doc.namespacePath,
    keyName:       doc.keyName,
    fullKey:       doc.fullKey,
    description:   doc.description,
    tags:          doc.tags,
    status:        doc.status,
    platforms:     doc.platforms,
    values:        sortedValues,
    createdBy:     doc.createdByName,
    createdAt:     doc.createdAt.toDate().toISOString(),
    updatedAt:     doc.updatedAt.toDate().toISOString(),
  }
}
