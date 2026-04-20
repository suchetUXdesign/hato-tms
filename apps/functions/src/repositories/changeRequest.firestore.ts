import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { changeRequestsCol, translationKeysCol, auditLogsCol, toChangeRequestDTO } from '@hato-tms/firebase'
import type { IChangeRequestRepository, CreateCRInput, ReviewCRInput } from '@hato-tms/firebase'
import type { ChangeRequestDTO } from '@hato-tms/shared'
import { CRStatus, AuditAction, Locale, KeyStatus } from '@hato-tms/shared'
import { AppError } from '../middleware/error'
import { randomUUID } from 'crypto'

export class FirestoreChangeRequestRepository implements IChangeRequestRepository {

  async findMany(filter?: { status?: CRStatus }): Promise<ChangeRequestDTO[]> {
    let q: any = changeRequestsCol().orderBy('createdAt', 'desc')
    if (filter?.status) q = q.where('status', '==', filter.status)
    const snap = await q.get()
    return snap.docs.map((d: any) => toChangeRequestDTO(d.id, d.data()))
  }

  async findById(id: string): Promise<ChangeRequestDTO | null> {
    const snap = await changeRequestsCol().doc(id).get()
    if (!snap.exists) return null
    return toChangeRequestDTO(snap.id, snap.data()!)
  }

  async create(data: CreateCRInput, authorId: string, authorName: string): Promise<ChangeRequestDTO> {
    const db  = getFirestore()
    const now = Timestamp.now()

    const reviewerDocs = await Promise.all(
      data.reviewerIds.map((uid) => db.collection('users').doc(uid).get()),
    )
    const reviewers = reviewerDocs.map((s) => ({ id: s.id, name: s.data()?.name ?? s.id, approved: false }))
    const items     = data.items.map((item) => ({ ...item, id: randomUUID(), comment: item.comment ?? null }))

    const ref  = await changeRequestsCol().add({
      title: data.title, status: CRStatus.PENDING, authorId, authorName,
      reviewers, items, createdAt: now, updatedAt: now,
    })
    await this._audit(AuditAction.CR_CREATED, ref.id, authorId, authorName)
    const snap = await ref.get()
    return toChangeRequestDTO(ref.id, snap.data()!)
  }

  async review(id: string, reviewerId: string, input: ReviewCRInput): Promise<ChangeRequestDTO> {
    const ref = changeRequestsCol().doc(id)
    const snap = await ref.get()
    if (!snap.exists) throw new AppError('Change request not found', 404)

    const cr = snap.data()!
    if (cr.status !== CRStatus.PENDING) throw new AppError('Only PENDING CRs can be reviewed', 400)

    const updatedReviewers = cr.reviewers.map((r) =>
      r.id === reviewerId ? { ...r, approved: input.action === 'approve' } : r,
    )
    let newStatus = cr.status
    if (input.action === 'reject') {
      newStatus = CRStatus.REJECTED
    } else if (input.action === 'approve' && updatedReviewers.every((r) => r.approved)) {
      newStatus = CRStatus.APPROVED
    }

    await ref.update({ reviewers: updatedReviewers, status: newStatus, updatedAt: FieldValue.serverTimestamp() })
    const action = input.action === 'approve' ? AuditAction.CR_APPROVED : AuditAction.CR_REJECTED
    await this._audit(action, id, reviewerId, reviewerId)

    const updated = await ref.get()
    return toChangeRequestDTO(ref.id, updated.data()!)
  }

  async publish(id: string, actorId: string, actorName: string): Promise<ChangeRequestDTO> {
    const db    = getFirestore()
    const ref   = changeRequestsCol().doc(id)
    const snap  = await ref.get()
    if (!snap.exists) throw new AppError('Change request not found', 404)

    const cr = snap.data()!
    if (cr.status !== CRStatus.APPROVED) throw new AppError('Only APPROVED CRs can be published', 400)

    const batch = db.batch()
    const now   = Timestamp.now()

    for (const item of cr.items) {
      const keyRef  = translationKeysCol().doc(item.keyId)
      const keySnap = await keyRef.get()
      if (!keySnap.exists) continue

      const doc     = keySnap.data()!
      const locale  = item.locale as Locale
      const version = (doc.values?.[locale]?.version ?? 0) + 1
      const other   = locale === Locale.TH ? Locale.EN : Locale.TH
      const status  = item.newValue && doc.values?.[other]?.value ? KeyStatus.TRANSLATED : KeyStatus.PENDING

      batch.update(keyRef, {
        [`values.${locale}`]: { value: item.newValue, version, updatedById: actorId, updatedByName: actorName, updatedAt: now },
        status, updatedAt: FieldValue.serverTimestamp(),
      })
    }

    batch.update(ref, { status: CRStatus.PUBLISHED, updatedAt: FieldValue.serverTimestamp() })
    await batch.commit()
    await this._audit(AuditAction.CR_PUBLISHED, id, actorId, actorName)

    const updated = await ref.get()
    return toChangeRequestDTO(ref.id, updated.data()!)
  }

  private async _audit(action: AuditAction, entityId: string, actorId: string, actorName: string): Promise<void> {
    try {
      await auditLogsCol().add({ action, entityType: 'changeRequest', entityId, actorId, actorName, diff: null, createdAt: Timestamp.now() })
    } catch (e) { console.error('[audit] CR audit failed', e) }
  }
}
