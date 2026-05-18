import { useQuery } from '@tanstack/react-query'
import { getNamespaces } from '@/shared/api/keys'

export function useNamespaces() {
  return useQuery({
    queryKey: ['namespaces'],
    queryFn: getNamespaces,
  })
}
