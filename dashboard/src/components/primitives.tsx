import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Vehicle = 'spec' | 'plan'
type Verdict = 'PASS' | 'NEEDS_IMPROVEMENT' | 'MAJOR_ISSUES'
type Phase = 'plan' | 'implement' | 'review' | 'done'

const GLASS_CHIP =
  'mumei-glass inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-mono uppercase tracking-wider'

/**
 * Phase chip — Liquid Glass pill with a phase-specific accent dot.
 * Same dimensions as VerdictBadge so the two read as a single status pair.
 */
export function PhaseBadge({ phase }: { phase: Phase }): ReactElement {
  const map: Record<Phase, { dot: string; text: string }> = {
    plan: { dot: 'bg-zinc-400', text: 'text-foreground' },
    implement: { dot: 'bg-amber-400', text: 'text-foreground' },
    review: { dot: 'bg-violet-500', text: 'text-foreground' },
    done: { dot: 'bg-emerald-500', text: 'text-foreground' },
  }
  const c = map[phase]
  return (
    <span className={cn(GLASS_CHIP, 'gap-1.5', c.text)}>
      <span className={cn('size-1.5 rounded-full', c.dot)} aria-hidden="true" />
      {phase}
    </span>
  )
}

/**
 * Verdict chip — Liquid Glass pill with sage / ochre / terracotta accent.
 */
export function VerdictBadge({
  verdict,
  iter,
}: {
  verdict: Verdict | null
  iter?: number | null
}): ReactElement {
  if (!verdict) {
    return <span className={cn(GLASS_CHIP, 'text-muted-foreground')}>no review</span>
  }
  const map = {
    PASS: 'text-emerald-500',
    NEEDS_IMPROVEMENT: 'text-amber-500',
    MAJOR_ISSUES: 'text-rose-500',
  } as const
  const labelMap = {
    PASS: 'PASS',
    NEEDS_IMPROVEMENT: 'NEEDS WORK',
    MAJOR_ISSUES: 'BLOCKED',
  } as const
  return (
    <span className={cn(GLASS_CHIP, 'font-semibold', map[verdict])}>
      {labelMap[verdict]}
      {iter ? ` · iter ${iter}` : ''}
    </span>
  )
}

export function VehicleBadge({ vehicle }: { vehicle: Vehicle }): ReactElement {
  const map = {
    spec: { text: 'text-sky-500', dot: 'bg-sky-500' },
    plan: { text: 'text-violet-500', dot: 'bg-violet-500' },
  } as const
  const c = map[vehicle]
  return (
    <span className={cn(GLASS_CHIP, 'gap-1.5', c.text)}>
      <span className={cn('size-1.5 rounded-full', c.dot)} aria-hidden="true" />
      {vehicle}
    </span>
  )
}

export function PhaseTransition({
  phase,
  next,
}: {
  phase: string
  next: string | null
}): ReactElement {
  return (
    <div className="flex items-center gap-2 font-mono text-[14px]">
      <span className="text-muted-foreground">phase:</span>
      <span className="text-foreground">{phase}</span>
      {next && (
        <>
          <span className="text-muted-foreground">▶</span>
          <span className="text-muted-foreground">{next}</span>
        </>
      )}
    </div>
  )
}

export function FindingsPills({
  findings,
}: {
  findings: { high: number; med: number; low: number }
}): ReactElement {
  const pills = [
    { k: 'H', n: findings.high, color: 'text-rose-500' },
    { k: 'M', n: findings.med, color: 'text-amber-500' },
    { k: 'L', n: findings.low, color: 'text-muted-foreground' },
  ]
  return (
    <div className="flex items-center gap-1 font-mono text-[13px]">
      {pills.map((p) => (
        <span key={p.k} className={cn(GLASS_CHIP, 'gap-1', p.color)}>
          <span className="font-semibold">{p.k}</span>
          <span className="tabular-nums">{p.n}</span>
        </span>
      ))}
    </div>
  )
}

export function LivePulse({ connected = true }: { connected?: boolean }): ReactElement {
  return (
    <div
      className="inline-flex items-center gap-2 font-mono text-[13px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            connected ? 'bg-emerald-500' : 'bg-rose-500',
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            connected ? 'bg-emerald-500' : 'bg-rose-500',
          )}
          aria-hidden="true"
        />
      </span>
      <span>{connected ? 'Live' : 'Disconnected'}</span>
    </div>
  )
}

/**
 * Soft accent ring for cards tied to a fresh event. The pulse is a static
 * ring + a slow opacity breathe; the previous conic-gradient sweep has been
 * dropped in favour of a calmer, glass-friendly highlight.
 */
export function PulseRing({
  children,
  active,
  className,
}: {
  children: ReactNode
  active?: boolean
  className?: string
}): ReactElement {
  return (
    <div className={cn('relative', className)}>
      {children}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-violet-500/45 motion-safe:animate-pulse"
        />
      )}
    </div>
  )
}
