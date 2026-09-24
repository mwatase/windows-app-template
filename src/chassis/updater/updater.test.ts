import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createUpdater, type UpdateState } from './updater'

function fakeUpdate(install: (onEvent: (event: DownloadEvent) => void) => Promise<void>): Update {
  return {
    version: '1.1.0',
    currentVersion: '1.0.0',
    downloadAndInstall: vi.fn(install),
  } as unknown as Update
}

const downloadsCleanly = (onEvent: (event: DownloadEvent) => void) => {
  onEvent({ event: 'Started', data: { contentLength: 100 } })
  onEvent({ event: 'Progress', data: { chunkLength: 40 } })
  onEvent({ event: 'Progress', data: { chunkLength: 60 } })
  onEvent({ event: 'Finished' })
  return Promise.resolve()
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('updater', () => {
  it('reports the current version as current when there is no update', async () => {
    const updater = createUpdater({ check: () => Promise.resolve(null), relaunch: vi.fn() })
    await updater.checkNow({ userInitiated: true })
    expect(updater.getState()).toEqual({ status: 'current' })
  })

  it('downloads, installs and restarts, reporting progress on the way', async () => {
    const relaunch = vi.fn(() => Promise.resolve())
    const update = fakeUpdate(downloadsCleanly)
    const updater = createUpdater({ check: () => Promise.resolve(update), relaunch })
    const seen: UpdateState[] = []
    updater.subscribe(() => seen.push(updater.getState()))

    await updater.checkNow({ userInitiated: false })
    expect(updater.getState().status).toBe('available')

    await updater.install()
    expect(relaunch).toHaveBeenCalledTimes(1)
    const progress = seen.filter((state) => state.status === 'downloading')
    expect(progress.at(-1)).toMatchObject({ received: 100, total: 100 })
  })

  it('tells the user when a check they asked for fails', async () => {
    const updater = createUpdater({ check: () => Promise.reject(new Error('offline')), relaunch: vi.fn() })
    await updater.checkNow({ userInitiated: true })
    expect(updater.getState()).toMatchObject({ status: 'failed', update: null })
  })

  it('stays quiet when an automatic check fails', async () => {
    const updater = createUpdater({ check: () => Promise.reject(new Error('offline')), relaunch: vi.fn() })
    await updater.checkNow({ userInitiated: false })
    expect(updater.getState()).toEqual({ status: 'idle' })
  })

  it('keeps the update available to retry when installing fails, and does not restart', async () => {
    const relaunch = vi.fn()
    const update = fakeUpdate(() => Promise.reject(new Error('signature verification failed')))
    const updater = createUpdater({ check: () => Promise.resolve(update), relaunch })

    await updater.checkNow({ userInitiated: false })
    await updater.install()
    expect(updater.getState()).toMatchObject({ status: 'failed', update })
    expect(relaunch).not.toHaveBeenCalled()
  })
})
