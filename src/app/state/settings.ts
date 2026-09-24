import { defineSettings } from '@/chassis'

/** `owner/name`, as GitHub spells a repository. */
export const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/**
 * DEMO: the program's own settings, stored as `app.<key>` alongside the
 * chassis's. Edited on the Settings page (see views/WorkbenchSettings.tsx)
 * and read by the release card.
 */
export const workbenchSettings = defineSettings(
  'app',
  { repository: 'microsoft/vscode' },
  { repository: (value): value is string => typeof value === 'string' && REPOSITORY_PATTERN.test(value) },
)
