import { describe, expect, it } from 'vitest'

import { UserFacingError } from '@/chassis'

import { parseRelease } from './github'

describe('parseRelease (demo)', () => {
  it('reads the fields the card shows', () => {
    const release = parseRelease({
      tag_name: 'v2.11.6',
      name: 'tauri v2.11.6',
      html_url: 'https://github.com/tauri-apps/tauri/releases/tag/v2.11.6',
      published_at: '2026-09-21T12:00:00Z',
    })
    expect(release).toEqual({
      tag: 'v2.11.6',
      name: 'tauri v2.11.6',
      url: 'https://github.com/tauri-apps/tauri/releases/tag/v2.11.6',
      publishedAt: new Date('2026-09-21T12:00:00Z'),
    })
  })

  it('falls back to the tag for an unnamed release, and to null for a bad date', () => {
    const release = parseRelease({ tag_name: 'v1', name: '  ', html_url: 'https://x.test', published_at: 'soon' })
    expect(release.name).toBe('v1')
    expect(release.publishedAt).toBeNull()
  })

  it('rejects a payload that is not a release, with a message a user can read', () => {
    expect(() => parseRelease({ message: 'API rate limit exceeded' })).toThrow(UserFacingError)
    expect(() => parseRelease(null)).toThrow(/could not read/)
  })
})
