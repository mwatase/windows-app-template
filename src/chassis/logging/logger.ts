import { invoke, isTauri } from '@tauri-apps/api/core'
import * as pluginLog from '@tauri-apps/plugin-log'

/**
 * The interface's logger.
 *
 * Records go to the same rotating file as the native side's (see
 * src-tauri/src/chassis/logging.rs), so one file tells the whole story of a
 * failure: what the user clicked, what the command did, what went wrong.
 *
 * Outside the app, in unit tests or a plain browser, there is no file to
 * write to, so records go to the console instead.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

/** tauri-plugin-log's numeric levels. */
const LEVELS: Record<Level, number> = { debug: 2, info: 3, warn: 4, error: 5 }

function write(level: Level, message: string): void {
  if (!isTauri()) {
    console[level](message)
    return
  }
  // The plugin's own `info()` and friends tag each record with the caller's
  // location, found at a fixed depth in the stack. Behind this wrapper that is
  // always the wrapper itself, and in a release build a minified bundle
  // offset, so the command is invoked directly and the records are tagged
  // plainly as `webview`.
  invoke('plugin:log|log', { level: LEVELS[level], message }).catch(() => {
    // A logging failure must never become an error of its own.
    console[level](message)
  })
}

export const logger = {
  debug: (message: string) => write('debug', message),
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
}

/**
 * Renders any thrown value as text for the log: the stack for an Error, its
 * cause chain, and the technical detail a UserFacingError carries.
 */
export function formatForLog(value: unknown): string {
  if (value instanceof Error) {
    const head = value.stack ?? `${value.name}: ${value.message}`
    const code = 'code' in value && typeof value.code === 'string' ? `\ncode: ${value.code}` : ''
    const detail = 'detail' in value && typeof value.detail === 'string' ? `\ndetail: ${value.detail}` : ''
    const cause = value.cause === undefined ? '' : `\ncaused by: ${formatForLog(value.cause)}`
    return `${head}${code}${detail}${cause}`
  }
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * Sends errors nobody caught to the log. Without this, an exception in an
 * event handler or a rejected promise nobody awaited vanishes on a customer's
 * machine, and the one clue that would explain a bug report is gone.
 */
export function installGlobalErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) => {
    logger.error(`uncaught error: ${formatForLog(event.error ?? event.message)}`)
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    logger.error(`unhandled promise rejection: ${formatForLog(event.reason)}`)
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/** In `npm run dev`, mirrors the whole log, native side included, into devtools. */
export function attachDevConsole(): void {
  if (import.meta.env.DEV && isTauri()) {
    pluginLog.attachConsole().catch(() => {
      // Nothing to do: the records still reach the log file.
    })
  }
}
