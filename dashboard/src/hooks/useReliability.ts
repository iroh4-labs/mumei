import { useSuspenseQuery } from '@tanstack/react-query'
import type { ReliabilityFeatureRow, ReliabilityResponse } from '@/schemas/reliability-log'

export interface UseReliabilityArgs {
  includeArchive?: boolean
}

export function useReliability(args: UseReliabilityArgs = {}): {
  data: ReliabilityFeatureRow[]
} {
  const includeArchive = args.includeArchive ?? false
  const q = useSuspenseQuery({
    queryKey: ['reliability', { includeArchive }],
    queryFn: async (): Promise<ReliabilityResponse> => {
      const url = includeArchive ? '/api/reliability?include_archive=true' : '/api/reliability'
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`reliability fetch failed: ${res.status}`)
      }
      return (await res.json()) as ReliabilityResponse
    },
    staleTime: 5_000,
  })
  return { data: q.data.features }
}
