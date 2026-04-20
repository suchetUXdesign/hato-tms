import type { NamespaceDTO } from '@hato-tms/shared'
import type { Platform } from '@hato-tms/shared'

export interface CreateNamespaceInput {
  path: string
  description?: string
  platforms?: Platform[]
}

export interface UpdateNamespaceInput {
  path?: string
  description?: string
  platforms?: Platform[]
}

/**
 * Database-agnostic interface for Namespace operations.
 */
export interface INamespaceRepository {
  /** List all active namespaces with key counts */
  findMany(): Promise<(NamespaceDTO & { keyCount: number })[]>

  findById(id: string): Promise<NamespaceDTO | null>

  findByPath(path: string): Promise<NamespaceDTO | null>

  create(data: CreateNamespaceInput): Promise<NamespaceDTO>

  update(id: string, data: UpdateNamespaceInput): Promise<NamespaceDTO>
}
