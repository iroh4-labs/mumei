import { CircleCheckIcon, CircleDotIcon, CircleIcon } from 'lucide-react'
import { type ReactElement, type ReactNode, Suspense, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDetail } from '@/hooks/useDetail'
import { type DocId, useDoc } from '@/hooks/useDoc'
import { truncate60 } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MumeiFeatureDetailPayload } from '@/types/feature-detail'
import { Markdown } from './Markdown'
import { VerdictBadge } from './primitives'

type WaveEntry = MumeiFeatureDetailPayload['waveplan'][number]
type AcEntry = MumeiFeatureDetailPayload['acs'][number]

interface DetailPanelProps {
  slug: string | null
}

type Tab = 'tasks' | 'docs' | 'reviews'

const TABS: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'docs', label: 'Documents' },
  { id: 'reviews', label: 'Reviews' },
]

const DOC_TABS: { id: DocId; label: string }[] = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'design', label: 'Design' },
  { id: 'tasks', label: 'Tasks.md' },
  { id: 'scratch', label: 'Scratch' },
]

/**
 * Renders the detail panel for the selected feature. Suspense-driven
 * loading; the parent wires its own ErrorBoundary fallback.
 */
export function DetailPanel({ slug }: DetailPanelProps): ReactElement {
  if (!slug) {
    return <DetailEmpty />
  }
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailContent slug={slug} />
    </Suspense>
  )
}

function DetailEmpty(): ReactElement {
  return (
    <div className="h-full flex items-center justify-center px-6 text-zinc-500">
      <p className="font-mono text-sm">Select a feature to see its detail.</p>
    </div>
  )
}

function DetailSkeleton(): ReactElement {
  return (
    <div className="h-full p-4 space-y-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function DetailContent({ slug }: { slug: string }): ReactElement {
  const detail = useDetail(slug).data
  return (
    <Tabs defaultValue="tasks" className="h-full flex flex-col gap-0">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[17px] text-zinc-100 truncate">{detail.slug}</div>
          <div className="font-mono text-[14px] text-zinc-500">
            {detail.planVehicle ? 'plan vehicle' : 'spec vehicle'}
          </div>
        </div>
      </header>
      <div className="border-b border-zinc-800 px-2 py-1.5 overflow-x-auto bg-zinc-900/50">
        <TabsList className="bg-transparent">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="font-mono text-xs cursor-pointer border border-transparent data-[state=active]:bg-zinc-800/60 data-[state=active]:text-zinc-100 data-[state=active]:border-zinc-700"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <TabsContent value="tasks">
          <TasksTab detail={detail} />
        </TabsContent>
        <TabsContent value="docs">
          <DocumentsTab slug={detail.slug} />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTab detail={detail} />
        </TabsContent>
      </div>
    </Tabs>
  )
}

function TasksTab({ detail }: { detail: MumeiFeatureDetailPayload }): ReactElement {
  const [openWave, setOpenWave] = useState<number | null>(null)
  if (detail.planVehicle) {
    return <Placeholder>no Wave plan (plan vehicle)</Placeholder>
  }
  if (detail.waveplan.length === 0) {
    return <Placeholder>No Waves recorded.</Placeholder>
  }
  // shimmer only while the spec is actively being implemented; once the
  // phase moves past `implement` (or the feature is archived) every Wave
  // renders as historical state.
  const liveImplement = !detail.archived && detail.phase === 'implement'
  // Archive walks lose per-task done flags (tasks.sh only queries
  // .mumei/specs/) — every Wave under archive parses with empty tasks
  // so allDone would be false by default. A spec only reaches `done` /
  // archive after every Wave is completed, so treat all of them as
  // done for visual consistency.
  const finishedAll = detail.archived === true || detail.phase === 'done'
  const activeWave = detail.waveplan.find((w) => w.wave === openWave) ?? null
  return (
    <>
      <ul className="space-y-2">
        {detail.waveplan.map((w) => {
          const totalTasks = w.tasks.length
          const doneTasks = w.tasks.filter((t) => t.done).length
          const allDone = totalTasks > 0 && doneTasks === totalTasks
          const isCurrent = liveImplement && detail.currentWave === w.wave
          const status: 'done' | 'running' | 'pending' = isCurrent
            ? 'running'
            : finishedAll || allDone
              ? 'done'
              : 'pending'
          return (
            <li
              key={w.wave}
              className={cn(
                'relative rounded border border-zinc-800/80',
                status === 'running' && 'border-zinc-700/80',
                status === 'pending' && 'opacity-70',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenWave(w.wave)}
                aria-current={status === 'running' ? 'step' : undefined}
                aria-haspopup="dialog"
                aria-label={`Wave ${w.wave} details`}
                className="relative z-10 flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[14px] cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded"
              >
                <WaveStatusIcon status={status} />
                {status === 'running' ? (
                  <span className="mumei-text-shimmer min-w-0 flex-1 truncate" title={w.goal}>
                    Wave {w.wave}
                    {w.goal && <>: {truncate60(w.goal)}</>}
                  </span>
                ) : (
                  <>
                    <span className="shrink-0 text-zinc-300">Wave {w.wave}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-400" title={w.goal}>
                      {truncate60(w.goal)}
                    </span>
                  </>
                )}
                {totalTasks > 0 && (
                  <span className="ml-auto shrink-0 tabular-nums text-zinc-500">
                    {doneTasks}/{totalTasks}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <Dialog open={activeWave !== null} onOpenChange={(o) => !o && setOpenWave(null)}>
        <DialogContent className="max-w-5xl border-zinc-700 bg-zinc-950 text-zinc-200 sm:max-w-5xl">
          {activeWave && <WaveDialogBody wave={activeWave} acs={detail.acs} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function WaveDialogBody({ wave, acs }: { wave: WaveEntry; acs: AcEntry[] }): ReactElement {
  const total = wave.tasks.length
  const done = wave.tasks.filter((t) => t.done).length
  // Related ACs: the union of every `reqs` entry under this Wave's
  // tasks, resolved against the spec's AC list. Preserves the order in
  // which ACs first appear in `acs` (= requirements.md order) so the
  // panel reads top-to-bottom against the spec.
  const reqIds = new Set<string>()
  for (const t of wave.tasks) for (const r of t.reqs) reqIds.add(r)
  const relatedAcs = acs.filter((a) => reqIds.has(a.id))
  return (
    <>
      <DialogHeader className="border-b border-zinc-800 pb-3">
        <DialogTitle className="flex items-center gap-2 font-mono text-[15px] text-zinc-100">
          <span>Wave {wave.wave}</span>
          {total > 0 && (
            <Badge
              variant="outline"
              className="border-zinc-700 bg-zinc-900/60 font-normal text-zinc-400 tabular-nums"
            >
              {done}/{total}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription className="sr-only">Wave {wave.wave} details</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        <section>
          <SectionLabel>Goal</SectionLabel>
          <div className="rounded border border-zinc-800/60 bg-zinc-900/40 p-3">
            <Markdown className="text-zinc-200">{wave.goal}</Markdown>
          </div>
        </section>
        {wave.verify && (
          <section>
            <SectionLabel>Verify</SectionLabel>
            <div className="rounded border border-zinc-800/60 bg-zinc-900/40 p-3">
              <Markdown className="text-zinc-200">{wave.verify}</Markdown>
            </div>
          </section>
        )}
        <section>
          <SectionLabel>
            Tasks{total > 0 && <span className="ml-2 normal-case text-zinc-600">({total})</span>}
          </SectionLabel>
          {wave.tasks.length > 0 ? (
            <ul className="space-y-2">
              {wave.tasks.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    'rounded border p-3',
                    t.done
                      ? 'border-zinc-800/60 bg-zinc-900/30'
                      : 'border-zinc-700/70 bg-zinc-900/50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {t.done ? (
                      <CircleCheckIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-stone-400"
                      />
                    ) : (
                      <CircleIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-zinc-500"
                      />
                    )}
                    <span className="mt-0.5 shrink-0 font-mono text-[12px] text-zinc-500 tabular-nums">
                      {t.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Markdown className={cn(t.done ? 'text-zinc-400' : 'text-zinc-100')}>
                        {t.description}
                      </Markdown>
                    </div>
                  </div>
                  {(t.files.length > 0 || t.depends.length > 0 || t.reqs.length > 0) && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-zinc-800/60 pt-2 font-mono text-[12px]">
                      {t.files.length > 0 && (
                        <>
                          <dt className="text-zinc-500">Files</dt>
                          <dd className="break-all text-zinc-300">
                            {t.files.map((f) => (
                              <code
                                key={f}
                                className="mr-1 inline-block rounded bg-zinc-800/70 px-1 text-zinc-200"
                              >
                                {f}
                              </code>
                            ))}
                          </dd>
                        </>
                      )}
                      {t.depends.length > 0 && (
                        <>
                          <dt className="text-zinc-500">Depends</dt>
                          <dd className="text-zinc-300 tabular-nums">{t.depends.join(', ')}</dd>
                        </>
                      )}
                      {t.reqs.length > 0 && (
                        <>
                          <dt className="text-zinc-500">Requirements</dt>
                          <dd className="text-zinc-300">{t.reqs.join(', ')}</dd>
                        </>
                      )}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded border border-dashed border-zinc-800 p-3 text-center font-mono text-[13px] text-zinc-500">
              No tasks recorded in this Wave.
            </p>
          )}
        </section>
        {relatedAcs.length > 0 && (
          <section>
            <SectionLabel>
              Related ACs
              <span className="ml-2 normal-case text-zinc-600">({relatedAcs.length})</span>
            </SectionLabel>
            <ul className="space-y-2">
              {relatedAcs.map((ac) => (
                <li key={ac.id} className="rounded border border-zinc-800/60 bg-zinc-900/30 p-3">
                  <div className="flex items-center gap-2 font-mono text-[13px]">
                    <span className="text-zinc-200">{ac.id}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-transparent text-[10px] tracking-wider uppercase text-zinc-50',
                        ac.confirmed ? 'bg-stone-600/70' : 'bg-amber-600/70',
                      )}
                    >
                      {ac.confirmed ? 'CONFIRMED' : 'ASSUMPTION'}
                    </Badge>
                  </div>
                  <div className="mt-1">
                    <Markdown className="text-zinc-300">{ac.body}</Markdown>
                  </div>
                  {(ac.examples ?? []).length > 0 && (
                    <ul className="mt-1.5 ml-4 list-disc space-y-0.5 font-mono text-[12px] text-zinc-400">
                      {(ac.examples ?? []).map((e) => (
                        <li key={`${ac.id}::${e}`}>{e}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
      {children}
    </h3>
  )
}

function WaveStatusIcon({ status }: { status: 'done' | 'running' | 'pending' }): ReactElement {
  const baseClass = 'size-4 shrink-0'
  if (status === 'done') {
    return <CircleCheckIcon aria-hidden="true" className={cn(baseClass, 'text-stone-400')} />
  }
  if (status === 'running') {
    return <CircleDotIcon aria-hidden="true" className={cn(baseClass, 'text-zinc-100')} />
  }
  return <CircleIcon aria-hidden="true" className={cn(baseClass, 'text-zinc-500')} />
}

function DocumentsTab({ slug }: { slug: string }): ReactElement {
  const [doc, setDoc] = useState<DocId>('requirements')
  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1 border-b border-zinc-800 pb-2" aria-label="Documents">
        {DOC_TABS.map((d) => {
          const active = d.id === doc
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDoc(d.id)}
              className={cn(
                'rounded border px-2 py-1 font-mono text-xs cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500',
                active
                  ? 'border-zinc-700 bg-zinc-800/60 text-zinc-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-900/50',
              )}
              aria-pressed={active}
            >
              {d.label}
            </button>
          )
        })}
      </nav>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <DocumentView slug={slug} doc={doc} />
      </Suspense>
    </div>
  )
}

function DocumentView({ slug, doc }: { slug: string; doc: DocId }): ReactElement {
  const body = useDoc(slug, doc).data
  if (body === null) {
    return (
      <Placeholder>
        No <code className="rounded bg-zinc-800/80 px-1 text-zinc-200">{doc}</code> document.
      </Placeholder>
    )
  }
  return (
    <div className="rounded border border-zinc-800/60 bg-zinc-900/40 p-4">
      <Markdown className="text-zinc-200">{body}</Markdown>
    </div>
  )
}

function ReviewsTab({ detail }: { detail: MumeiFeatureDetailPayload }): ReactElement {
  if (detail.reviews.length === 0) {
    return <Placeholder>No reviews yet.</Placeholder>
  }
  return (
    <ul className="space-y-3">
      {detail.reviews.map((r) => (
        <li key={`${r.ts}::${r.iteration}`} className="rounded border border-zinc-800/80 p-3">
          <div className="flex items-center gap-2 font-mono text-[14px]">
            <VerdictBadge verdict={r.verdict} iter={r.iteration} />
            <span className="text-zinc-500">· {r.ts.slice(0, 16)}</span>
            {r.wave !== undefined && <span className="text-zinc-500">· wave {r.wave}</span>}
          </div>
          {(r.findings ?? []).length > 0 && (
            <ul className="mt-2 space-y-1 text-[13px]">
              {(r.findings ?? []).map((f) => (
                <li
                  key={`${r.ts}::${f.id ?? ''}::${f.severity}::${f.message.slice(0, 16)}`}
                  className="font-mono text-zinc-300"
                >
                  <Badge
                    variant="outline"
                    className={
                      'mr-2 ' +
                      (f.severity === 'CRITICAL' || f.severity === 'HIGH'
                        ? 'border-rose-500/40 text-rose-300'
                        : f.severity === 'MEDIUM'
                          ? 'border-amber-500/40 text-amber-300'
                          : 'border-zinc-700 text-zinc-400')
                    }
                  >
                    {f.severity}
                  </Badge>
                  {f.message}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function Placeholder({ children }: { children: ReactNode }): ReactElement {
  return <div className="text-zinc-500 font-mono text-[14px] py-8 text-center">{children}</div>
}
