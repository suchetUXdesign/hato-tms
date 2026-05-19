import type { ChangeRequestDTO, UserDTO } from '@hato-tms/shared'
import { CRStatus } from '@hato-tms/shared'
import { apiClient } from './client'

export interface CreateCRPayload {
  title: string
  reviewerIds: string[]
  items: {
    keyId: string
    fullKey: string
    locale: 'TH' | 'EN'
    oldValue: string | null
    newValue: string
    comment?: string
  }[]
}

export interface ReviewCRPayload {
  action: 'approve' | 'reject' | 'request-changes'
  comment?: string
}

export async function getChangeRequests(status?: CRStatus): Promise<ChangeRequestDTO[]> {
  const { data } = await apiClient.get('/change-requests', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function getChangeRequest(id: string): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.get(`/change-requests/${id}`)
  return data
}

export async function createChangeRequest(payload: CreateCRPayload): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.post('/change-requests', payload)
  return data
}

export async function reviewChangeRequest(
  id: string,
  payload: ReviewCRPayload,
): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.put(`/change-requests/${id}/review`, payload)
  return data
}

export async function publishChangeRequest(id: string): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.put(`/change-requests/${id}/publish`, {})
  return data
}

export async function getUsers(): Promise<UserDTO[]> {
  const { data } = await apiClient.get('/auth/users')
  return data
}
