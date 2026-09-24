import { HttpError, UserFacingError, requestJson } from '@/chassis'

/** DEMO: the newest published release of a GitHub repository. */
export interface Release {
  tag: string
  name: string
  url: string
  publishedAt: Date | null
}

export async function fetchLatestRelease(repository: string): Promise<Release> {
  try {
    const data = await requestJson(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      timeoutMs: 10_000,
    })
    return parseRelease(data)
  } catch (error) {
    // The chassis's message for a 404 is generic; this layer knows what a
    // 404 means for this particular request, so it says so.
    if (error instanceof HttpError && error.status === 404) {
      throw new UserFacingError(`${repository} has no published releases, or does not exist.`, { cause: error })
    }
    throw error
  }
}

/**
 * Checks the shape of GitHub's reply rather than trusting it. `requestJson`
 * returns `unknown` on purpose: a server is outside the program's control,
 * and the place to find that out is here, not three components later.
 */
export function parseRelease(data: unknown): Release {
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const { tag_name: tag, name, html_url: url, published_at: published } = record

  if (typeof tag !== 'string' || typeof url !== 'string') {
    throw new UserFacingError('GitHub sent a release this app could not read.', {
      detail: `unexpected release payload: ${JSON.stringify(data)?.slice(0, 300)}`,
    })
  }

  const date = typeof published === 'string' ? new Date(published) : null
  return {
    tag,
    name: typeof name === 'string' && name.trim() !== '' ? name : tag,
    url,
    publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
  }
}
