# windows-app-template

Foundation for building native Windows desktop programs (GUI, x64) that are
distributed to end users outside the organization.

**Stack:** Tauri 2 (Rust core) · React 19 · TypeScript · Tailwind CSS

## Status

**Pre-implementation.** The design is approved in principle and written up; the
template code does not exist yet.

- [Design spec](docs/superpowers/specs/2026-09-23-windows-app-template-design.md)

## What it will provide

A cloneable foundation with the recurring problems already solved: a signed
installer, signature-verified auto-update, structured logging and remote
diagnostics, system tray and notifications, filesystem and HTTP access, and
persistent settings — plus a one-command script to turn a clone into a new,
personalized program.

## Security note

This repository is public. Code signing certificates, private updater keys, and
API credentials must **never** be committed. They belong in GitHub Actions
encrypted secrets. See `.gitignore`.
