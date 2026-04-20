import type { Timestamp } from 'firebase-admin/firestore'
import type { KeyStatus, CRStatus, UserRole, Platform, AuditAction, Locale } from '@hato-tms/shared'

// ============================================================
// Firestore Document Types (raw shapes stored in Firestore)
// These are NOT the same as DTOs in @hato-tms/shared.
// Converters in /collections/ handle the mapping.
// ============================================================

export interface FirestoreNamespace {
  path: string
  description: string | null
  platforms: Platform[]
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface FirestoreValueEntry {
  value: string
  version: number
  updatedById: string | null
  updatedByName: string | null
  updatedAt: Timestamp
}

export interface FirestoreTranslationKey {
  namespaceId: string
  namespacePath: string      // denormalized — avoids join on list queries
  keyName: string
  fullKey: string            // "{namespacePath}.{keyName}"
  description: string | null
  tags: string[]
  status: KeyStatus
  platforms: Platform[]
  values: Partial<Record<Locale, FirestoreValueEntry>>   // { TH: {...}, EN: {...} }
  createdById: string | null
  createdByName: string | null   // denormalized
  deletedAt: Timestamp | null    // soft delete — null = active
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface FirestoreReviewer {
  id: string
  name: string
  approved: boolean
}

export interface FirestoreCRItem {
  id: string
  keyId: string
  fullKey: string
  locale: Locale
  oldValue: string | null
  newValue: string
  comment: string | null
}

export interface FirestoreChangeRequest {
  title: string
  status: CRStatus
  authorId: string
  authorName: string         // denormalized
  reviewers: FirestoreReviewer[]
  items: FirestoreCRItem[]   // embedded — typically < 100 items
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface FirestoreUser {
  email: string
  name: string
  role: UserRole
  isActive: boolean
  apiToken: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface FirestoreAuditLog {
  action: AuditAction
  entityType: string
  entityId: string
  actorId: string
  actorName: string          // denormalized
  diff: Record<string, unknown> | null
  createdAt: Timestamp
}
