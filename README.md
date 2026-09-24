# windows-app-template

The starting point for every Windows desktop program, so that the installer,
signed auto-update, logging, diagnostics, settings and window management are
already solved before the first line of program-specific code is written.

Clone it, run `npm run init`, and what is left to build is the program itself.

```
Tauri 2 (Rust) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui
```

A genuine compiled `.exe`, not Electron: the interface is rendered by WebView2,
which Windows already has, so the installer is about 3 MB.

---

## Quick start

```bash
git clone https://github.com/mwatase/windows-app-template.git invoice-studio
cd invoice-studio
npm install
npm run dev          # opens the demo in a native window, with hot reload
```

Requirements:

| | |
|---|---|
| **Node** | 20.19 or newer (22 or 24 LTS recommended; Node 20 is past end of life) |
| **Rust** | stable, from [rustup](https://rustup.rs) |
| **Windows** | Visual Studio Build Tools with "Desktop development with C++", and WebView2 (built into Windows 10 and 11) |
| **macOS** | Xcode Command Line Tools (`xcode-select --install`) |

Development works on macOS and Windows. Windows installers are built by GitHub
Actions, so a Mac is enough to develop; a Windows PC is for trying the result.

### Making it a program of your own

```bash
npm run init
```

Asks for the program's name, publisher, identifier and release repository,
then rewrites the configuration, generates the program's own updater signing
key (in `~/.tauri`, never in the repository), removes the demo and leaves an
empty Home view. It writes nothing until every answer is in and confirmed.

Without a terminal (an IDE run button, a script), pass the answers instead:

```bash
npm run init -- --name "Invoice Studio" --publisher "Acme Creative" --repo acme/invoice-studio --yes
npm run init -- --help
```

---

## What you get

Everything below works on a fresh clone. None of it needs re-solving per
program.

**Installers**: an NSIS setup (per-user, no administrator rights needed) and an
MSI, from one command. Authenticode signing switches on when a certificate is
configured, and is skipped cleanly until then.

**Signed auto-update**: installed copies check the program's GitHub releases,
download a new version, verify its minisign signature against the key compiled
into the app, and install it. An update that fails verification is refused.
There is no way to turn verification off.

**Diagnosable failures**: typed errors with a stable code, a message safe to
show a customer, and technical detail that goes to the log. Rotating log files
shared by Rust and the interface. An error boundary per view, so one crash
leaves the rest of the app working. **Copy diagnostic info** in Settings puts
the version, Windows version, WebView2 version and recent log on the
clipboard: one paste instead of twenty questions.

**Settings**: typed, persisted, validated, readable from Rust as well as the
interface. The Settings page is chassis-owned; a program adds its own section.

**Windows integration**: system tray with a menu, optional keep-running-in-the-tray,
launch at login, native notifications, single instance (a second launch
brings the first to the front), and window size and position remembered
between launches.

**Files and network**: file dialogs, drag and drop onto the window, and HTTP
through the native side (no CORS) with timeouts, retries and plain-language
errors.

**Typed bridge**: Rust command signatures generate TypeScript bindings, so
changing a command without updating its callers fails the type check.

**Least privilege**: every plugin is registered, but nothing is permitted until
a capability file allows it. A strict Content Security Policy (scripts from the
app only) is in force in release builds.

**No telemetry.** Nothing is sent anywhere unless the user asks.

The demo (**Workbench**) exercises all of it: it reads a file in Rust, calls a
web API, saves a setting and raises a notification.

---

## The repository

Two zones, with a hard boundary between them.

```
src/                         INTERFACE (TypeScript / React)
├── chassis/                 THE CHASSIS: template plumbing, rarely touched
│   ├── shell/                 window frame, sidebar, desktop behaviour
│   ├── settings/              typed settings, theme, the Settings page
│   ├── updater/               update checks, the install banner
│   ├── errors/                error types, error boundary, reporting
│   ├── logging/               the logger and uncaught-error capture
│   ├── http/                  requests with timeout and retry
│   ├── diagnostics/           "Copy diagnostic info"
│   └── bindings.ts            generated from Rust
├── ui/                      design system (shadcn/ui components)
├── app/                     THE PROGRAM: edited every project
│   ├── views/  features/  state/
│   ├── bindings.ts            generated from Rust
│   └── index.ts               the AppDefinition handed to the chassis
└── main.tsx                 joins the two

src-tauri/                   NATIVE CORE (Rust)
├── src/chassis/             tray, window, logging, settings, diagnostics, errors
├── src/commands/            THE PROGRAM's native commands
├── capabilities/            chassis.json (template) and app.json (program)
└── tauri.conf.json          identity, bundling, updater

scripts/                     init, version, signing
docs/                        design spec, customization and release guides
.github/workflows/           ci.yml and release.yml
```

**The chassis may never import from `app/`.** ESLint fails the build if it
does. That rule is what makes an improvement worth having: fix the updater
while building program #4 and the change touches only the chassis, so it
merges into program #1 without colliding with that program's own code,
because all of it lives in `app/`.

### Where program work goes

| | |
|---|---|
| `src/app/index.ts` | The views, the program's Settings section, startup work |
| `src/app/views/`, `features/`, `state/` | The program's interface |
| `src-tauri/src/commands/` | Native commands the interface calls |
| `src-tauri/capabilities/app.json` | What the program is permitted to do |
| `src-tauri/tauri.conf.json` | Name, window, installer details |

`docs/CUSTOMIZATION.md` walks through adding a view, a command, a setting and
a permission, and enabling SQLite. `AGENTS.md` (read by Claude Code through
`CLAUDE.md`) records the conventions.

---

## Commands

| | |
|---|---|
| `npm run dev` | The app with hot reload |
| `npm run build` | Release build plus NSIS and MSI installers, in `src-tauri/target/release/bundle/` |
| `npm run verify` | Everything CI checks: types, lint, both test suites, rustfmt, clippy |
| `npm run typecheck` / `lint` / `test` | The individual checks |
| `npm run bindings` | Regenerate the TypeScript bindings from the Rust commands |
| `npm run version:set -- 1.2.0` | Set the version in every file that carries it |
| `npm run version:check` | Confirm they agree |
| `npm run init` | Turn the template into a new program |
| `npm run tauri icon app-icon.svg` | Regenerate every icon size from `app-icon.svg` |

---

## Testing

Vitest with Testing Library covers the interface's chassis: settings, HTTP
retry and timeout rules, the updater's states, error handling, the shell's
crash isolation and the desktop behaviour. `cargo test` covers the Rust side:
error codes and messages, the diagnostics log tail, the demo's file handling.
TypeScript strict mode, ESLint (including the zone boundary) and clippy with
warnings as errors run alongside. The scripts are tested too.

The suite is small on purpose. It proves the chassis still works after a
change; every test in a template is inherited by every program built from it.

End-to-end browser tests are deliberately left out: Tauri's WebDriver support on
Windows fails often enough, for reasons unrelated to the program, that a red
suite would stop meaning anything.

**CI** (`.github/workflows/ci.yml`) runs all of it on a Windows runner for every
push to `main` and every pull request, then builds the NSIS installer and
attaches it to the run, ready to download and try on a real PC.

---

## Releasing

```bash
npm run version:set -- 1.2.0
git commit -am "Release 1.2.0"
git tag v1.2.0
git push --follow-tags
```

The release workflow refuses a tag that disagrees with the version, runs every
check, builds and signs the installers, signs the update, and publishes a
GitHub Release. Installed copies find it and update themselves.

The first release needs the updater signing key as a GitHub secret, and a code
signing certificate stops Windows SmartScreen warning people who install the
program. Both are covered, with costs, in
**[`docs/RELEASING.md`](docs/RELEASING.md)**.

---

## Pulling template improvements into a program

A program keeps the template as a second git remote (`npm run init` offers to
rename `origin` to `template`), and merges from it like any other branch:

```bash
git fetch template
git merge template/main
```

Chassis changes merge cleanly because the program never edits the chassis, and
nothing in `app/` can conflict because the template never edits it. Dependency
updates usually merge on their own too. The exception is a template change on a
line next to one `npm run init` personalised (a program's `package.json`,
`tauri.conf.json`, `Cargo.toml`, lockfiles and `README.md` carry its identity):
git then asks, and the answer is to keep the program's identity and take the
template's other change. Afterwards run `npm install` and `npm run verify`.

---

## Security

- **Secrets are never committed.** Signing keys, certificates and API
  credentials belong in GitHub Actions secrets. `.gitignore` excludes
  `*.key`, `*.pfx`, `*.pem`, `.env` and the rest; do not weaken it.
- **The updater key is the program's crown jewel.** Anyone holding it can push
  code to every installed copy. `npm run init` writes it to `~/.tauri`, prints
  its password once, and never puts either in the repository.
- **Update signatures are always verified**, before the installer runs.
- **Commands validate what the webview sends them.** File paths are checked
  against the filesystem scope, which only contains what the user picked or
  dropped.
- **Nothing is permitted by default.** Plugins are inert until a capability
  file allows a command, and web requests are limited to listed hosts.
- **Release builds have a strict Content Security Policy**: scripts load only
  from the app itself, never inline or remote.

If a secret is ever committed, rotate it. Deleting the file does not remove it
from the history.

---

## Design

The decisions, trade-offs and things deliberately left out are in
[`docs/superpowers/specs/2026-09-23-windows-app-template-design.md`](docs/superpowers/specs/2026-09-23-windows-app-template-design.md),
with a section at the end on where the implementation departs from it. Read it
before changing anything structural.
