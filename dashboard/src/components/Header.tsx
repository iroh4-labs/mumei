import { MoonIcon, SunIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { useMeta } from '@/hooks/useMeta'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

/**
 * Top of every page. Logo + project label on the left, live status + theme
 * toggle on the right. Stays inside a max-width hero strip so the content
 * sits centred on wide screens like a marketing page rather than a dashboard.
 */
export function Header({
  disconnected,
}: {
  connected: boolean
  disconnected: boolean
}): ReactElement {
  return (
    <header className="shrink-0">
      {disconnected && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-500/15 px-4 py-1.5 text-center font-mono text-xs text-rose-500"
        >
          Live updates disconnected — auto-reconnecting…
        </div>
      )}
      <div className="mx-auto flex h-[72px] w-full max-w-[1400px] items-center gap-4 px-5 sm:px-8">
        <BrandMark />
        <ProjectLabel />
        <div className="flex-1" />
        <ThemeToggle />
      </div>
    </header>
  )
}

function BrandMark(): ReactElement {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img
        src="/mumei-mascot.png"
        alt=""
        aria-hidden="true"
        className="size-9 shrink-0"
        style={{ imageRendering: 'pixelated' }}
      />
      <span className="font-mono text-[18px] font-semibold tracking-tight text-foreground">
        mumei
      </span>
    </div>
  )
}

function ProjectLabel(): ReactElement | null {
  const meta = useMeta().data
  if (!meta.projectLabel) return null
  return (
    <span className="hidden max-w-[40ch] truncate font-mono text-[14px] text-muted-foreground sm:inline">
      {meta.projectLabel}
    </span>
  )
}

function ThemeToggle(): ReactElement {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'mumei-glass relative inline-flex size-11 shrink-0 items-center justify-center rounded-full',
        'transition-transform duration-200 hover:scale-105 active:scale-95',
        'focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-0',
      )}
    >
      <SunIcon
        className={cn(
          'absolute size-5 text-amber-500 transition-all duration-300',
          isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
        )}
      />
      <MoonIcon
        className={cn(
          'absolute size-5 text-zinc-200 transition-all duration-300',
          isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0',
        )}
      />
    </button>
  )
}
