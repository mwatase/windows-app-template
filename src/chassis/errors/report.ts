import { toast } from '@/ui'

import { formatForLog, logger } from '../logging/logger'
import { userMessage } from './errors'

/**
 * Reports a failure the program can recover from: logs the full detail and
 * tells the user, in plain language, what did not happen.
 *
 * `title` says what failed ("Could not open the file"); the toast's second
 * line says why, from the error itself.
 */
export function reportError(error: unknown, title: string): void {
  logger.error(`${title}: ${formatForLog(error)}`)
  toast.error(title, { description: userMessage(error) })
}
