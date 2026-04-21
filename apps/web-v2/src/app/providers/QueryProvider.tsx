import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

interface Props { children: React.ReactNode }

export function QueryProvider({ children }: Props) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 1000 * 60, retry: 1 },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
