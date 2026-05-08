import { useSuspenseQuery } from '@tanstack/react-query'
import type { MumeiFeatureDetailPayload } from '@/types/feature-detail'

export function useDetail(slug: string): { data: MumeiFeatureDetailPayload } {
  const q = useSuspenseQuery({
    queryKey: ['feature', slug, 'detail'],
    queryFn: async (): Promise<MumeiFeatureDetailPayload> => {
      const res = await fetch(`/api/feature/${encodeURIComponent(slug)}/detail`)
      if (!res.ok) throw new Error(`detail fetch failed: ${res.status}`)
      return (await res.json()) as MumeiFeatureDetailPayload
    },
    staleTime: 5_000,
  })
  return { data: q.data }
}
