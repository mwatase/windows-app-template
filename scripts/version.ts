import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

import { findProjectRoot, formatJson, projectFiles, readJson, writeText } from './lib/project'
import {
  lockRootVersion,
  readLockVersion,
  readTomlPackageField,
  setLockEntry,
  setTomlPackageField,
  tagToVersion,
  versionError,
  withLockIdentity,
} from './lib/version'

/**
 * One version, five files.
 *
 *   npm run version:set -- 1.4.0       set it everywhere, from one command
 *   npm run version:check              confirm every file agrees
 *   npm run version:check -- v1.4.0    ...and that a release tag matches
 *
 * src-tauri/tauri.conf.json is the source of truth; package.json, Cargo.toml
 * and both lockfiles follow it. The release workflow runs `check` with the
 * pushed tag, so a tag that disagrees with the manifest fails the build
 * instead of shipping a mislabelled release.
 */

const [command, argument] = process.argv.slice(2)
const files = projectFiles(findProjectRoot())
const show = (path: string) => relative(files.root, path).replace(/\\/g, '/')

function readVersions(): Array<[string, string]> {
  const tauri = readJson(files.tauriConfig)
  const pkg = readJson(files.packageJson)
  const lock = lockRootVersion(readJson(files.packageLock))
  const toml = readFileSync(files.cargoToml, 'utf8')
  const crate = readTomlPackageField(toml, 'name') ?? ''
  const cargoLock = readLockVersion(readFileSync(files.cargoLock, 'utf8'), crate)

  return [
    [show(files.tauriConfig), String(tauri.version)],
    [show(files.packageJson), String(pkg.version)],
    [`${show(files.packageLock)} (version)`, String(lock.top)],
    [`${show(files.packageLock)} (packages[""])`, String(lock.root)],
    [show(files.cargoToml), String(readTomlPackageField(toml, 'version'))],
    [show(files.cargoLock), String(cargoLock)],
  ]
}

function check(tag: string | undefined): number {
  const versions = readVersions()
  const truth = versions[0]?.[1] ?? ''
  let filesDisagree = false

  for (const [file, version] of versions) {
    const ok = version === truth
    filesDisagree ||= !ok
    console.log(`  ${ok ? 'ok ' : 'NO '} ${version.padEnd(10)} ${file}`)
  }

  const tagged = tag === undefined ? undefined : tagToVersion(tag)
  if (tag !== undefined && tagged !== undefined) {
    console.log(`  ${tagged === truth ? 'ok ' : 'NO '} ${tagged.padEnd(10)} release tag ${tag}`)
  }

  const problem = versionError(truth)
  if (problem) console.log(`\n  ${problem}`)
  if (filesDisagree) {
    console.log(`\n  The files disagree. Bring them back in line with:  npm run version:set -- ${truth}`)
  }
  if (tagged !== undefined && tagged !== truth) {
    console.log(`\n  The tag says ${tagged} but the project is at ${truth}. Either tag the commit v${truth},`)
    console.log(`  or run  npm run version:set -- ${tagged}, commit that, and tag the new commit.`)
  }

  if (problem || filesDisagree || (tagged !== undefined && tagged !== truth)) return 1
  console.log(`\n  Everything is at ${truth}.`)
  return 0
}

function set(version: string | undefined): number {
  if (!version) {
    console.log('  Which version? For example:  npm run version:set -- 1.4.0')
    return 1
  }
  const problem = versionError(version)
  if (problem) {
    console.log(`  ${problem}`)
    return 1
  }

  // Everything is computed before anything is written, so a failure part way
  // through cannot leave the five files disagreeing.
  const toml = readFileSync(files.cargoToml, 'utf8')
  const crate = readTomlPackageField(toml, 'name')
  if (!crate) throw new Error('Cargo.toml has no package name')

  const writes: Array<[string, string]> = [
    [files.tauriConfig, formatJson({ ...readJson(files.tauriConfig), version })],
    [files.packageJson, formatJson({ ...readJson(files.packageJson), version })],
    [files.packageLock, formatJson(withLockIdentity(readJson(files.packageLock), { version }))],
    [files.cargoToml, setTomlPackageField(toml, 'version', version)],
    [files.cargoLock, setLockEntry(readFileSync(files.cargoLock, 'utf8'), crate, { version })],
  ]
  for (const [path, text] of writes) {
    writeText(path, text)
    console.log(`  wrote ${show(path)}`)
  }
  console.log(`\n  Version set to ${version}. Commit, then tag the commit v${version} to release it.`)
  return 0
}

if (command === 'check') process.exitCode = check(argument)
else if (command === 'set') process.exitCode = set(argument)
else {
  console.log('  usage: npm run version:set -- <x.y.z>  |  npm run version:check [-- <tag>]')
  process.exitCode = 1
}
