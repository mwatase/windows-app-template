import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { UserFacingError } from '../errors/errors'

/**
 * HTTP for programs: every request has a timeout, transient failures are
 * retried with backoff, and every failure becomes an HttpError carrying a
 * sentence a customer can act on.
 *
 * Requests go through tauri-plugin-http, so they are made by the native side:
 * no CORS, and no reliance on the webview's network stack. Which hosts a
 * program may reach is decided in src-tauri/capabilities/app.json.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type HttpErrorKind = 'timeout' | 'network' | 'status' | 'cancelled' | 'invalid-response'

export class HttpError extends UserFacingError {
  override name = 'HttpError'
  readonly kind: HttpErrorKind
  /** The HTTP status, when the server answered. */
  readonly status: number | undefined

  constructor(
    kind: HttpErrorKind,
    message: string,
    options: { status?: number; detail?: string; cause?: unknown } = {},
  ) {
    super(message, options)
    this.kind = kind
    this.status = options.status
  }
}

export interface RequestOptions extends RequestInit {
  /** Abandon an attempt after this many milliseconds. Default 15 seconds. */
  timeoutMs?: number
  /**
   * Further attempts after the first fails with a network error, a timeout or
   * a retryable status. Defaults to 2 for methods that are safe to repeat
   * (GET, HEAD, OPTIONS, PUT, DELETE) and 0 for the rest, because retrying a
   * POST that reached the server can do the thing twice.
   */
  retries?: number
}

const DEFAULT_TIMEOUT_MS = 15_000
const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_RETRY_DELAY_MS = 30_000

export interface HttpClientDependencies {
  fetch: FetchLike
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export function createHttpClient({
  fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
}: HttpClientDependencies) {
  async function request(url: string, options: RequestOptions = {}): Promise<Response> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, retries, signal: callerSignal, ...init } = options
    const method = (init.method ?? 'GET').toUpperCase()
    const attempts = 1 + (retries ?? (IDEMPOTENT.has(method) ? 2 : 0))

    for (let attempt = 1; ; attempt += 1) {
      if (callerSignal?.aborted) throw cancelled(url)

      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      const forwardAbort = () => controller.abort()
      callerSignal?.addEventListener('abort', forwardAbort, { once: true })

      let response: Response
      try {
        response = await fetch(url, { ...init, method, signal: controller.signal })
      } catch (error) {
        if (callerSignal?.aborted) throw cancelled(url, error)
        if (attempt < attempts) {
          await sleep(backoff(attempt, random))
          continue
        }
        throw timedOut
          ? new HttpError('timeout', 'The server took too long to respond. Try again in a moment.', {
              detail: `${method} ${url} timed out after ${timeoutMs} ms (attempt ${attempt} of ${attempts})`,
              cause: error,
            })
          : new HttpError('network', 'Could not reach the server. Check your internet connection and try again.', {
              detail: `${method} ${url} failed before a response (attempt ${attempt} of ${attempts})`,
              cause: error,
            })
      } finally {
        clearTimeout(timer)
        callerSignal?.removeEventListener('abort', forwardAbort)
      }

      if (response.ok) return response

      if (RETRYABLE_STATUS.has(response.status) && attempt < attempts) {
        const delay = retryAfter(response) ?? backoff(attempt, random)
        // Release the unread body before trying again.
        await response.body?.cancel().catch(() => undefined)
        await sleep(delay)
        continue
      }

      throw new HttpError('status', messageForStatus(response.status), {
        status: response.status,
        detail: `${method} ${url} returned ${response.status} ${response.statusText} (attempt ${attempt} of ${attempts})`,
      })
    }
  }

  /** `request`, then the body parsed as JSON. The shape is the caller's to check. */
  async function requestJson(url: string, options?: RequestOptions): Promise<unknown> {
    const response = await request(url, options)
    try {
      return (await response.json()) as unknown
    } catch (error) {
      throw new HttpError('invalid-response', 'The server sent a response this app could not read.', {
        status: response.status,
        detail: `${url} did not return valid JSON`,
        cause: error,
      })
    }
  }

  return { request, requestJson }
}

/** Exponential backoff with jitter: about 0.5 s, 1 s, 2 s, ... */
function backoff(attempt: number, random: () => number): number {
  return Math.min(500 * 2 ** (attempt - 1) + Math.floor(random() * 250), MAX_RETRY_DELAY_MS)
}

/** Honours a server's Retry-After, in seconds or as an HTTP date, up to a cap. */
function retryAfter(response: Response): number | undefined {
  const header = response.headers.get('retry-after')
  if (!header) return undefined

  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now()
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_DELAY_MS) : undefined
}

function cancelled(url: string, cause?: unknown): HttpError {
  return new HttpError('cancelled', 'The request was cancelled.', { detail: `${url} was cancelled`, cause })
}

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'The server refused the request.'
  if (status === 404) return 'The server could not find what was asked for.'
  if (status === 429) return 'The server is receiving too many requests. Try again in a few minutes.'
  if (status >= 500) return 'The server is having problems. Try again in a few minutes.'
  return `The server rejected the request (error ${status}).`
}

export const { request, requestJson } = createHttpClient({ fetch: tauriFetch })
