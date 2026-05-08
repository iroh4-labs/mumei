import { useSuspenseQuery } from '@tanstack/react-query'
import type { MumeiActivityEvent } from '@/types/activity-event'

export function useActivity(limit = 50): { data: MumeiActivityEvent[] } {
  const q = useSuspenseQuery({
    queryKey: ['activity', limit],
    queryFn: async (): Promise<MumeiActivityEvent[]> => {
      const res = await fetch(`/api/activity?limit=${limit}`)
      if (!res.ok) throw new Error(`activity fetch failed: ${res.status}`)
      return (await res.json()) as MumeiActivityEvent[]
    },
    staleTime: 5_000,
  })
  return { data: q.data }
}
