import type { CommandError } from '../bindings'

/**
 * An error whose message is safe, and meaningful, to show the person using
 * the program. Technical detail goes in `detail`, which is logged and never
 * displayed.
 *
 * Anything that is *not* a UserFacingError is shown as a generic sentence,
 * because a raw exception message ("Cannot read properties of undefined")
 * tells a customer nothing and a support engineer too little.
 */
export class UserFacingError extends Error {
  override name = 'UserFacingError'
  /** For the log only. */
  readonly detail: string | undefined

  constructor(message: string, options: { detail?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.detail = options.detail
  }
}

/** A native command that returned a CommandError. */
export class CommandFailure extends UserFacingError {
  override name = 'CommandFailure'
  /** The stable code from Rust: `not_found`, `demo.not_text`, and so on. */
  readonly code: string

  constructor(error: CommandError) {
    super(error.message)
    this.code = error.code
  }
}

type CommandResult<T> = { status: 'ok'; data: T } | { status: 'error'; error: CommandError }

/**
 * Awaits a generated command and returns its data, throwing a CommandFailure
 * if the command reported an error.
 *
 *   const summary = await unwrap(commands.inspectTextFile(path))
 *
 * Use it when a surrounding catch block is the natural place to handle
 * failure. When the caller wants to branch on the outcome instead, switch on
 * the result's `status` directly.
 */
export async function unwrap<T>(pending: Promise<CommandResult<T>>): Promise<T> {
  const result = await pending
  if (result.status === 'error') throw new CommandFailure(result.error)
  return result.data
}

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. The details have been written to the log.'

/** The sentence to show a user for any thrown value. */
export function userMessage(error: unknown): string {
  return error instanceof UserFacingError ? error.message : GENERIC_ERROR_MESSAGE
}
