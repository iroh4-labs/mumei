import { AlertCircleIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FeaturesFetchFailure } from '@/hooks/useFeatures'

interface ErrorBannerProps {
  /** Short, user-facing label, e.g. "features", "trend tokens". */
  name: string
  /** TanStack Query error or any thrown Error. */
  error: unknown
  /** TanStack Query refetch handle, fired by the Retry button. */
  onRetry: () => unknown
}

/**
 * Surfaces fetch failures inline above the affected section. Uses the
 * shadcn Alert (destructive variant) + Button (sm) so styling matches
 * the rest of the dashboard's design system rather than hand-rolled
 * Tailwind. Pair with an ErrorBoundary upstream. When a
 * `FeaturesFetchFailure` flows through (state.json shape violation),
 * the offending file and per-field diagnostics are surfaced so the
 * user can fix the underlying `.mumei/specs/<feature>/state.json`
 * without grepping the dashboard server's stderr.
 */
export function ErrorBanner({ name, error, onRetry }: ErrorBannerProps): ReactElement {
  const message = error instanceof Error ? error.message : 'unknown error'
  const structured = error instanceof FeaturesFetchFailure ? error.payload : null
  return (
    <Alert
      variant="destructive"
      className="m-2 border-red-700/60 bg-red-950/40 text-red-200 [&>svg]:text-red-400"
    >
      <AlertCircleIcon />
      <AlertTitle>Failed to load {name}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-red-300/80">{structured?.error ?? message}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void onRetry()
            }}
            className="border-red-600/60 text-red-100 hover:bg-red-900/50"
          >
            Retry
          </Button>
        </div>
        {structured?.file && (
          <p className="font-mono text-[12px] text-red-200/90 break-all">
            <span className="text-red-300/70">file: </span>
            {structured.file}
          </p>
        )}
        {structured?.fieldErrors && structured.fieldErrors.length > 0 && (
          <ul className="space-y-0.5 font-mono text-[12px] text-red-100/90">
            {structured.fieldErrors.map((fe) => (
              <li key={`${fe.path}::${fe.message}`} className="break-words">
                <code className="rounded bg-red-950/60 px-1 text-red-200">{fe.path || '/'}</code>{' '}
                <span className="text-red-200/80">{fe.message}</span>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
