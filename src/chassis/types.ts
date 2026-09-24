import type { ComponentType } from 'react'

/**
 * What a program hands the chassis. `src/app/index.ts` exports one of these
 * and `src/main.tsx` passes it to `bootstrap`; that is the only place the two
 * zones meet.
 */
export interface AppDefinition {
  /** Sidebar entries, in order. The first opens at launch. */
  views: readonly [AppView, ...AppView[]]
  /** The program's own section on the Settings page, if it has settings. */
  settings?: ComponentType
  /** Runs once before the first render, after settings have loaded. */
  init?: () => void | Promise<void>
}

export interface AppView {
  /** Stable and unique among the program's views. */
  id: string
  /** Sidebar label and page title. */
  label: string
  /** One line under the page title. */
  description?: string
  icon: ComponentType<{ className?: string }>
  component: ComponentType
}

/** Name and version of the running build, from tauri.conf.json. */
export interface AppIdentity {
  name: string
  version: string
}
