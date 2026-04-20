import { getFirestore, CollectionReference, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { UserDTO } from '@hato-tms/shared'
import type { FirestoreUser } from '../schema/firestore.types'

// ---- Converter ------------------------------------------------

export const userConverter: FirestoreDataConverter<FirestoreUser> = {
  toFirestore(data: FirestoreUser): DocumentData {
    return data
  },
  fromFirestore(snap: QueryDocumentSnapshot): FirestoreUser {
    return snap.data() as FirestoreUser
  },
}

// ---- Collection ref -------------------------------------------

/**
 * Document ID = Firebase Auth UID.
 * Created on first login via Firebase Auth trigger or /auth/me endpoint.
 */
export function usersCol(): CollectionReference<FirestoreUser> {
  return getFirestore()
    .collection('users')
    .withConverter(userConverter)
}

// ---- DTO mapper -----------------------------------------------

export function toUserDTO(id: string, doc: FirestoreUser): UserDTO {
  return {
    id,
    email:    doc.email,
    name:     doc.name,
    role:     doc.role,
    apiToken: doc.apiToken ?? undefined,
  }
}
