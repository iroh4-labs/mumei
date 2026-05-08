import { useSuspenseQuery } from '@tanstack/react-query'
import type { MumeiFeatureSummary } from '@/types/feature-summary'

export function useFeatures(): { data: MumeiFeatureSummary[] } {
  const q = useSuspenseQuery({
    queryKey: ['features'],
    queryFn: async (): Promise<MumeiFeatureSummary[]> => {
      const res = await fetch('/api/features')
      if (!res.ok) throw new Error(`features fetch failed: ${res.status}`)
      return (await res.json()) as MumeiFeatureSummary[]
    },
    staleTime: 5_000,
  })
  return { data: q.data }
}
