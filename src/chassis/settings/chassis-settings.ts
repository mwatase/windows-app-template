import { defineSettings } from './settings'

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

// A type alias rather than an interface: only aliases satisfy defineSettings'
// `Record<string, SettingValue>` constraint.
type ChassisSettings = {
  theme: ThemePreference
  checkForUpdates: boolean
  closeToTray: boolean
}

const defaults: ChassisSettings = {
  theme: 'system',
  checkForUpdates: true,
  closeToTray: false,
}

/**
 * The template's own settings. Stored as `chassis.<key>`.
 *
 * `closeToTray` is also read by the native side when the window is closed,
 * under the key exported to the bindings as CLOSE_TO_TRAY_KEY; a test holds
 * the two names together.
 */
export const chassisSettings = defineSettings('chassis', defaults, {
  theme: (value): value is ThemePreference => THEME_PREFERENCES.includes(value as ThemePreference),
})
