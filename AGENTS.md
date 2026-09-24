# Working in this repository

A Windows desktop program built on the windows-app-template: Tauri 2 (Rust)
with a React 19 + TypeScript interface. These are the conventions that keep
every program built from the template consistent, and keep template
improvements mergeable into them. Read this before changing anything.

## The two zones

All code is either **chassis** (the template, shared by every program) or
**app** (this program). The boundary is what lets an improvement to the
template be merged into a program built months earlier without conflicts.

| Zone | Interface | Native (Rust) |
|---|---|---|
| **App**: edit freely | `src/app/` | `src-tauri/src/commands/`, `src-tauri/capabilities/app.json` |
| **Chassis**: rarely edited | `src/chassis/`, `src/ui/` | `src-tauri/src/chassis/`, `src-tauri/src/lib.rs`, `src-tauri/build.rs`, `src-tauri/capabilities/chassis.json` |

- `src/chassis/` and `src/ui/` **must never import from `src/app/`**. ESLint
  fails on it (see `eslint.config.js`). `src/ui/` must not import the
  chassis either: it is a presentational design system.
- `src/main.tsx` is the only place the zones meet: it hands `src/app`'s
  `AppDefinition` to the chassis.
- App code imports the chassis through `@/chassis` (its public surface,
  `src/chassis/index.ts`) and components through `@/ui`.
- If a change seems to need a chassis edit, it is either a chassis bug (fix it
  there; every program benefits) or a missing extension point (add one to
  `AppDefinition` or the chassis API). Never copy a chassis file into `app/`.

## Where things go

| To add | Put it in |
|---|---|
| A screen | a component in `src/app/views/`, listed in `src/app/index.ts` `views` |
| A feature's components and logic | `src/app/features/<feature>/` |
| A setting | `defineSettings('app', { ... })` in `src/app/state/`, read with `useSetting` |
| A section on the Settings page | a component set as `settings` in `src/app/index.ts` |
| Native work (files, OS APIs, heavy compute) | a command in `src-tauri/src/commands/`, registered in `commands/mod.rs` |
| A permission (plugin API, URL, file scope) | `src-tauri/capabilities/app.json` |
| A UI primitive | `npx shadcn@latest add <name>` (writes to `src/ui/`), then export it from `src/ui/index.ts` |

`docs/CUSTOMIZATION.md` walks through each of these with code.

## Rules that matter

- **Typed commands.** Every command is `#[tauri::command]` + `#[specta::specta]`,
  returns `Result<T, CommandError>`, and is listed in `collect_commands!`.
  After changing a signature run `npm run bindings`: it regenerates
  `src/app/bindings.ts` (and `src/chassis/bindings.ts`), which are committed.
  CI fails if they are stale. Never edit a `bindings.ts` by hand.
- **Errors.** Rust: `AppError::program("area.code", "message for the user",
  "detail for the log")`. The message is shown to customers: plain language,
  no paths, no OS error text. TypeScript: `await unwrap(commands.x())` throws a
  `CommandFailure`; show failures with `reportError(error, 'What failed')`,
  which logs the detail and shows a toast. Throw `UserFacingError` for
  failures whose message the user should see; any other error is shown as a
  generic sentence.
- **Logging.** `logger.info/warn/error` from `@/chassis`, `log::info!` etc. in
  Rust. Both go to the same rotating file. Never log secrets or file
  contents.
- **Least privilege.** Add the narrowest permission that works, to
  `capabilities/app.json`, one at a time. A command that takes a path checks
  it against the filesystem scope (`app.fs_scope().is_allowed(&path)`); see
  `src-tauri/src/commands/files.rs` in the template for the pattern.
- **HTTP** goes through `request` / `requestJson` from `@/chassis`: timeouts,
  retries and user-readable errors are handled there. The host must also be
  allowed in `capabilities/app.json` (`http:default` with an `allow` list).
- **No telemetry**, and nothing sent anywhere without the user asking for it.
- **Versions** are changed only with `npm run version:set -- x.y.z`, never
  by hand. `tauri.conf.json` is the source of truth.
- **Secrets** (signing keys, certificates, API credentials) never enter the
  repository. They live in GitHub Actions secrets. `.gitignore` blocks the
  usual file types; do not weaken it.

## Checks

Run `npm run verify` before committing. It is what CI runs: `tsc -b`, ESLint,
Vitest, `cargo fmt --check`, `cargo clippy -D warnings` and `cargo test`.

| Command | Does |
|---|---|
| `npm run dev` | The app, with hot reload |
| `npm run build` | Release build plus NSIS and MSI installers |
| `npm run verify` | Every check CI runs |
| `npm run bindings` | Regenerate the TypeScript bindings from Rust |
| `npm run version:set -- x.y.z` | Set the version everywhere |
| `npm run tauri icon app-icon.svg` | Regenerate every icon size |

Tests sit next to the code they cover (`*.test.ts(x)`). The suite is small
on purpose: add a test where a bug would be silent and expensive, not to
cover lines.

## Platform notes

- Development works on macOS and Windows; releases are built on Windows by
  GitHub Actions (`.github/workflows/release.yml`).
- The interface runs in WebView2 on Windows and WKWebView on macOS. Build
  targets are `chrome111` and `safari16` (see `vite.config.ts`).
- Use `import.meta.env.DEV` for behaviour that must differ in `npm run dev`.
