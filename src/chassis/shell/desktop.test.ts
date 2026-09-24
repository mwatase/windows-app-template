import { afterEach, describe, expect, it, vi } from 'vitest'

import { installDesktopBehaviour } from './desktop'

let uninstall: () => void = () => {}

afterEach(() => {
  uninstall()
  vi.unstubAllEnvs()
  document.body.innerHTML = ''
})

function dispatch(target: EventTarget, event: Event): boolean {
  target.dispatchEvent(event)
  return event.defaultPrevented
}

const contextMenu = () => new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })

describe('installDesktopBehaviour, in a release build', () => {
  it('suppresses the browser context menu, except in text fields', () => {
    vi.stubEnv('DEV', false)
    uninstall = installDesktopBehaviour()
    const panel = document.createElement('div')
    const field = document.createElement('input')
    document.body.append(panel, field)

    expect(dispatch(panel, contextMenu())).toBe(true)
    expect(dispatch(field, contextMenu())).toBe(false)
  })

  it('blocks reload and print shortcuts, and nothing else', () => {
    vi.stubEnv('DEV', false)
    uninstall = installDesktopBehaviour()

    expect(dispatch(document.body, key({ key: 'F5' }))).toBe(true)
    expect(dispatch(document.body, key({ key: 'r', ctrlKey: true }))).toBe(true)
    expect(dispatch(document.body, key({ key: 'p', ctrlKey: true }))).toBe(true)
    expect(dispatch(document.body, key({ key: 'r' }))).toBe(false)
    expect(dispatch(document.body, key({ key: 'c', ctrlKey: true }))).toBe(false)
  })
})

describe('installDesktopBehaviour, in development', () => {
  it('leaves the browser behaviour alone, for devtools and reloading', () => {
    vi.stubEnv('DEV', true)
    uninstall = installDesktopBehaviour()
    expect(dispatch(document.body, contextMenu())).toBe(false)
    expect(dispatch(document.body, key({ key: 'F5' }))).toBe(false)
  })
})
