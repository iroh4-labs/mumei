import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dashboard } from './components/Dashboard'

/**
 * App root. Bento layout on top of a four-corner mesh gradient, with
 * Liquid Glass chips for titles and a side Sheet for feature detail.
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
