import { useSuspenseQuery } from '@tanstack/react-query'
import type { HooksTrend } from '@/types/trends'

export function useTrendHooks(topN = 10, windowH = 24): { data: HooksTrend } {
  const q = useSuspenseQuery({
    queryKey: ['trend', 'hooks', topN, windowH],
    queryFn: async (): Promise<HooksTrend> => {
      const res = await fetch(`/api/trends/hooks?topN=${topN}&windowH=${windowH}`)
      if (!res.ok) throw new Error(`trend hooks fetch failed: ${res.status}`)
      return (await res.json()) as HooksTrend
    },
    staleTime: 60_000,
  })
  return { data: q.data }
}
