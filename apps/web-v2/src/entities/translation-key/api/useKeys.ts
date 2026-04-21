import { useQuery } from '@tanstack/react-query'
import type { PaginatedResponse, TranslationKeyDTO, SearchParams } from '@hato-tms/shared'
import { apiClient } from '@/shared/api/client'

export function useKeys(params: SearchParams = {}) {
  return useQuery({
    queryKey: ['keys', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<TranslationKeyDTO>>('/keys', { params })
      return data
    },
  })
}

export function useKey(id: string) {
  return useQuery({
    queryKey: ['keys', id],
    queryFn: async () => {
      const { data } = await apiClient.get<TranslationKeyDTO>(`/keys/${id}`)
      return data
    },
    enabled: !!id,
  })
}
