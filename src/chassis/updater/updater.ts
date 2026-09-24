import { useSyncExternalStore } from 'react'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

import { formatForLog, logger } from '../logging/logger'
import { chassisSettings } from '../settings/chassis-settings'

/**
 * Update checks and installs.
 *
 * The native plugin does the part that matters for safety: it downloads the
 * installer named in the release feed and refuses it unless its minisign
 * signature verifies against the public key in tauri.conf.json. An updater
 * that installs unverified payloads is a remote code execution channel into
 * every customer's machine, so there is no switch to turn that off.
 *
 * This module is the state machine the banner and the Settings page share.
 */

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'current' }
  | { status: 'available'; update: Update }
  | { status: 'downloading'; update: Update; received: number; total: number | null }
  | { status: 'failed'; message: string; update: Update | null }

export interface UpdaterDependencies {
  check: () => Promise<Update | null>
  relaunch: () => Promise<void>
}

const CHECK_TIMEOUT_MS = 30_000
/** Wait for startup to settle before the first automatic check. */
const FIRST_CHECK_DELAY_MS = 10_000
/** A program left open in the tray should still hear about updates. */
const RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000

export function createUpdater(dependencies: UpdaterDependencies) {
  let state: UpdateState = { status: 'idle' }
  const listeners = new Set<() => void>()

  function set(next: UpdateState): void {
    state = next
    for (const listener of listeners) listener()
  }

  /**
   * Looks for a newer release. A check the user asked for reports its
   * failure; an automatic one fails quietly into the log, because a
   * customer offline on a train should not be told about it every launch.
   */
  async function checkNow({ userInitiated }: { userInitiated: boolean }): Promise<void> {
    if (state.status === 'checking' || state.status === 'downloading') return
    set({ status: 'checking' })
    try {
      const update = await dependencies.check()
      if (update) {
        logger.info(`update available: ${update.currentVersion} -> ${update.version}`)
        set({ status: 'available', update })
      } else {
        set({ status: 'current' })
      }
    } catch (error) {
      logger.warn(`update check failed: ${formatForLog(error)}`)
      set(
        userInitiated
          ? {
              status: 'failed',
              message: 'Could not check for updates. Check your internet connection and try again.',
              update: null,
            }
          : { status: 'idle' },
      )
    }
  }

  /** Downloads, verifies and installs the available update, then restarts. */
  async function install(): Promise<void> {
    const update = state.status === 'available' || state.status === 'failed' ? state.update : null
    if (!update) return

    let received = 0
    let total: number | null = null
    let shownPercent = -1
    set({ status: 'downloading', update, received, total })

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? null
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength
        }
        // Progress arrives per network chunk; re-rendering on every one of
        // them is wasted work, so the state moves in whole percent.
        const percent = total ? Math.floor((received / total) * 100) : -1
        if (percent !== shownPercent || event.event !== 'Progress') {
          shownPercent = percent
          set({ status: 'downloading', update, received, total })
        }
      })
      logger.info(`update ${update.version} installed, restarting`)
      // On Windows the installer has already taken over and this process is
      // exiting. On macOS the new version is on disk; restart into it.
      await dependencies.relaunch()
    } catch (error) {
      logger.error(`update ${update.version} failed to install: ${formatForLog(error)}`)
      set({ status: 'failed', message: 'The update could not be installed. Try again later.', update })
    }
  }

  function dismiss(): void {
    if (state.status === 'available' || state.status === 'failed') set({ status: 'idle' })
  }

  /** Checks after startup and then twice a day, while the setting allows it. */
  function startAutomaticChecks(): () => void {
    const runIfEnabled = () => {
      if (chassisSettings.get('checkForUpdates')) void checkNow({ userInitiated: false })
    }
    const first = setTimeout(runIfEnabled, FIRST_CHECK_DELAY_MS)
    const repeat = setInterval(runIfEnabled, RECHECK_INTERVAL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(repeat)
    }
  }

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    checkNow,
    install,
    dismiss,
    startAutomaticChecks,
  }
}

export type Updater = ReturnType<typeof createUpdater>

export const updater = createUpdater({
  check: () => check({ timeout: CHECK_TIMEOUT_MS }),
  relaunch,
})

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(updater.subscribe, updater.getState)
}
