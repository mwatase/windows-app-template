import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/*
 * Imports the chassis may never make. Relative paths are covered as well as
 * the `@/` alias, because `../../app/views` reaches the same code.
 */
const APP_IMPORTS = [
  {
    group: ['@/app', '@/app/*'],
    message:
      'The chassis must not import from app/. app/ is the program being built; the chassis is shared by every program, and a dependency on one program would make it unmergeable into the others.',
  },
  {
    regex: '^(\\.\\./)+app(/.*)?$',
    message:
      'The chassis must not import from app/, not even by relative path. Pass what it needs in from src/main.tsx instead.',
  },
]

export default defineConfig([
  globalIgnores([
    'dist/**',
    'coverage/**',
    'src-tauri/**',
    // Generated from Rust by tauri-specta. Correctness is the Rust compiler's
    // job; style is not worth a lint failure in a file nobody edits.
    'src/**/bindings.ts',
  ]),

  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    // Type-aware rules catch what plain linting cannot: an unawaited promise
    // whose rejection vanishes, an async handler React will not wait for.
    // Both fail silently on a customer machine, which is the failure mode
    // this template exists to prevent.
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'scripts/starter/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  {
    // shadcn components export their variant helpers (`buttonVariants`) and
    // `toast` alongside the component, by design. Editing one then triggers a
    // full reload instead of a fast refresh, which is a fair price for keeping
    // the files in the shape the shadcn CLI writes and updates.
    files: ['src/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  {
    files: ['scripts/**/*.ts', '*.config.ts'],
    ignores: ['scripts/starter/**'],
    languageOptions: { globals: globals.node },
  },

  /*
   * THE CHASSIS BOUNDARY.
   *
   * chassis/ and ui/ may never import from app/. This is what lets an
   * improvement to the template merge into a program built from it months
   * earlier without colliding with that program's own code, because all of
   * that code lives in app/. A convention that is only written down gets
   * broken within a few programs, so it is a lint error.
   */
  {
    files: ['src/chassis/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: APP_IMPORTS }] },
  },

  /*
   * ui/ is the design system: presentational components with no knowledge of
   * Tauri, settings or logging. Keeping it below the chassis means a
   * component can be lifted into any React project unchanged.
   */
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...APP_IMPORTS,
            {
              group: ['@/chassis', '@/chassis/*'],
              message: 'ui/ must not import from chassis/. Pass state in as props.',
            },
            {
              regex: '^(\\.\\./)+chassis(/.*)?$',
              message: 'ui/ must not import from chassis/. Pass state in as props.',
            },
          ],
        },
      ],
    },
  },
])
