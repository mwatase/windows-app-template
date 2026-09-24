import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The interface build. Tauri runs `npm run dev:web` and `npm run build:web`
 * itself (see src-tauri/tauri.conf.json), so this file is rarely run by hand.
 *
 * Set by the Tauri CLI when it drives Vite: the host for a dev server a phone
 * or VM has to reach, and the platform being built for.
 */
const host = process.env.TAURI_DEV_HOST
const platform = process.env.TAURI_ENV_PLATFORM
const debug = Boolean(process.env.TAURI_ENV_DEBUG)

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  // Tauri prints Rust compiler errors to the same terminal. Clearing it would
  // wipe them before anyone reads them.
  clearScreen: false,

  server: {
    // Must match `build.devUrl` in tauri.conf.json. strictPort makes a port
    // clash an error instead of a silent move to a port Tauri is not watching.
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Cargo writes thousands of files under src-tauri/target during a build.
      ignored: ['**/src-tauri/**'],
    },
  },

  build: {
    /*
     * The webview, not "a browser". On Windows that is WebView2, which is
     * evergreen Chromium. On macOS it is the system WKWebView; Tailwind v4's
     * CSS needs Safari 16.4 or later, so Safari 16 is the floor.
     */
    target: platform === 'windows' ? 'chrome111' : 'safari16',
    minify: !debug,
    sourcemap: debug,
    rolldownOptions: {
      // Rolldown prints a plugin-timing report on every build that takes a
      // few seconds. It is not a problem to fix, and a build log that always
      // carries a warning teaches people to stop reading build logs.
      checks: { bundlerTimings: false },
    },
  },
})
