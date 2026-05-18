import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SearchParams, CreateKeyRequest } from '@hato-tms/shared'
import {
  getKeys,
  getKey,
  createKey,
  saveKeyDetail,
  deleteKey,
  getKeyHistory,
} from '@/shared/api/keys'

export function useKeys(params: SearchParams = {}) {
  return useQuery({
    queryKey: ['keys', params],
    queryFn: () => getKeys(params),
  })
}

export function useKey(id: string | null) {
  return useQuery({
    queryKey: ['key', id],
    queryFn: () => getKey(id!),
    enabled: !!id,
  })
}

export function useKeyHistory(id: string | null) {
  return useQuery({
    queryKey: ['key-history', id],
    queryFn: () => getKeyHistory(id!),
    enabled: !!id,
  })
}

export function useCreateKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateKeyRequest) => createKey(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] })
      qc.invalidateQueries({ queryKey: ['namespaces'] })
    },
  })
}

export function useSaveKey(keyId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { th?: string; en?: string; tags?: string[] }) =>
      saveKeyDetail(keyId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['key', keyId] })
      qc.invalidateQueries({ queryKey: ['key-history', keyId] })
      qc.invalidateQueries({ queryKey: ['keys'] })
    },
  })
}

export function useDeleteKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteKey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] })
    },
  })
}
