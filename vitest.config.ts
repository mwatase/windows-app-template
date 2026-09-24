import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * The interface unit suite.
 *
 * Deliberately small: it exists to prove the chassis still works after a
 * change, and every test in a template is inherited by every program built
 * from it. The bar for adding one is "a bug here would be silent and
 * expensive", not "this line is untested".
 *
 * Nothing here needs a running Tauri app. Calls that would cross into Rust
 * are answered by `mockIPC` from @tauri-apps/api/mocks — see tests/setup.ts.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // Explicit imports rather than globals: an `import { describe } from
    // 'vitest'` line tells a reader which runner the file belongs to.
    globals: false,

    // Tests live next to the module they cover. Script tests opt into the
    // Node environment with a `@vitest-environment node` comment.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],

    restoreMocks: true,
    clearMocks: true,
  },
})
