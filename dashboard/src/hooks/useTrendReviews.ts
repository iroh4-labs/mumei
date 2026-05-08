import { useSuspenseQuery } from '@tanstack/react-query'
import type { ReviewsTrend } from '@/types/trends'

export function useTrendReviews(days = 14): { data: ReviewsTrend } {
  const q = useSuspenseQuery({
    queryKey: ['trend', 'reviews', days],
    queryFn: async (): Promise<ReviewsTrend> => {
      const res = await fetch(`/api/trends/reviews?days=${days}`)
      if (!res.ok) throw new Error(`trend reviews fetch failed: ${res.status}`)
      return (await res.json()) as ReviewsTrend
    },
    staleTime: 60_000,
  })
  return { data: q.data }
}
