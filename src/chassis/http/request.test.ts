import { describe, expect, it, vi } from 'vitest'

import { createHttpClient, HttpError, type FetchLike } from './request'

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 })
const status = (code: number, headers: Record<string, string> = {}) => new Response('', { status: code, headers })

function client(fetch: FetchLike) {
  const sleep = vi.fn(() => Promise.resolve())
  return { ...createHttpClient({ fetch, sleep, random: () => 0 }), sleep }
}

async function failure(promise: Promise<unknown>): Promise<HttpError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  if (!(error instanceof HttpError)) throw new Error(`expected an HttpError, got ${String(error)}`)
  return error
}

describe('request', () => {
  it('returns a successful response from the first attempt', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(ok({ fine: true })))
    const { requestJson } = client(fetch)

    await expect(requestJson('https://example.test/a')).resolves.toEqual({ fine: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a network failure with backoff, then succeeds', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(ok())
    const { request, sleep } = client(fetch)

    const response = await request('https://example.test/a')
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(500)
  })

  it('gives up after the retries and says so in plain language', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.reject(new TypeError('offline')))
    const { request } = client(fetch)

    const error = await failure(request('https://example.test/a'))
    expect(error.kind).toBe('network')
    expect(error.message).toMatch(/internet connection/)
    expect(error.detail).toMatch(/attempt 3 of 3/)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('never retries a POST unless asked to, because it may already have happened', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.reject(new TypeError('offline')))
    const { request } = client(fetch)

    await failure(request('https://example.test/a', { method: 'POST' }))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a 503 and honours Retry-After', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(status(503, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(ok())
    const { request, sleep } = client(fetch)

    await request('https://example.test/a')
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it('does not retry a 404, and reports the status', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(status(404)))
    const { request } = client(fetch)

    const error = await failure(request('https://example.test/missing'))
    expect(error.kind).toBe('status')
    expect(error.status).toBe(404)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('times out an attempt that hangs', async () => {
    // A fetch that only settles when aborted, as plugin-http does.
    const fetch = vi.fn<FetchLike>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Request cancelled')))
        }),
    )
    const { request } = client(fetch)

    const error = await failure(request('https://example.test/slow', { timeoutMs: 10, retries: 0 }))
    expect(error.kind).toBe('timeout')
    expect(error.message).toMatch(/too long/)
  })

  it('stops at once when the caller cancels, without retrying', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(ok()))
    const { request } = client(fetch)

    const error = await failure(request('https://example.test/a', { signal: controller.signal }))
    expect(error.kind).toBe('cancelled')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a body that is not JSON as an unreadable response', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response('<html>', { status: 200 })))
    const { requestJson } = client(fetch)

    const error = await failure(requestJson('https://example.test/a'))
    expect(error.kind).toBe('invalid-response')
  })
})
