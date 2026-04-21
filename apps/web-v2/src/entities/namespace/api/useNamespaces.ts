import { useQuery } from '@tanstack/react-query'
import type { NamespaceDTO } from '@hato-tms/shared'
import { apiClient } from '@/shared/api/client'

export function useNamespaces() {
  return useQuery({
    queryKey: ['namespaces'],
    queryFn: async () => {
      const { data } = await apiClient.get<NamespaceDTO[]>('/namespaces')
      return data
    },
  })
}
