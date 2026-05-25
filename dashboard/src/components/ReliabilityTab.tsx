import { type ReactElement, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useReliability } from '@/hooks/useReliability'
import type { ReliabilityFeatureRow, ReliabilityLogEntry } from '@/schemas/reliability-log'

/**
 * Reliability tab — REQ-25.4.1 / .4.2.
 * Renders a per-feature aggregate table with pass^3, n_trials,
 * last_updated, and a 10-trial sparkline. Per-feature parse errors
 * (REQ-25.4.2) render as a "parse error" cell instead of crashing the
 * whole tab. Empty data renders an empty-state message.
 */
export function ReliabilityTab(): ReactElement {
  return (
    <Suspense fallback={<ReliabilityTabSkeleton />}>
      <ReliabilityTabContent />
    </Suspense>
  )
}

function ReliabilityTabContent(): ReactElement {
  const { data } = useReliability()
  if (data.length === 0) {
    return (
      <div
        className="px-3 py-6 text-center font-mono text-[13px] text-muted-foreground"
        aria-live="polite"
      >
        No reliability data yet. Run /mumei:proceed on a feature.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[13px]">
        <thead>
          <tr className="border-border border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
            <th className="px-3 py-2">feature</th>
            <th className="px-3 py-2">pass^3</th>
            <th className="px-3 py-2">n_trials</th>
            <th className="px-3 py-2">last_updated</th>
            <th className="px-3 py-2">recent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <ReliabilityRow
              // last_updated is unique per archived-month directory so
              // including it disambiguates same-slug rows that survive
              // across archive months (Gemini follow-up).
              key={`${row.vehicle}::${row.feature}::${row.last_updated ?? 'no-log'}`}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReliabilityRow({ row }: { row: ReliabilityFeatureRow }): ReactElement {
  if (row.error !== undefined) {
    return (
      <tr>
        <td className="px-3 py-2">{row.feature}</td>
        <td className="px-3 py-2 text-destructive" colSpan={4}>
          parse error
        </td>
      </tr>
    )
  }
  return (
    <tr>
      <td className="px-3 py-2">{row.feature}</td>
      <td className="px-3 py-2">{formatPassRate(row.pass_rate)}</td>
      <td className="px-3 py-2">{row.n_trials}</td>
      <td className="px-3 py-2 text-muted-foreground">{formatTs(row.last_updated)}</td>
      <td className="px-3 py-2">
        <Sparkline recent={row.recent} />
      </td>
    </tr>
  )
}

function formatPassRate(value: ReliabilityFeatureRow['pass_rate']): string {
  if (value === 'N/A') return 'N/A'
  return value.toFixed(2)
}

function formatTs(ts: string | null): string {
  if (ts === null) return '—'
  return ts.replace(/T/, ' ').replace(/Z$/, '')
}

/**
 * Minimal SVG sparkline — one bar per trial, height encodes pass (full)
 * vs fail (short). Empty recent[] renders a placeholder dash.
 */
function Sparkline({ recent }: { recent: ReliabilityLogEntry[] }): ReactElement {
  if (recent.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const W = 80
  const H = 16
  const barW = W / Math.max(recent.length, 1)
  return (
    <svg width={W} height={H} role="img" aria-label={`${recent.length} recent trials`}>
      {recent.map((trial, i) => {
        const x = i * barW
        const y = trial.pass ? 2 : H / 2
        const h = trial.pass ? H - 4 : H / 2 - 2
        return (
          <rect
            key={`${trial.wave}::${trial.task_id}::${trial.trial_n}::${trial.ts}`}
            x={x}
            y={y}
            width={Math.max(barW - 1, 1)}
            height={h}
            className={trial.pass ? 'fill-foreground/70' : 'fill-destructive/70'}
          />
        )
      })}
    </svg>
  )
}

function ReliabilityTabSkeleton(): ReactElement {
  const SKELETON_ROWS = ['a', 'b', 'c'] as const
  return (
    <div className="space-y-2">
      {SKELETON_ROWS.map((id) => (
        <Skeleton key={id} className="h-8 w-full" />
      ))}
    </div>
  )
}
