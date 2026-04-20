import {
  getFirestore,
  FieldValue,
  Timestamp,
  Query,
} from 'firebase-admin/firestore'
import {
  translationKeysCol,
  auditLogsCol,
  toTranslationKeyDTO,
  toAuditLogDTO,
} from '@hato-tms/firebase'
import type { IKeyRepository } from '@hato-tms/firebase'
import type {
  TranslationKeyDTO,
  SearchParams,
  PaginatedResponse,
  CreateKeyRequest,
  UpdateKeyRequest,
  UpdateValueRequest,
  AuditLogDTO,
} from '@hato-tms/shared'
import { KeyStatus, Locale, AuditAction, buildFullKey } from '@hato-tms/shared'
import { AppError } from '../middleware/error'

export class FirestoreKeyRepository implements IKeyRepository {
  // ----------------------------------------------------------------
  async findMany(params: SearchParams): Promise<PaginatedResponse<TranslationKeyDTO>> {
    const db   = getFirestore()
    const col  = translationKeysCol()
    const page = params.page ?? 1
    const size = params.pageSize ?? 20

    // Build query — Firestore requires composite indexes for multi-field filters
    // Index file: firestore.indexes.json
    let q: Query = col.where('deletedAt', '==', null)

    if (params.status)    q = q.where('status',      '==', params.status)
    if (params.namespace) q = q.where('namespaceId', '==', params.namespace)
    if (params.platform)  q = q.where('platforms',   'array-contains', params.platform)

    // Sort
    const sortField = params.sortBy === 'key'     ? 'fullKey'
                    : params.sortBy === 'updated' ? 'updatedAt'
                    : 'createdAt'
    q = q.orderBy(sortField, params.sortOrder ?? 'desc')

    const snap  = await db.runTransaction(async (tx) => tx.get(q as any))
    let   docs  = snap.docs

    // Client-side text search (Firestore has no native full-text — use Algolia for prod)
    if (params.query) {
      const lower = params.query.toLowerCase()
      docs = docs.filter((d) => {
        const data = d.data() as any
        return (
          data.fullKey?.toLowerCase().includes(lower) ||
          data.values?.TH?.value?.toLowerCase().includes(lower) ||
          data.values?.EN?.value?.toLowerCase().includes(lower) ||
          data.tags?.some((t: string) => t.toLowerCase().includes(lower))
        )
      })
    }

    // Tag filter
    if (params.tags?.length) {
      docs = docs.filter((d) => {
        const data = d.data() as any
        return params.tags!.every((tag) => data.tags?.includes(tag))
      })
    }

    const total    = docs.length
    const pageDocs = docs.slice((page - 1) * size, page * size)
    const data     = pageDocs.map((d) => toTranslationKeyDTO(d.id, d.data() as any))

    return { data, total, page, pageSize: size, totalPages: Math.ceil(total / size) }
  }

  // ----------------------------------------------------------------
  async findById(id: string): Promise<TranslationKeyDTO | null> {
    const snap = await translationKeysCol().doc(id).get()
    if (!snap.exists || snap.data()?.deletedAt !== null) return null
    return toTranslationKeyDTO(snap.id, snap.data()!)
  }

  // ----------------------------------------------------------------
  async create(
    data: CreateKeyRequest,
    actorId: string,
    actorName: string,
  ): Promise<TranslationKeyDTO> {
    const db  = getFirestore()
    const col = translationKeysCol()
    const now = Timestamp.now()

    // Resolve namespaceId from path
    const nsSnap = await db
      .collection('namespaces')
      .where('path', '==', data.namespacePath)
      .limit(1)
      .get()
    if (nsSnap.empty) throw new AppError(`Namespace "${data.namespacePath}" not found`, 404)

    const nsId   = nsSnap.docs[0]!.id
    const fullKey = buildFullKey(data.namespacePath, data.keyName)

    // Unique constraint: [namespaceId, keyName]
    const docRef = await db.runTransaction(async (tx) => {
      const existing = await tx.get(
        col.where('namespaceId', '==', nsId).where('keyName', '==', data.keyName).limit(1) as any,
      )
      if (!existing.empty) {
        throw new AppError('A key with this name already exists in this namespace', 409)
      }

      const ref = col.doc()
      tx.set(ref, {
        namespaceId:   nsId,
        namespacePath: data.namespacePath,
        keyName:       data.keyName,
        fullKey,
        description:   data.description ?? null,
        tags:          data.tags ?? [],
        status:        KeyStatus.TRANSLATED,
        platforms:     data.platforms ?? [],
        values: {
          [Locale.TH]: { value: data.thValue, version: 1, updatedById: actorId, updatedByName: actorName, updatedAt: now },
          [Locale.EN]: { value: data.enValue, version: 1, updatedById: actorId, updatedByName: actorName, updatedAt: now },
        },
        createdById:   actorId,
        createdByName: actorName,
        deletedAt:     null,
        createdAt:     now,
        updatedAt:     now,
      })
      return ref
    })

    await this._audit({ action: AuditAction.KEY_CREATED, entityId: docRef.id, actorId, actorName })

    const created = await docRef.get()
    return toTranslationKeyDTO(docRef.id, created.data()!)
  }

  // ----------------------------------------------------------------
  async update(
    id: string,
    data: UpdateKeyRequest,
    actorId: string,
  ): Promise<TranslationKeyDTO> {
    const ref = translationKeysCol().doc(id)
    await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() })
    const updated = await ref.get()
    return toTranslationKeyDTO(ref.id, updated.data()!)
  }

  // ----------------------------------------------------------------
  async updateValue(
    id: string,
    data: UpdateValueRequest,
    actorId: string,
    actorName: string,
  ): Promise<TranslationKeyDTO> {
    const ref = translationKeysCol().doc(id)
    const now = Timestamp.now()

    const snap = await ref.get()
    if (!snap.exists) throw new AppError('Key not found', 404)

    const doc      = snap.data()!
    const existing = doc.values?.[data.locale]
    const version  = existing ? existing.version + 1 : 1

    // Append-only: write new entry into the values map
    const newEntry = { value: data.value, version, updatedById: actorId, updatedByName: actorName, updatedAt: now }

    // Recalculate status
    const otherLocale = data.locale === Locale.TH ? Locale.EN : Locale.TH
    const otherValue  = doc.values?.[otherLocale]?.value
    const status      = data.value && otherValue ? KeyStatus.TRANSLATED : KeyStatus.PENDING

    await ref.update({
      [`values.${data.locale}`]: newEntry,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    })

    await this._audit({ action: AuditAction.VALUE_UPDATED, entityId: id, actorId, actorName,
      diff: { locale: data.locale, oldValue: existing?.value ?? null, newValue: data.value } })

    const updated = await ref.get()
    return toTranslationKeyDTO(ref.id, updated.data()!)
  }

  // ----------------------------------------------------------------
  async softDelete(id: string): Promise<void> {
    await translationKeysCol().doc(id).update({
      deletedAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  // ----------------------------------------------------------------
  async bulkDelete(ids: string[]): Promise<void> {
    const db    = getFirestore()
    const batch = db.batch()
    const now   = Timestamp.now()
    ids.forEach((id) => {
      batch.update(translationKeysCol().doc(id), { deletedAt: now, updatedAt: FieldValue.serverTimestamp() })
    })
    await batch.commit()
  }

  // ----------------------------------------------------------------
  async bulkAddTags(ids: string[], tags: string[]): Promise<void> {
    const db    = getFirestore()
    const batch = db.batch()
    ids.forEach((id) => {
      batch.update(translationKeysCol().doc(id), {
        tags:      FieldValue.arrayUnion(...tags),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    await batch.commit()
  }

  // ----------------------------------------------------------------
  async bulkMove(ids: string[], namespaceId: string, namespacePath: string): Promise<void> {
    const db    = getFirestore()
    const batch = db.batch()
    ids.forEach((id) => {
      batch.update(translationKeysCol().doc(id), {
        namespaceId,
        namespacePath,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    await batch.commit()
  }

  // ----------------------------------------------------------------
  async findHistory(keyId: string): Promise<AuditLogDTO[]> {
    const snap = await auditLogsCol()
      .where('entityType', '==', 'translationKey')
      .where('entityId',   '==', keyId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    return snap.docs.map((d) => toAuditLogDTO(d.id, d.data()))
  }

  // ----------------------------------------------------------------
  private async _audit(input: {
    action: AuditAction; entityId: string; actorId: string; actorName: string; diff?: Record<string, unknown>
  }): Promise<void> {
    try {
      await auditLogsCol().add({
        action:     input.action,
        entityType: 'translationKey',
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
}
