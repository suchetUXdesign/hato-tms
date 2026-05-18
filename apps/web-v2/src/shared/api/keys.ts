import type {
  TranslationKeyDTO,
  NamespaceDTO,
  SearchParams,
  PaginatedResponse,
  CreateKeyRequest,
  UpdateKeyRequest,
} from '@hato-tms/shared'
import { apiClient } from './client'

export interface KeyEditHistoryEntry {
  id: string
  action: string
  changedAt: string
  changedBy: string
  changedByEmail: string
  changes: { fieldPath: string; from: unknown; to: unknown }[]
}

export async function getKeys(params: SearchParams): Promise<PaginatedResponse<TranslationKeyDTO>> {
  const { data } = await apiClient.get('/keys', { params })
  return data
}

export async function getKey(id: string): Promise<TranslationKeyDTO> {
  const { data } = await apiClient.get(`/keys/${id}`)
  return data
}

export async function createKey(payload: CreateKeyRequest): Promise<TranslationKeyDTO> {
  const { data } = await apiClient.post('/keys', payload)
  return data
}

export async function updateKey(id: string, payload: UpdateKeyRequest): Promise<TranslationKeyDTO> {
  const { data } = await apiClient.patch(`/keys/${id}`, payload)
  return data
}

export async function saveKeyDetail(
  keyId: string,
  payload: { th?: string; en?: string; tags?: string[] },
): Promise<{ status: string; changes: { fieldPath: string; from: unknown; to: unknown }[] }> {
  const { data } = await apiClient.put(`/keys/${keyId}/save`, payload)
  return data
}

export async function getKeyHistory(keyId: string): Promise<KeyEditHistoryEntry[]> {
  const { data } = await apiClient.get(`/keys/${keyId}/history`)
  return data.history ?? []
}

export async function deleteKey(id: string): Promise<void> {
  await apiClient.delete(`/keys/${id}`)
}

export async function getNamespaces(): Promise<NamespaceDTO[]> {
  const { data } = await apiClient.get('/namespaces')
  return data.data ?? data
}
