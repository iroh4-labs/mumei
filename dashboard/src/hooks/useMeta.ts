import { useSuspenseQuery } from '@tanstack/react-query'
import type { Meta, MetaStats } from '@/types/meta'

export function useMeta(): { data: Meta } {
  const q = useSuspenseQuery({
    queryKey: ['meta'],
    queryFn: async (): Promise<Meta> => {
      const res = await fetch('/api/meta')
      if (!res.ok) throw new Error(`meta fetch failed: ${res.status}`)
      return (await res.json()) as Meta
    },
    staleTime: 60_000,
  })
  return { data: q.data }
}

export function useMetaStats(): { data: MetaStats } {
  const q = useSuspenseQuery({
    queryKey: ['meta', 'stats'],
    queryFn: async (): Promise<MetaStats> => {
      const res = await fetch('/api/meta/stats')
      if (!res.ok) throw new Error(`meta/stats fetch failed: ${res.status}`)
      return (await res.json()) as MetaStats
    },
    staleTime: 5_000,
  })
  return { data: q.data }
}
