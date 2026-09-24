import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CLOSE_TO_TRAY_KEY } from '../bindings'
import { chassisSettings } from './chassis-settings'
import {
  defineSettings,
  loadSettings,
  memoryBackend,
  resetSettingsForTests,
  useSetting,
  type SettingsBackend,
} from './settings'

beforeEach(() => {
  resetSettingsForTests()
  // Invalid values are reported through the logger, which is the console here.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('defineSettings', () => {
  it('reads defaults until something is stored', async () => {
    await loadSettings(memoryBackend())
    const prefs = defineSettings('test', { compact: false, units: 'metric' })
    expect(prefs.get('compact')).toBe(false)
    expect(prefs.get('units')).toBe('metric')
  })

  it('reads stored values under the namespaced key', async () => {
    await loadSettings(memoryBackend({ 'test.compact': true }))
    const prefs = defineSettings('test', { compact: false })
    expect(prefs.storageKey('compact')).toBe('test.compact')
    expect(prefs.get('compact')).toBe(true)
  })

  it('falls back to the default when the stored value has the wrong type, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await loadSettings(memoryBackend({ 'test.compact': 'yes please' }))
    const prefs = defineSettings('test', { compact: false })
    expect(prefs.get('compact')).toBe(false)
    expect(prefs.get('compact')).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('uses a validator when one is given', async () => {
    await loadSettings(memoryBackend({ 'test.size': 'enormous' }))
    const sizes = ['small', 'large'] as const
    type Size = (typeof sizes)[number]
    const defaults: { size: Size } = { size: 'small' }
    const prefs = defineSettings('test', defaults, {
      size: (value): value is Size => sizes.includes(value as Size),
    })
    expect(prefs.get('size')).toBe('small')
  })

  it('writes through to the backend and notifies subscribers', async () => {
    const backend = memoryBackend()
    await loadSettings(backend)
    const prefs = defineSettings('test', { compact: false })
    const listener = vi.fn()
    prefs.subscribe(listener)

    await prefs.set('compact', true)
    expect(prefs.get('compact')).toBe(true)
    expect(listener).toHaveBeenCalled()
    expect(await backend.entries()).toEqual([['test.compact', true]])
  })

  it('reverts the value when saving fails, so the UI does not lie', async () => {
    const failing: SettingsBackend = {
      entries: () => Promise.resolve([]),
      set: () => Promise.reject(new Error('disk full')),
    }
    await loadSettings(failing)
    const prefs = defineSettings('test', { compact: false })

    await expect(prefs.set('compact', true)).rejects.toThrow('disk full')
    expect(prefs.get('compact')).toBe(false)
  })

  it('starts with defaults when the store cannot be read', async () => {
    await loadSettings({ entries: () => Promise.reject(new Error('corrupt')), set: () => Promise.resolve() })
    const prefs = defineSettings('test', { compact: true })
    expect(prefs.get('compact')).toBe(true)
  })

  it('refuses a namespace that is already in use', () => {
    defineSettings('test', { a: 1 })
    expect(() => defineSettings('test', { b: 2 })).toThrow(/already in use/)
  })
})

describe('useSetting', () => {
  it('re-renders with the new value after a set', async () => {
    await loadSettings(memoryBackend())
    const prefs = defineSettings('test', { count: 1 })
    const { result } = renderHook(() => useSetting(prefs, 'count'))

    expect(result.current[0]).toBe(1)
    await act(() => result.current[1](2))
    expect(result.current[0]).toBe(2)
  })
})

describe('chassis settings', () => {
  it('stores closeToTray under the key the native side reads', () => {
    // src-tauri/src/chassis/settings.rs reads this key when the window is
    // closed. If the two ever disagree, "Keep running in the tray" silently
    // stops working, so the names are held together here.
    expect(chassisSettings.storageKey('closeToTray')).toBe(CLOSE_TO_TRAY_KEY)
  })
})
