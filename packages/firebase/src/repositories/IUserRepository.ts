import type { UserDTO, UserRole } from '@hato-tms/shared'

export interface CreateUserInput {
  uid: string        // Firebase Auth UID
  email: string
  name: string
  role: UserRole
}

export interface UpdateUserInput {
  name?: string
  role?: UserRole
  isActive?: boolean
}

/**
 * Database-agnostic interface for User operations.
 * Document ID = Firebase Auth UID (direct lookup without query).
 */
export interface IUserRepository {
  findMany(): Promise<UserDTO[]>

  findById(uid: string): Promise<UserDTO | null>

  findByApiToken(token: string): Promise<UserDTO | null>

  /** Called on first login if user doc does not exist */
  create(data: CreateUserInput): Promise<UserDTO>

  update(uid: string, data: UpdateUserInput): Promise<UserDTO>

  /** Deactivate — sets isActive=false, never deletes */
  deactivate(uid: string): Promise<UserDTO>

  activate(uid: string): Promise<UserDTO>

  regenerateApiToken(uid: string): Promise<string>
}
