import { describe, expect, it } from 'vitest'

import { CommandFailure, GENERIC_ERROR_MESSAGE, UserFacingError, unwrap, userMessage } from './errors'

describe('unwrap', () => {
  it('returns the data of a successful command', async () => {
    await expect(unwrap(Promise.resolve({ status: 'ok' as const, data: 42 }))).resolves.toBe(42)
  })

  it('throws a CommandFailure carrying the stable code and the safe message', async () => {
    const failed = unwrap(
      Promise.resolve({
        status: 'error' as const,
        error: { code: 'not_found', message: 'That file or folder could not be found.' },
      }),
    )
    await expect(failed).rejects.toBeInstanceOf(CommandFailure)
    await expect(failed).rejects.toMatchObject({
      code: 'not_found',
      message: 'That file or folder could not be found.',
    })
  })
})

describe('userMessage', () => {
  it('shows the message of an error written for users', () => {
    expect(userMessage(new UserFacingError('The server is busy.', { detail: 'HTTP 503 from /api' }))).toBe(
      'The server is busy.',
    )
  })

  it('hides the message of any other error behind a generic sentence', () => {
    expect(userMessage(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      GENERIC_ERROR_MESSAGE,
    )
    expect(userMessage('a string')).toBe(GENERIC_ERROR_MESSAGE)
  })
})
