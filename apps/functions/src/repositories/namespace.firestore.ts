import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { namespacesCol, translationKeysCol, toNamespaceDTO } from '@hato-tms/firebase'
import type { INamespaceRepository, CreateNamespaceInput, UpdateNamespaceInput } from '@hato-tms/firebase'
import type { NamespaceDTO } from '@hato-tms/shared'
import { AppError } from '../middleware/error'

export class FirestoreNamespaceRepository implements INamespaceRepository {

  async findMany(): Promise<(NamespaceDTO & { keyCount: number })[]> {
    const [nsSnap, keysSnap] = await Promise.all([
      namespacesCol().where('isActive', '==', true).orderBy('path').get(),
      translationKeysCol().where('deletedAt', '==', null).select('namespaceId').get(),
    ])

    // Count keys per namespace
    const counts = new Map<string, number>()
    keysSnap.docs.forEach((d) => {
      const nsId = (d.data() as any).namespaceId as string
      counts.set(nsId, (counts.get(nsId) ?? 0) + 1)
    })

    return nsSnap.docs.map((d) => ({
      ...toNamespaceDTO(d.id, d.data()),
      keyCount: counts.get(d.id) ?? 0,
    }))
  }

  async findById(id: string): Promise<NamespaceDTO | null> {
    const snap = await namespacesCol().doc(id).get()
    if (!snap.exists) return null
    return toNamespaceDTO(snap.id, snap.data()!)
  }

  async findByPath(path: string): Promise<NamespaceDTO | null> {
    const snap = await namespacesCol().where('path', '==', path).limit(1).get()
    if (snap.empty) return null
    return toNamespaceDTO(snap.docs[0]!.id, snap.docs[0]!.data())
  }

  async create(data: CreateNamespaceInput): Promise<NamespaceDTO> {
    const existing = await this.findByPath(data.path)
    if (existing) throw new AppError(`Namespace "${data.path}" already exists`, 409)

    const now = Timestamp.now()
    const ref = await namespacesCol().add({
      path:        data.path,
      description: data.description ?? null,
      platforms:   data.platforms ?? [],
      isActive:    true,
      createdAt:   now,
      updatedAt:   now,
    })
    const snap = await ref.get()
    return toNamespaceDTO(ref.id, snap.data()!)
  }

  async update(id: string, data: UpdateNamespaceInput): Promise<NamespaceDTO> {
    const ref = namespacesCol().doc(id)

    // Check new path uniqueness
    if (data.path) {
      const existing = await this.findByPath(data.path)
      if (existing && existing.id !== id) {
        throw new AppError(`Namespace "${data.path}" already exists`, 409)
      }
    }

    await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() })
    const snap = await ref.get()
    return toNamespaceDTO(ref.id, snap.data()!)
  }
}
