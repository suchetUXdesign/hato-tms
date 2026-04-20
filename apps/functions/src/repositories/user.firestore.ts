import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { usersCol, toUserDTO } from '@hato-tms/firebase'
import type { IUserRepository, CreateUserInput, UpdateUserInput } from '@hato-tms/firebase'
import type { UserDTO } from '@hato-tms/shared'
import { AppError } from '../middleware/error'
import { randomBytes } from 'crypto'

export class FirestoreUserRepository implements IUserRepository {

  async findMany(): Promise<UserDTO[]> {
    const snap = await usersCol().orderBy('name').get()
    return snap.docs.map((d) => toUserDTO(d.id, d.data()))
  }

  async findById(uid: string): Promise<UserDTO | null> {
    const snap = await usersCol().doc(uid).get()
    if (!snap.exists) return null
    return toUserDTO(snap.id, snap.data()!)
  }

  async findByApiToken(token: string): Promise<UserDTO | null> {
    const snap = await usersCol().where('apiToken', '==', token).limit(1).get()
    if (snap.empty) return null
    return toUserDTO(snap.docs[0]!.id, snap.docs[0]!.data())
  }

  async create(data: CreateUserInput): Promise<UserDTO> {
    const now = Timestamp.now()
    const doc = {
      email: data.email, name: data.name, role: data.role,
      isActive: true, apiToken: null, createdAt: now, updatedAt: now,
    }
    await usersCol().doc(data.uid).set(doc)
    return toUserDTO(data.uid, doc as any)
  }

  async update(uid: string, data: UpdateUserInput): Promise<UserDTO> {
    const ref = usersCol().doc(uid)
    await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() })
    const snap = await ref.get()
    return toUserDTO(ref.id, snap.data()!)
  }

  async deactivate(uid: string): Promise<UserDTO> {
    return this.update(uid, { isActive: false })
  }

  async activate(uid: string): Promise<UserDTO> {
    return this.update(uid, { isActive: true })
  }

  async regenerateApiToken(uid: string): Promise<string> {
    const token = randomBytes(32).toString('hex')
    await usersCol().doc(uid).update({ apiToken: token, updatedAt: FieldValue.serverTimestamp() })
    return token
  }
}
