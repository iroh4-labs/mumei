import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'mumei-theme'

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (private mode etc.) — fall through to media query
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

function applyTheme(t: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  root.style.colorScheme = t
}

export interface UseTheme {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

/**
 * Light/dark theme controller. State is mirrored to `<html class="dark">` for
 * Tailwind v4 class-strategy and persisted to localStorage. The initial paint
 * is set inline in index.html to avoid a flash before React mounts.
 */
export function useTheme(): UseTheme {
  const [theme, setThemeState] = useState<Theme>(readInitial)

  useEffect(() => {
    applyTheme(theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage failures
    }
  }, [theme])

  const setTheme = useCallback((t: Theme): void => setThemeState(t), [])
  const toggle = useCallback((): void => {
    setThemeState((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, setTheme, toggle }
}
