import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dashboard } from './components/Dashboard'

/**
 * App root. Tabbed single-card view (Features / Tokens / Activity) on a
 * four-corner mesh gradient; feature detail opens in a centred Dialog.
 * Design tokens (OKLCH palette, dark-mode binding, glass / blueprint
 * classes) live in src/index.css.
 */
export function App(): ReactElement {
  return (
    <TooltipProvider>
      <Dashboard />
    </TooltipProvider>
  )
}
