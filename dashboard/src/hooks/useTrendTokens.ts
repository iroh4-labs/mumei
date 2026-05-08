import { useSuspenseQuery } from '@tanstack/react-query'
import type { TokensTrend } from '@/types/trends'

export function useTrendTokens(days = 14): { data: TokensTrend } {
  const q = useSuspenseQuery({
    queryKey: ['trend', 'tokens', days],
    queryFn: async (): Promise<TokensTrend> => {
      const res = await fetch(`/api/trends/tokens?days=${days}`)
      if (!res.ok) throw new Error(`trend tokens fetch failed: ${res.status}`)
      return (await res.json()) as TokensTrend
    },
    staleTime: 60_000,
  })
  return { data: q.data }
}
