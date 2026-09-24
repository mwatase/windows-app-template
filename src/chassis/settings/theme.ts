import { useEffect, useSyncExternalStore } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { formatForLog, logger } from '../logging/logger'
import { chassisSettings, type ThemePreference } from './chassis-settings'
import { useSetting } from './settings'

export type ResolvedTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const systemPrefersDark = () => window.matchMedia(DARK_QUERY).matches

/** The theme currently in effect, following the OS when set to "system". */
export function useResolvedTheme(): ResolvedTheme {
  const [preference] = useSetting(chassisSettings, 'theme')
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark)
  return resolveTheme(preference, systemDark)
}

/**
 * Applies the theme to the page and to the native window frame, so the title
 * bar matches the content instead of staying light above a dark app.
 */
export function useThemeSync(): ResolvedTheme {
  const [preference] = useSetting(chassisSettings, 'theme')
  const resolved = useResolvedTheme()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  useEffect(() => {
    if (!isTauri()) return
    getCurrentWindow()
      .setTheme(preference === 'system' ? null : preference)
      .catch((error: unknown) => logger.warn(`could not theme the window frame: ${formatForLog(error)}`))
  }, [preference])

  return resolved
}
