// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  lockRootVersion,
  readLockVersion,
  readTomlPackageField,
  setLockEntry,
  setTomlPackageField,
  tagToVersion,
  versionError,
  withLockIdentity,
} from './version'

const CARGO_TOML = `[package]
name = "windows-app-template"
version = "0.1.0"
description = "Foundation"
authors = ["mwatase"]
edition = "2021"

[lib]
# comments survive
name = "app_lib"

[dependencies]
tauri = { version = "2.11", features = ["tray-icon"] }
`

const CARGO_LOCK = `[[package]]
name = "tauri"
version = "2.11.6"

[[package]]
name = "windows-app-template"
version = "0.1.0"
dependencies = [
 "tauri",
]
`

describe('versionError', () => {
  it('accepts a plain three-part version', () => {
    expect(versionError('1.4.0')).toBeNull()
    expect(versionError('255.255.65535')).toBeNull()
  })

  it('rejects what an MSI installer cannot represent', () => {
    expect(versionError('1.4')).toMatch(/three numbers/)
    expect(versionError('1.4.0-beta.1')).toMatch(/three numbers/)
    expect(versionError('256.0.0')).toMatch(/too large/)
    expect(versionError('1.0.65536')).toMatch(/too large/)
  })
})

describe('tagToVersion', () => {
  it('strips the ref prefix and the v', () => {
    expect(tagToVersion('refs/tags/v1.2.3')).toBe('1.2.3')
    expect(tagToVersion('v1.2.3')).toBe('1.2.3')
    expect(tagToVersion('1.2.3')).toBe('1.2.3')
  })
})

describe('Cargo.toml edits', () => {
  it('reads and writes [package] fields only, leaving the rest byte for byte', () => {
    expect(readTomlPackageField(CARGO_TOML, 'version')).toBe('0.1.0')

    const next = setTomlPackageField(CARGO_TOML, 'version', '2.0.0')
    expect(readTomlPackageField(next, 'version')).toBe('2.0.0')
    // The dependency's `version = "2.11"` and the [lib] name are untouched.
    expect(next).toContain('tauri = { version = "2.11"')
    expect(next).toContain('name = "app_lib"')
    expect(next).toContain('# comments survive')
    expect(next.replace('2.0.0', '0.1.0')).toBe(CARGO_TOML)
  })

  it('writes arrays and escapes strings as TOML expects', () => {
    const next = setTomlPackageField(CARGO_TOML, 'authors', ['O"Brien & Co'])
    expect(next).toContain('authors = ["O\\"Brien & Co"]')
  })

  it('refuses to invent a field that is not there', () => {
    expect(() => setTomlPackageField(CARGO_TOML, 'homepage', 'x')).toThrow(/no homepage field/)
  })
})

describe('Cargo.lock edits', () => {
  it('changes only the project entry', () => {
    expect(readLockVersion(CARGO_LOCK, 'windows-app-template')).toBe('0.1.0')
    const next = setLockEntry(CARGO_LOCK, 'windows-app-template', { name: 'invoice-studio', version: '0.2.0' })
    expect(readLockVersion(next, 'invoice-studio')).toBe('0.2.0')
    expect(readLockVersion(next, 'tauri')).toBe('2.11.6')
  })
})

describe('package-lock.json identity', () => {
  it('updates both places the root package appears', () => {
    const lock = { name: 'a', version: '0.1.0', packages: { '': { name: 'a', version: '0.1.0' }, 'node_modules/x': {} } }
    const next = withLockIdentity(lock, { version: '0.2.0' })
    expect(lockRootVersion(next)).toEqual({ top: '0.2.0', root: '0.2.0' })
    expect((next.packages as Record<string, unknown>)['node_modules/x']).toEqual({})
  })
})
