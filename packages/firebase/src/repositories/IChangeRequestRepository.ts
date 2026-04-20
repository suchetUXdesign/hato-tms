import type { ChangeRequestDTO, CRStatus, Locale } from '@hato-tms/shared'

export interface CreateCRInput {
  title: string
  reviewerIds: string[]
  items: Array<{
    keyId: string
    fullKey: string
    locale: Locale
    oldValue: string | null
    newValue: string
    comment?: string
  }>
}

export interface ReviewCRInput {
  action: 'approve' | 'reject' | 'request-changes'
  comment?: string
}

/**
 * Database-agnostic interface for ChangeRequest operations.
 */
export interface IChangeRequestRepository {
  /** List CRs with optional status filter */
  findMany(filter?: { status?: CRStatus }): Promise<ChangeRequestDTO[]>

  findById(id: string): Promise<ChangeRequestDTO | null>

  create(data: CreateCRInput, authorId: string, authorName: string): Promise<ChangeRequestDTO>

  /**
   * Approve / reject.
   * Enforces: reviewer cannot be the author (checked in route layer).
   */
  review(id: string, reviewerId: string, input: ReviewCRInput): Promise<ChangeRequestDTO>

  /**
   * Apply all CR items to the live translation values.
   * Sets status = PUBLISHED atomically.
   */
  publish(id: string, actorId: string, actorName: string): Promise<ChangeRequestDTO>
}
