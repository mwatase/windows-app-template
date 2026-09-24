import { useCallback, useSyncExternalStore } from 'react'
import { LazyStore } from '@tauri-apps/plugin-store'

import { formatForLog, logger } from '../logging/logger'

/**
 * Typed, persisted settings.
 *
 * Every value lives in one store file (`settings.json` in the app's data
 * directory, shared with the native side) under a namespaced key such as
 * `chassis.theme` or `app.repository`. Groups are declared with their
 * defaults:
 *
 *   export const prefs = defineSettings('app', { units: 'metric', compact: false })
 *   const [compact, setCompact] = useSetting(prefs, 'compact')
 *
 * Values are loaded once at startup, so reads are synchronous afterwards. A
 * stored value of the wrong type (a hand-edited file, a setting whose type
 * changed between versions) falls back to the default instead of crashing
 * the view that reads it.
 */

export type SettingValue =
  | null
  | boolean
  | number
  | string
  | readonly SettingValue[]
  | { readonly [key: string]: SettingValue }

export type SettingsShape = Record<string, SettingValue>

type Validators<T> = {
  [K in keyof T]?: (value: unknown) => value is T[K]
}

/**
 * `{ compact: false }` would otherwise be typed as `{ compact: false }`, and
 * the setter would accept only `false`. Boolean defaults mean "a boolean".
 */
type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : T[K] }

export interface Settings<T extends object> {
  readonly namespace: string
  get<K extends keyof T & string>(key: K): T[K]
  set<K extends keyof T & string>(key: K, value: T[K]): Promise<void>
  /** The key as stored: `<namespace>.<key>`. */
  storageKey(key: keyof T & string): string
  /** A property, not a method, so it can be handed to useSyncExternalStore as is. */
  readonly subscribe: (listener: () => void) => () => void
}

/** Where settings are kept. The app uses the store file; tests use memory. */
export interface SettingsBackend {
  entries(): Promise<Array<[string, unknown]>>
  set(key: string, value: unknown): Promise<void>
}

export function storeBackend(file: string): SettingsBackend {
  const store = new LazyStore(file)
  return {
    entries: () => store.entries(),
    // Saved immediately rather than on a debounce: settings change rarely,
    // and a preference that silently reverts after a crash reads as a bug.
    set: async (key, value) => {
      await store.set(key, value)
      await store.save()
    },
  }
}

/** Settings that last as long as the page: for tests, and for previewing the
 * interface in a plain browser, where there is no store file to write. */
export function memoryBackend(initial: Record<string, unknown> = {}): SettingsBackend {
  const data = new Map(Object.entries(initial))
  return {
    entries: () => Promise.resolve([...data.entries()]),
    set: (key, value) => {
      data.set(key, value)
      return Promise.resolve()
    },
  }
}

/* ------------------------------------------------------------------ cache */

const values = new Map<string, unknown>()
const listeners = new Set<() => void>()
let backend: SettingsBackend | null = null

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Loads every stored value. Called once by the chassis before the first
 * render. Never throws: if the store cannot be read, the program starts with
 * defaults and says so in the log, because a settings problem must not stop
 * the app from opening.
 */
export async function loadSettings(source: SettingsBackend): Promise<void> {
  backend = source
  values.clear()
  try {
    for (const [key, value] of await source.entries()) values.set(key, value)
  } catch (error) {
    logger.error(`could not load settings, starting with defaults: ${formatForLog(error)}`)
  }
  notify()
}

/* ----------------------------------------------------------------- groups */

const namespaces = new Set<string>()

export function defineSettings<T extends SettingsShape>(
  namespace: string,
  defaults: T,
  validators: Validators<Widen<T>> = {},
): Settings<Widen<T>> {
  // Sound: every value of T is also a value of Widen<T>.
  return createGroup<Widen<T>>(namespace, defaults as Widen<T>, validators)
}

function createGroup<T extends object>(namespace: string, defaults: T, validators: Validators<T>): Settings<T> {
  // Two groups sharing a namespace would silently overwrite each other's keys.
  // Hot reload in `npm run dev` re-runs an edited module, which legitimately
  // redefines its group. Vitest also provides `import.meta.hot`, so test mode
  // is excluded explicitly: the check must still hold there.
  const hotReload = import.meta.hot !== undefined && import.meta.env.MODE !== 'test'
  if (namespaces.has(namespace) && !hotReload) {
    throw new Error(`defineSettings: the namespace "${namespace}" is already in use`)
  }
  namespaces.add(namespace)

  const storageKey = (key: keyof T & string) => `${namespace}.${key}`
  const reported = new Set<string>()

  function isValid<K extends keyof T & string>(key: K, value: unknown): value is T[K] {
    const validate = validators[key]
    return validate ? validate(value) : sameKind(value, defaults[key])
  }

  return {
    namespace,
    storageKey,

    get(key) {
      const stored = values.get(storageKey(key))
      if (stored === undefined) return defaults[key]
      if (isValid(key, stored)) return stored

      if (!reported.has(key)) {
        reported.add(key)
        logger.warn(`setting ${storageKey(key)} holds an invalid value, using the default: ${formatForLog(stored)}`)
      }
      return defaults[key]
    },

    async set(key, value) {
      const storedKey = storageKey(key)
      const had = values.has(storedKey)
      const previous = values.get(storedKey)

      // Optimistic: the control the user just moved updates immediately.
      values.set(storedKey, value)
      notify()

      if (!backend) throw new Error('settings were written before loadSettings() ran')
      try {
        await backend.set(storedKey, value)
      } catch (error) {
        if (had) values.set(storedKey, previous)
        else values.delete(storedKey)
        notify()
        throw error
      }
    },

    subscribe,
  }
}

/** A setting's current value and a setter, re-rendering when it changes. */
export function useSetting<T extends object, K extends keyof T & string>(
  settings: Settings<T>,
  key: K,
): [T[K], (value: T[K]) => Promise<void>] {
  const value = useSyncExternalStore(settings.subscribe, () => settings.get(key))
  const update = useCallback((next: T[K]) => settings.set(key, next), [settings, key])
  return [value, update]
}

function sameKind(value: unknown, reference: unknown): boolean {
  if (reference === null) return value === null
  if (Array.isArray(reference)) return Array.isArray(value)
  if (typeof reference === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  return typeof value === typeof reference
}

/** Test support: forget every loaded value and declared namespace. */
export function resetSettingsForTests(): void {
  values.clear()
  listeners.clear()
  namespaces.clear()
  backend = null
}
