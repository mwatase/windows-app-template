/**
 * THE CHASSIS: the template's interface plumbing. Rarely touched per program.
 *
 * This file is its public surface. Program code in src/app/ imports from
 * `@/chassis` and from `@/ui`; the chassis never imports from src/app/, and
 * ESLint fails the build if it does (see eslint.config.js).
 */

export { bootstrap } from './bootstrap'
export type { AppDefinition, AppIdentity, AppView } from './types'
export { useAppIdentity } from './shell/identity'

export { formatForLog, logger } from './logging/logger'
export { reportError } from './errors/report'
export { CommandFailure, GENERIC_ERROR_MESSAGE, UserFacingError, unwrap, userMessage } from './errors/errors'

export { defineSettings, useSetting, type Settings, type SettingValue } from './settings/settings'
export { SettingsRow, SettingsSection } from './settings/SettingsLayout'

export { HttpError, request, requestJson, type HttpErrorKind, type RequestOptions } from './http/request'
