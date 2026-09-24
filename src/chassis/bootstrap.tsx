import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getName, getVersion } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'

import { SETTINGS_STORE_FILE } from './bindings'
import { ErrorBoundary } from './errors/ErrorBoundary'
import { attachDevConsole, formatForLog, installGlobalErrorHandlers, logger } from './logging/logger'
import { loadSettings, memoryBackend, storeBackend } from './settings/settings'
import { installDesktopBehaviour } from './shell/desktop'
import { Shell } from './shell/Shell'
import type { AppDefinition, AppIdentity } from './types'
import { updater } from './updater/updater'

/**
 * Starts the interface: error capture first, so nothing that fails during
 * startup goes unrecorded; then settings, so the first frame is already in
 * the user's chosen theme; then the program's own `init`; then React.
 */
export async function bootstrap(app: AppDefinition): Promise<void> {
  installGlobalErrorHandlers()
  installDesktopBehaviour()
  attachDevConsole()

  const container = document.getElementById('root')
  if (!container) throw new Error('index.html has no #root element')

  // Outside the app (a plain browser pointed at `npm run dev:web`) there is
  // no store; settings then last until the page is closed.
  await loadSettings(isTauri() ? storeBackend(SETTINGS_STORE_FILE) : memoryBackend())
  const identity = await readIdentity()

  try {
    await app.init?.()
  } catch (error) {
    // The program's own startup failing should not stop the window opening:
    // the shell, Settings and "Copy diagnostic info" still work.
    logger.error(`app init failed: ${formatForLog(error)}`)
  }

  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary area="shell">
        <Shell app={app} identity={identity} />
      </ErrorBoundary>
    </StrictMode>,
  )

  // Development builds are not released, so there is never an update for one.
  if (isTauri() && !import.meta.env.DEV) updater.startAutomaticChecks()

  logger.info(`interface ready: ${identity.name} ${identity.version}`)
}

async function readIdentity(): Promise<AppIdentity> {
  const fallback = { name: document.title, version: '0.0.0' }
  if (!isTauri()) return fallback
  try {
    const [name, version] = await Promise.all([getName(), getVersion()])
    return { name, version }
  } catch (error) {
    logger.warn(`could not read the app name and version: ${formatForLog(error)}`)
    return fallback
  }
}
