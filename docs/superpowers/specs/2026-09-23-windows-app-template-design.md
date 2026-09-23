# Windows Native App Template — Design

**Date:** 2026-09-23
**Status:** Awaiting review
**Repo:** `windows-app-template`

---

## 1. Purpose

A GitHub template repository that serves as the foundation for every new Windows
native desktop program. Clone it, run one command, and start building the program
itself rather than re-solving installers, auto-update, logging, and window
management for the fifth time.

The problems this template solves once, so they are never solved again:

- Producing a genuine compiled `.exe` that a stranger can install and run
- Updating that program on customer machines safely after release
- Learning what went wrong when a program fails on a machine you cannot see
- Keeping a consistent structure across programs so each one is navigable

## 2. Context and constraints

These come from the requirements conversation and drive every decision below.

| Constraint | Consequence |
|---|---|
| Programs are GUI desktop apps | Needs a real windowing and UI layer |
| Distributed **outside** the company | Signing, installer, auto-update, and polish are mandatory, not optional |
| Owner directs; Claude writes the code | Optimize for compile-time safety and readable structure over author familiarity |
| Authoring on Intel macOS 12.7.6 | The stack must be developable on a Mac |
| Verification on a separate Windows PC | Real Windows testing is available, but should not be required for every change |
| Programs need file, network, persistence, and OS access | All four must be first-class, not bolted on later |

**Assumptions.** Target is Windows 10 (1803+) and Windows 11 on x64. One program
per repository. The template must remain comprehensible a year from now.

## 3. Stack decision

**Chosen: Tauri 2** — a Rust core compiled to a native `.exe`, with the interface
built in TypeScript and rendered by WebView2, the browser engine already present
in Windows.

This is not Electron. Electron ships an entire copy of Chromium inside every
program, producing a 150 MB download. Tauri compiles to native Rust and borrows
the rendering engine Windows already has, producing roughly 5–10 MB.

**Why this over the alternatives:**

1. **Distribution is the dominant requirement.** Tauri treats installers,
   Authenticode signing, and signature-verified auto-update as built-in
   features. In the alternatives these are third-party components assembled by
   hand — more parts, more drift, more to maintain across every program.
2. **All four capability buckets have official, maintained plugins.** Nothing in
   the requirements needs a bespoke solution.
3. **Download size matters when a stranger decides whether to install.** 5 MB
   versus roughly 70 MB.
4. **Interface built in HTML and CSS** gives the widest design latitude, which
   matters for work coming out of a creative services function.

**Rejected: WPF / WinUI 3.** Cannot be built on macOS at all. Every build would
have to round-trip through the Windows PC, destroying the iteration loop.

**Rejected: Avalonia + .NET.** Genuinely viable and simpler — one language, one
ecosystem, and it builds Windows executables directly from a Mac. Rejected
because distribution machinery is assembled rather than built in, and binaries
are roughly ten times larger. This is the fallback if Tauri proves painful in
practice.

**Rejected: Electron.** Fails the "native executable" requirement.

**Supporting choices:** React 19 and TypeScript in strict mode (deepest
ecosystem, errors caught at compile time rather than on a customer's machine);
Vite for builds; Tailwind CSS with shadcn/ui, which places accessible component
source directly in the repository rather than adding a dependency to fight.

## 4. Architecture — the chassis / app split

The single idea that makes this a reusable template rather than a pile of
starting files. All code divides into two zones.

```
src/                        FRONTEND (TypeScript / React)
├── chassis/                ← template plumbing. Rarely touched.
│   ├── updater/              update check and prompt
│   ├── settings/             persisted preferences
│   ├── errors/               error boundary and reporting
│   ├── logging/              structured logs to disk
│   └── shell/                window frame, titlebar, navigation
├── ui/                     ← design system components
└── app/                    ← THE PROGRAM BEING BUILT
    ├── views/
    ├── features/
    └── state/

src-tauri/                  NATIVE CORE (Rust)
├── src/
│   ├── chassis/            ← tray, single-instance, window state
│   └── commands/           ← native functions for this program
├── capabilities/           ← security permissions, explicitly enumerated
└── tauri.conf.json         identity, bundling, updater config
```

**Why the boundary exists.** When the template improves — a security patch, a
better updater, a new plugin — those changes land in `chassis/` and `ui/` and can
be pulled into existing programs without colliding with the code in `app/`.
Without this separation a template is forked once and then rots, because merging
upstream fixes becomes impossible. With it, the foundation stays alive across
every program built on it.

**Data flow.** React calls typed functions that cross into Rust through Tauri's
command bridge. Rust performs privileged work — filesystem, OS APIs, anything
the web layer must not touch — and returns typed results. TypeScript types for
that boundary are generated from the Rust definitions via `tauri-specta`, so
changing a Rust function without updating the interface fails the build instead
of shipping.

**Deliberately excluded:** no global state library, no routing framework, no
backend server. A desktop program with a handful of views needs none of them,
and every dependency in a template is inherited by every future program. These
get added when a real program first needs one.

## 5. Capabilities wired in

| Need | Provided by |
|---|---|
| Local files and folders | `plugin-fs`, `plugin-dialog`, window drag-and-drop |
| Web APIs and cloud services | `plugin-http`, routed through Rust (no CORS restrictions), wrapped with timeout and retry |
| Persistent local data | `plugin-store` for settings, preferences, and cache |
| OS integration | System tray with menu, `plugin-notification` for native toasts, `plugin-autostart`, `plugin-global-shortcut`, `plugin-single-instance`, window position memory |

**SQLite is documented but disabled by default.** Most programs need settings,
not a relational database. Enabling it is a documented one-step change.

**Security posture: least privilege.** Tauri 2's capability system requires
permissions to be explicitly enumerated in `capabilities/`. The template ships
with the narrowest viable set and a locked-down content security policy. Each
program widens this deliberately rather than inheriting broad access it never
audited — which matters because this software runs on machines belonging to
people outside the company.

## 6. Error handling, logging, and diagnostics

The governing constraint: **when externally distributed software fails, nobody
is standing next to the machine.** Everything here exists to make a remote
failure diagnosable.

- **Rust errors** use a typed error enum (`thiserror`) carrying a stable error
  code, a message safe to show a user, and technical detail for the log.
- **A React error boundary** catches interface crashes and shows a recovery
  screen rather than a blank white window.
- **Recoverable errors** surface as toast notifications in plain language, not
  stack traces.
- **Logs** are written by `plugin-log` to rotating files under
  `%APPDATA%\<app>\logs`, with console output during development.
- **A "Copy diagnostic info" button** in Settings places the app version,
  Windows version, and recent log output on the clipboard. When a customer
  reports a problem, the exchange is one paste instead of twenty questions.
  This is the highest-value item in this section.

**No telemetry.** Software that reports back without consent is a legal and
reputational liability. If it is ever wanted, it arrives as an explicit opt-in.

## 7. Build, release, and distribution

**Local development on the Mac.** `npm run dev` launches a macOS-native window
running the same interface, with hot reload. This is the fast loop for layout
and logic work.

**Windows verification without a Windows build setup.** Every push to `main`
and every pull request triggers a GitHub Actions build on a Windows runner
producing an unsigned `.exe`, attached to the run as a downloadable artifact. Download it, run it on
the Windows PC, confirm real behavior.

**Release.** Pushing a git tag such as `v1.2.3` triggers a Windows build that:

1. Compiles the release bundle
2. Signs it with Authenticode if certificate secrets are configured, and skips
   signing cleanly if they are not
3. Produces an NSIS installer and an MSI
4. Generates and signs the update manifest
5. Publishes a GitHub Release with all artifacts

**Auto-update.** `plugin-updater` checks the release feed at launch, verifies a
minisign signature before installing anything, and prompts the user.
**Signature verification is not optional** — an updater that installs unverified
payloads is a remote code execution channel into every customer machine.

**Versioning.** `tauri.conf.json` is the single source of truth, synchronized to
`package.json` and `Cargo.toml` by a script. A tag that disagrees with the
manifest fails the build rather than shipping a mislabeled release.

## 8. Testing

| Layer | Tool |
|---|---|
| Rust logic and commands | `cargo test` |
| Interface components and logic | Vitest with React Testing Library |
| Static correctness | TypeScript strict mode, ESLint, `cargo clippy` |

All of these gate a release build. Nothing ships past a red test.

**End-to-end browser tests are deliberately excluded.** Tauri's WebDriver
support on Windows is unreliable enough that the suite would fail for reasons
unrelated to the program, and a test suite that cries wolf trains its owner to
ignore red builds. Documented as an optional addition.

## 9. Starting a new program

```
npm run init
```

An interactive script that asks for the program name, bundle identifier, author,
description, and window defaults, then rewrites `tauri.conf.json`,
`package.json`, `Cargo.toml`, `index.html`, and the README, generates a fresh
updater signing keypair, and removes the demo content from `src/app/`. One
command from clone to a program of your own.

**`CLAUDE.md` at the repository root** documents the conventions for future
Claude sessions: where code belongs, what must not be edited, how to add a
capability. Because the owner directs rather than hand-writes, this file is what
keeps future work consistent with the template's design instead of improvising a
new structure each time.

**Demo content.** The template ships with a small working example that exercises
all four capability buckets — reads a file, calls an API, saves a setting, raises
a notification. It proves the chassis works end to end, and `npm run init`
deletes it.

## 10. Out of scope

Explicitly not included, to keep the foundation small:

- macOS and Linux distribution (Tauri supports them; the template does not
  configure them)
- Windows ARM64 (documented as a one-line addition)
- Telemetry and analytics
- Licensing, activation, or payment handling
- Automatic crash reporting to a remote service
- End-to-end test infrastructure

## 11. Costs and prerequisites

**Code signing certificate — roughly $200–400 per year.** Without one, Windows
SmartScreen shows customers an "unrecognized app" warning. An Extended
Validation certificate costs more and clears SmartScreen immediately; a standard
Organization Validation certificate builds reputation over time. The template
functions unsigned throughout development, and signing is enabled by adding
secrets when the certificate is purchased.

**To be installed on the Mac:** the Rust toolchain via `rustup`. Node 20 is
already present.

**Free:** GitHub Actions on public repositories. Private repositories consume
included minutes, and Windows runners bill at a higher rate than Linux.

## 12. Success criteria

The template succeeds if all of the following hold:

1. Cloning it and running `npm run init` yields a personalized, building project
   in under five minutes.
2. `npm run dev` opens a working window on the Mac.
3. Pushing a tag produces a downloadable Windows installer with no manual steps.
4. An installed program updates itself to a newer release and verifies the
   signature before doing so.
5. A failure on a customer machine can be diagnosed from the clipboard
   diagnostic output alone.
6. An improvement made to the template can be pulled into a program built from
   it six months earlier without a merge conflict in `app/`.
