/**
 * Version handling shared by `npm run version:*` and `npm run init`.
 *
 * The version lives in src-tauri/tauri.conf.json. package.json, Cargo.toml
 * and both lockfiles follow it. Everything here is pure: it takes file
 * contents and returns new contents, so it can be tested without touching
 * the disk.
 */

/**
 * Why a release version must be plain X.Y.Z with small numbers: the MSI
 * installer stores its version as major.minor.build with limits of 255, 255
 * and 65535, and cannot express a pre-release suffix at all. A version it
 * cannot represent fails `tauri build` halfway through a release.
 */
export function versionError(version: string): string | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) return `"${version}" is not a version. Use three numbers, such as 1.4.0.`
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number]
  if (major > 255 || minor > 255 || patch > 65535) {
    return `${version} is too large for an MSI installer (the limits are 255.255.65535).`
  }
  return null
}

/** `refs/tags/v1.2.3`, `v1.2.3` and `1.2.3` all mean 1.2.3. */
export function tagToVersion(tag: string): string {
  return tag.replace(/^refs\/tags\//, '').replace(/^v/, '')
}

/* ------------------------------------------------------------ Cargo.toml */

/** The `[package]` table's text span: from its header to the next table. */
function packageTable(toml: string): { start: number; end: number } {
  const header = /^\[package\][ \t]*$/m.exec(toml)
  if (!header) throw new Error('Cargo.toml has no [package] table')
  const start = header.index + header[0].length
  const next = /^\[/m.exec(toml.slice(start))
  return { start, end: next ? start + next.index : toml.length }
}

function fieldPattern(field: string): RegExp {
  return new RegExp(`^(${field}[ \\t]*=[ \\t]*)(.*)$`, 'm')
}

export function readTomlPackageField(toml: string, field: string): string | undefined {
  const { start, end } = packageTable(toml)
  const match = fieldPattern(field).exec(toml.slice(start, end))
  if (!match?.[2]) return undefined
  const raw = match[2].trim()
  return raw.startsWith('"') ? (JSON.parse(raw) as string) : raw
}

/**
 * Replaces one field of `[package]`, leaving every other byte of the file,
 * comments included, as it was. JSON string syntax is valid TOML basic-string
 * syntax, so JSON.stringify doubles as the TOML quoting function.
 */
export function setTomlPackageField(toml: string, field: string, value: string | readonly string[]): string {
  const { start, end } = packageTable(toml)
  const table = toml.slice(start, end)
  const pattern = fieldPattern(field)
  if (!pattern.test(table)) throw new Error(`Cargo.toml's [package] table has no ${field} field`)
  const rendered = typeof value === 'string' ? JSON.stringify(value) : `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
  return toml.slice(0, start) + table.replace(pattern, (_all, prefix: string) => `${prefix}${rendered}`) + toml.slice(end)
}

/* ------------------------------------------------------------ Cargo.lock */

function lockEntry(crate: string): RegExp {
  const name = crate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(\\[\\[package\\]\\]\\r?\\nname = ")${name}("\\r?\\nversion = ")([^"]*)(")`)
}

export function readLockVersion(lock: string, crate: string): string | undefined {
  return lockEntry(crate).exec(lock)?.[3]
}

/** Renames and/or re-versions the project's own entry in Cargo.lock. */
export function setLockEntry(lock: string, crate: string, next: { name?: string; version?: string }): string {
  const pattern = lockEntry(crate)
  if (!pattern.test(lock)) throw new Error(`Cargo.lock has no entry for ${crate}`)
  return lock.replace(
    pattern,
    (_all, open: string, middle: string, version: string, close: string) =>
      `${open}${next.name ?? crate}${middle}${next.version ?? version}${close}`,
  )
}

/* -------------------------------------------------------- package files */

type Json = { [key: string]: unknown }

/** package-lock.json repeats the root package's name and version in two places. */
export function withLockIdentity(lock: Json, identity: { name?: string; version?: string }): Json {
  const packages = (lock.packages ?? {}) as Json
  const root = (packages[''] ?? {}) as Json
  return {
    ...lock,
    ...identity,
    packages: { ...packages, '': { ...root, ...identity } },
  }
}

export function lockRootVersion(lock: Json): { top: unknown; root: unknown } {
  const packages = (lock.packages ?? {}) as Json
  const root = (packages[''] ?? {}) as Json
  return { top: lock.version, root: root.version }
}
