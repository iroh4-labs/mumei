import { type ReactElement, Suspense } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivity } from '@/hooks/useActivity'
import type { MumeiActivityEvent } from '@/types/activity-event'

/**
 * Live activity feed driven by `useActivity()` and SSE-prepended via
 * `useEventStream()`. Rows wrap to as many lines as needed — the original
 * truncate + hover-card combo was redundant once messages stayed short.
 */
export function ActivityFeed(): ReactElement {
  return (
    <Suspense fallback={<ActivityFeedSkeleton />}>
      <ActivityFeedContent />
    </Suspense>
  )
}

// Per-hook firings and per-subagent invocations are too noisy for an overview
// feed and are filtered at the UI layer — the schema still carries them so
// they can be re-enabled later without a server round-trip.
const HIDDEN_KINDS = new Set(['hook', 'subagent'])

function ActivityFeedContent(): ReactElement {
  const events = useActivity(50).data.filter((e) => !HIDDEN_KINDS.has(e.kind))
  if (events.length === 0) {
    return (
      <div className="px-3 py-4 font-mono text-[13px] text-muted-foreground">
        No recent activity.
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <ul aria-live="polite" className="divide-y divide-border">
        {events.map((e) => (
          <li key={activityKey(e)} className="px-3 py-2 font-mono text-[13px]">
            <ActivityRow event={e} />
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}

function activityKey(e: MumeiActivityEvent): string {
  switch (e.kind) {
    case 'commit':
      return `commit::${e.ts}::${e.ref}`
    case 'review':
      return `review::${e.ts}::${e.slug}::${e.iter}`
    case 'phase':
      return `phase::${e.ts}::${e.slug}::${e.from ?? 'null'}->${e.to}`
    case 'hook':
      return `hook::${e.ts}::${e.hook_id}::${e.decision}`
    case 'subagent':
      return `subagent::${e.ts}::${e.slug}::${e.agent}::${e.phase}`
    case 'task_progress':
      return `task::${e.ts}::${e.slug}::${e.task_id}`
    case 'archive':
      return `archive::${e.ts}::${e.slug}`
  }
}

interface RowParts {
  kindColor: string
  kind: string
  summary: string
  trailing?: string
}

function describeEvent(event: MumeiActivityEvent): RowParts {
  switch (event.kind) {
    case 'commit':
      return {
        kindColor: 'text-emerald-500',
        kind: 'commit',
        summary: event.message,
        trailing: event.ref.slice(0, 7),
      }
    case 'review':
      return {
        kindColor: 'text-violet-500',
        kind: 'review',
        summary: `${event.slug} · iter ${event.iter}`,
        trailing: event.verdict,
      }
    case 'phase': {
      const summary = event.from
        ? `${event.slug}: ${event.from} → ${event.to}`
        : `${event.slug}: → ${event.to}`
      return { kindColor: 'text-sky-500', kind: 'phase', summary }
    }
    case 'hook':
      return {
        kindColor: 'text-amber-500',
        kind: 'hook',
        summary: event.hook_id,
        trailing: event.decision,
      }
    case 'subagent': {
      const tokensFmt = event.tokens_total > 0 ? `${event.tokens_total.toLocaleString()} tk` : ''
      return {
        kindColor: 'text-rose-500',
        kind: 'subagent',
        summary: `${event.slug} · ${event.agent}`,
        trailing: tokensFmt || event.phase,
      }
    }
    case 'task_progress': {
      const wave = event.wave !== null ? `Wave ${event.wave} ` : ''
      return {
        kindColor: 'text-emerald-500',
        kind: 'task',
        summary: `${event.slug} · ${wave}task ${event.task_id} done`,
      }
    }
    case 'archive':
      return {
        kindColor: 'text-muted-foreground',
        kind: 'archive',
        summary: `${event.slug} → ${event.to}`,
      }
  }
}

function ActivityRow({ event }: { event: MumeiActivityEvent }): ReactElement {
  const ts = event.ts.slice(0, 16)
  const { kindColor, kind, summary, trailing } = describeEvent(event)
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 tabular-nums text-muted-foreground">{ts}</span>
      <span className={`shrink-0 ${kindColor}`}>{kind}</span>
      <span className="flex-1 break-words text-foreground">{summary}</span>
      {trailing && <span className="shrink-0 text-muted-foreground/70">{trailing}</span>}
    </div>
  )
}

function ActivityFeedSkeleton(): ReactElement {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }, (_, i) => i).map((i) => (
        <li key={i} className="px-3 py-2">
          <Skeleton className="h-4 w-full" />
        </li>
      ))}
    </ul>
  )
}
