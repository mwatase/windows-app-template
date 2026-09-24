import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** The files that carry a program's identity and version. */
export interface ProjectFiles {
  root: string
  packageJson: string
  packageLock: string
  tauriConfig: string
  cargoToml: string
  cargoLock: string
}

/**
 * `npm run` starts scripts in the package root, but IDE run configurations
 * and a direct `npx tsx scripts/...` may not. Walking up to the directory that
 * holds both package.json and src-tauri/tauri.conf.json is more reliable than
 * trusting the working directory.
 */
export function findProjectRoot(start = process.cwd()): string {
  let dir = start
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src-tauri', 'tauri.conf.json'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Run this from the project folder: it has package.json and src-tauri/tauri.conf.json.')
}

export function projectFiles(root: string): ProjectFiles {
  return {
    root,
    packageJson: join(root, 'package.json'),
    packageLock: join(root, 'package-lock.json'),
    tauriConfig: join(root, 'src-tauri', 'tauri.conf.json'),
    cargoToml: join(root, 'src-tauri', 'Cargo.toml'),
    cargoLock: join(root, 'src-tauri', 'Cargo.lock'),
  }
}

export type JsonObject = { [key: string]: unknown }

export function readJson(path: string): JsonObject {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} does not contain a JSON object`)
  }
  return value as JsonObject
}

/** The format npm itself writes, so a rewrite never reformats the whole file. */
export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function writeText(path: string, text: string): void {
  writeFileSync(path, text, 'utf8')
}
