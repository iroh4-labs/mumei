import { useSuspenseQuery } from '@tanstack/react-query'

export type DocId = 'requirements' | 'design' | 'tasks' | 'scratch'

/**
 * Fetch one of the spec documents (requirements.md / design.md /
 * tasks.md) or the related brainstorm scratch for `slug`. Returns
 * `null` when the server responds 404 so the UI can render an empty
 * placeholder without throwing through the error boundary.
 */
export function useDoc(slug: string, doc: DocId): { data: string | null } {
  const q = useSuspenseQuery({
    queryKey: ['doc', slug, doc],
    queryFn: async (): Promise<string | null> => {
      const res = await fetch(`/api/feature/${encodeURIComponent(slug)}/${encodeURIComponent(doc)}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`doc fetch failed: ${res.status}`)
      return await res.text()
    },
    staleTime: 5_000,
  })
  return { data: q.data }
}
