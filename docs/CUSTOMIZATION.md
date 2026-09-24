# Building a program on the template

A worked guide to the changes every program makes. Each section is the
smallest correct version of that change; the demo (before `npm run init`
removes it) has fuller examples of most of them.

Read [`AGENTS.md`](../AGENTS.md) first for the rules, and in particular the
zone boundary: program code lives in `src/app/`, `src-tauri/src/commands/` and
`src-tauri/capabilities/app.json`, and never requires editing the chassis.

---

## 1. Make it a program

```bash
npm install
npm run init
npm run dev
```

`npm run init` asks for the program's identity and writes it everywhere it is
needed. The **identifier** (`com.acme.invoicestudio`) is the one answer that
is hard to change later: it names the program's data folder, its notification
identity and its update channel, so changing it after release strands every
installed copy's settings.

Then replace `app-icon.svg` with the program's icon (a square SVG or a
1024x1024 PNG with transparency) and regenerate every size:

```bash
npm run tauri icon app-icon.svg
```

The colours are the tokens at the top of `src/index.css`. Components only ever
use the semantic names (`bg-primary`, `text-muted-foreground`), so changing
`--primary` rebrands the whole program.

---

## 2. Add a view

A view is a component plus an entry in `src/app/index.ts`. The first view opens
at launch; Settings is always added at the bottom of the sidebar.

```tsx
// src/app/views/InvoicesView.tsx
export function InvoicesView() {
  return <div className="mx-auto max-w-4xl px-8 py-6">…</div>
}
```

```ts
// src/app/index.ts
import { ReceiptIcon } from 'lucide-react'
import { InvoicesView } from './views/InvoicesView'

export const app: AppDefinition = {
  views: [
    { id: 'invoices', label: 'Invoices', description: 'Drafts and sent invoices.', icon: ReceiptIcon, component: InvoicesView },
  ],
}
```

Views stay mounted once visited, so switching away and back keeps their state.
Each view has its own error boundary: if it crashes, the user sees a recovery
screen for that view and everything else keeps working.

Icons come from [lucide](https://lucide.dev/icons). Components come from
`@/ui`; add more shadcn/ui components with `npx shadcn@latest add <name>` and
export them from `src/ui/index.ts`.

---

## 3. Add a setting

Settings are typed, have defaults, and persist in the app's data folder.

```ts
// src/app/state/settings.ts
import { defineSettings } from '@/chassis'

type Units = 'metric' | 'imperial'
const defaults: { units: Units; compactRows: boolean } = { units: 'metric', compactRows: false }

export const prefs = defineSettings('app', defaults, {
  // Optional: a validator for values a type check cannot express.
  units: (value): value is Units => value === 'metric' || value === 'imperial',
})
```

```tsx
const [compact, setCompact] = useSetting(prefs, 'compactRows')
<Switch checked={compact} onCheckedChange={(next) => void setCompact(next)} />
```

A stored value of the wrong type (a hand-edited file, a type that changed
between versions) falls back to the default instead of crashing the view. Use
a type alias, not an interface, for the defaults' type.

To give the program a section on the Settings page, build it from
`SettingsSection` and `SettingsRow` (exported by `@/chassis`) and set it as
`settings` in `src/app/index.ts`. The template's demo section is in
`src/app/views/WorkbenchSettings.tsx` in the template repository.

The native side can read a setting too, with
`chassis::settings::read_bool(app, "app.compactRows", false)`.

---

## 4. Add a native command

Anything the webview must not do itself (filesystem work, OS APIs, heavy
computation) is a Rust command.

```rust
// src-tauri/src/commands/invoices.rs
use crate::chassis::error::{AppError, CommandError};

#[derive(serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceTotal {
    pub net_cents: u64,
    pub tax_cents: u64,
}

#[tauri::command]
#[specta::specta]
pub async fn total_invoice(lines: Vec<u64>, tax_rate: f64) -> Result<InvoiceTotal, CommandError> {
    if !(0.0..=1.0).contains(&tax_rate) {
        return Err(AppError::program(
            "invoices.bad_rate",                     // stable code the interface can branch on
            "The tax rate must be between 0 and 100%.", // shown to the user
            format!("tax_rate = {tax_rate}"),        // written to the log
        )
        .into());
    }
    let net_cents: u64 = lines.iter().sum();
    Ok(InvoiceTotal { net_cents, tax_cents: (net_cents as f64 * tax_rate).round() as u64 })
}
```

Register it, then regenerate the bindings:

```rust
// src-tauri/src/commands/mod.rs
mod invoices;
// ...
.commands(tauri_specta::collect_commands![invoices::total_invoice])
```

```bash
npm run bindings
```

Call it from the interface. The function, its arguments and its result are all
typed from the Rust signature:

```ts
import { reportError, unwrap } from '@/chassis'
import { commands } from '@/app/bindings'

try {
  const total = await unwrap(commands.totalInvoice(lines, 0.2))
} catch (error) {
  reportError(error, 'Could not total the invoice')
}
```

Notes:

- Make commands `async`. A synchronous command runs on the main thread and
  freezes the window while it works. Blocking work (file I/O) goes inside
  `tauri::async_runtime::spawn_blocking`.
- `?` works on I/O and Tauri errors directly: they become `CommandError`s with
  the codes `not_found`, `permission_denied`, `io` and `internal`.
- A command receives whatever the webview sends. Validate its input like any
  other external input; for paths, see section 6.
- Add a `#[cfg(test)] mod tests` next to the logic. `cargo test` runs it.

---

## 5. Call a web API

```ts
import { requestJson } from '@/chassis'

const data = await requestJson('https://api.example.com/v1/rates', {
  headers: { Authorization: `Bearer ${token}` },
  timeoutMs: 10_000,
})
```

Requests are made by the native side, so there is no CORS. Every attempt has a
timeout (15 seconds unless set); network failures, timeouts and 408/429/5xx
responses are retried twice with backoff for GET, PUT and DELETE, and never for
POST unless you pass `retries`. Failures throw an `HttpError` whose message a
user can act on. `requestJson` returns `unknown`: check the shape before using
it (see `parseRelease` in the template's demo).

The host has to be allowed in `src-tauri/capabilities/app.json`:

```json
{ "identifier": "http:default", "allow": [{ "url": "https://api.example.com/*" }] }
```

An API key compiled into the program can be extracted from it. Anything that
must stay secret belongs on a server the program talks to, not in the program.

---

## 6. Work with files

The filesystem scope decides which paths the program may touch. Paths the user
chooses are added to it automatically: from the file dialog, and from files
dropped onto the window.

```ts
import { open, save } from '@tauri-apps/plugin-dialog'
const path = await open({ multiple: false, filters: [{ name: 'CSV', extensions: ['csv'] }] })
```

Read and write them either from the interface with
`@tauri-apps/plugin-fs` (add the permissions it needs, such as
`fs:allow-read-text-file`, to `app.json`), or in a Rust command. A command has
full filesystem access, so it must check the path itself:

```rust
use tauri_plugin_fs::FsExt;

if !app.fs_scope().is_allowed(&path) {
    return Err(AppError::not_allowed(format!("{} is not in scope", path.display())).into());
}
```

The program's own data belongs in the app data folder: `app.path().app_data_dir()`
in Rust, `appDataDir()` from `@tauri-apps/api/path` in TypeScript.

---

## 7. Permissions

`src-tauri/capabilities/app.json` lists what the program may do beyond the
chassis. Every plugin is registered by the template, but none can be used until
a permission here allows it. Add the narrowest one that works:

| To | Add |
|---|---|
| Show open and save dialogs | `dialog:allow-open`, `dialog:allow-save` |
| Read and write chosen files from TypeScript | `fs:allow-read-text-file`, `fs:allow-write-text-file` |
| Send notifications | `notification:allow-is-permission-granted`, `notification:allow-request-permission`, `notification:allow-notify` |
| Reach a web API | `http:default` with an `allow` list of URL patterns |
| Register a global keyboard shortcut | `global-shortcut:allow-register`, `global-shortcut:allow-unregister` |
| Show or focus the window from TypeScript | `core:window:allow-show`, `core:window:allow-set-focus` |

The full list for a plugin is generated at build time in
`src-tauri/gen/schemas/desktop-schema.json`, which editors use to autocomplete
the file. A build fails if a permission name is wrong.

---

## 8. Global shortcuts, launch at login, the tray

**Global shortcuts** work system-wide, even when the program is not focused, so
choose one that other programs are unlikely to use and let the user turn it
off. After adding the permissions above:

```ts
import { register } from '@tauri-apps/plugin-global-shortcut'
await register('CommandOrControl+Alt+Space', (event) => { if (event.state === 'Pressed') … })
```

**Launch at login** is already on the Settings page. It is disabled in
development builds, which live in a build folder that changes on every
compile.

**The tray** icon is always present, with Show and Quit. "Keep running in the
tray" on the Settings page makes the close button hide the window instead of
quitting.

---

## 9. Enable SQLite

Off by default: most programs need settings, not a relational database.
When one does:

```bash
cargo add tauri-plugin-sql --features sqlite --manifest-path src-tauri/Cargo.toml
npm install @tauri-apps/plugin-sql
```

Register the plugin in `src-tauri/src/lib.rs` with
`.plugin(tauri_plugin_sql::Builder::new().build())`, allow `sql:default` in
`capabilities/app.json`, and open the database in the app data folder:

```ts
import Database from '@tauri-apps/plugin-sql'
const db = await Database.load('sqlite:invoices.db')
```

`lib.rs` is a chassis file, so that one line is the exception to the zone
rule. Keep a note of it in the program's README for the next template merge.

Keep the npm package and the crate on the same major.minor version: the Tauri
CLI refuses to build when a plugin's two halves disagree.

---

## 10. Windows on ARM

Add the target and build for it:

```bash
rustup target add aarch64-pc-windows-msvc
npm run build -- --target aarch64-pc-windows-msvc
```

For releases, add a second job to `.github/workflows/release.yml` that runs the
same build with `args: --target aarch64-pc-windows-msvc`; tauri-action adds the
ARM64 entry to the same `latest.json`.

---

## 11. Things that will bite you

- **Plugin versions move in pairs.** `@tauri-apps/plugin-x` and
  `tauri-plugin-x` must share a major.minor version or `tauri build` stops.
  Update both halves together.
- **tauri-specta is pinned exactly** (`=2.0.0-rc.25` with `specta` at the same
  version and `specta-typescript` `=0.0.12`). They are release candidates that
  must match each other; update all three at once.
- **Notifications in development** appear as coming from PowerShell. An
  installed build shows the program's own name and icon.
- **A second launch of a development build** rewrites the bindings before it
  hands over to the running instance, and Vite reloads the page. Only
  development builds do this.
- **The Content Security Policy only bites in release builds.** Something that
  works in `npm run dev` and breaks after `npm run build` (an image from a CDN,
  an inline script) is almost always the policy in `tauri.conf.json`. Bundle
  assets rather than widening it.
- **WebView2 is Chromium, WKWebView is Safari.** Something that works on
  Windows can still fail on macOS in development; the build targets in
  `vite.config.ts` are the floor for both.
- **Settings keys are namespaced** `app.*` and `chassis.*`. Renaming a setting
  orphans the stored value; read the old key once and write the new one if
  that matters.
