import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * What every test file gets.
 *
 * 1. The browser APIs jsdom does not implement. Radix measures with
 *    ResizeObserver and the theme reads matchMedia, and both throw rather
 *    than degrade, so a missing one fails a test for an unrelated reason.
 * 2. Unmounting between tests. `globals: false` means Testing Library cannot
 *    register its own cleanup, so leaked DOM would make queries ambiguous.
 *
 * There is deliberately no @testing-library/jest-dom: `getBy*` queries throw
 * when an element is missing, which is already the assertion most tests need.
 *
 * Script tests run in the Node environment, where there is no window at all;
 * the browser block is skipped for them.
 */

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return []
  }
}

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        media: query,
        // Nothing matches: `prefers-color-scheme` resolves to light.
        matches: false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }

  const globals = globalThis as unknown as Record<string, unknown>
  globals.ResizeObserver ??= NoopObserver
  globals.IntersectionObserver ??= NoopObserver

  // Radix calls these when it moves focus into a menu or select.
  const element = Element.prototype as unknown as Record<string, unknown>
  element.scrollIntoView ??= () => {}
  element.hasPointerCapture ??= () => false
  element.setPointerCapture ??= () => {}
  element.releasePointerCapture ??= () => {}

  afterEach(() => {
    cleanup()
  })
}
