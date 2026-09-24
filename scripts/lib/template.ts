/**
 * What `npm run init` changes, as pure functions: validation for each answer
 * and a transform for each file. The script (scripts/init.ts) does the
 * asking and the disk work; everything that can be wrong is decided here,
 * where it can be tested.
 */

import type { JsonObject } from './project'
import { setLockEntry, setTomlPackageField, withLockIdentity } from './version'

/** The package name a fresh clone has. Anything else means init already ran. */
export const TEMPLATE_PACKAGE = 'windows-app-template'
export const TEMPLATE_REPOSITORY = 'mwatase/windows-app-template'
export const FIRST_VERSION = '0.1.0'

export interface Answers {
  /** Shown to users: window title, Start menu, installer. "Invoice Studio" */
  name: string
  /** npm and Cargo package name. "invoice-studio" */
  packageName: string
  /** Reverse-DNS identity: data folder, notifications, updates. "com.acme.invoicestudio" */
  identifier: string
  /** Company or person the program is published by. "Acme Creative" */
  publisher: string
  description: string
  /** GitHub `owner/name` that releases are published to. */
  repository: string
  width: number
  height: number
}

export type Check = { ok: true; value: string } | { ok: false; error: string }

const ok = (value: string): Check => ({ ok: true, value })
const fail = (error: string): Check => ({ ok: false, error })

/* ------------------------------------------------------------ validation */

/**
 * The name becomes the installer's file name, the install folder and the
 * Start menu entry, so it has to be a valid Windows file name.
 */
export function checkName(raw: string): Check {
  const value = raw.trim()
  if (value === '') return fail('Enter the program name, as people will see it.')
  if (value.length > 60) return fail('Keep it under 60 characters.')
  if (/[\\/:*?"<>|]/.test(value)) return fail('Windows does not allow \\ / : * ? " < > | in a name.')
  if (/\.$/.test(value)) return fail('Windows does not allow a name ending in a full stop.')
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(value)) return fail(`"${value}" is reserved by Windows.`)
  return ok(value)
}

export function checkPackageName(raw: string): Check {
  const value = raw.trim()
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
    return fail('Lowercase letters, digits and single dashes, starting with a letter: invoice-studio.')
  }
  if (value.length > 64) return fail('Keep it under 64 characters.')
  if (value === TEMPLATE_PACKAGE) return fail('Choose a name of your own, not the template’s.')
  return ok(value)
}

/**
 * The identifier names the program's data folder, its notifications and its
 * update channel. Changing it after release strands every installed copy's
 * settings, so it is worth getting right now.
 */
export function checkIdentifier(raw: string): Check {
  const value = raw.trim()
  if (!/^[a-zA-Z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)+$/.test(value)) {
    return fail('Use reverse-DNS form with at least two parts, such as com.acme.invoicestudio.')
  }
  if (value.length > 255) return fail('Keep it under 255 characters.')
  if (value.toLowerCase().endsWith('.app')) return fail('It cannot end in .app, which clashes on macOS.')
  if (value === 'com.mwatase.windowsapptemplate') return fail('Choose an identifier of your own, not the template’s.')
  return ok(value)
}

export function checkText(label: string, max: number) {
  return (raw: string): Check => {
    const value = raw.trim()
    if (value === '') return fail(`Enter the ${label}.`)
    if (value.length > max) return fail(`Keep it under ${max} characters.`)
    return ok(value)
  }
}

export function checkRepository(raw: string): Check {
  const value = raw.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) return fail('Write it as owner/name, such as acme/invoice-studio.')
  if (value.toLowerCase() === TEMPLATE_REPOSITORY) {
    return fail('Releases must go to the program’s own repository, not the template’s.')
  }
  return ok(value)
}

export function checkWindowSize(raw: string): Check {
  const match = /^\s*(\d{3,4})\s*[x×*,]\s*(\d{3,4})\s*$/i.exec(raw)
  if (!match) return fail('Width and height in pixels, such as 1100x720.')
  const [width, height] = [Number(match[1]), Number(match[2])]
  if (width < 400 || height < 300) return fail('At least 400x300, or the sidebar and a view will not fit.')
  if (width > 3840 || height > 2160) return fail('At most 3840x2160.')
  return ok(`${width}x${height}`)
}

/* ------------------------------------------------------------- defaults */

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Package names must start with a letter: "3D Viewer" becomes app-3d-viewer.
  const lettered = /^[0-9]/.test(slug) ? `app-${slug}` : slug
  return lettered.slice(0, 64).replace(/-+$/, '')
}

/** com.<publisher>.<package>, reduced to the characters an identifier allows. */
export function suggestIdentifier(publisher: string, packageName: string): string {
  const part = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^[0-9]+/, '')
  return `com.${part(publisher) || 'example'}.${part(packageName) || 'app'}`
}

/** `owner/name` from a GitHub remote URL, in any of its spellings. */
export function repositoryFromRemote(remote: string): string | undefined {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim())
  return match ? `${match[1]}/${match[2]}` : undefined
}

/* ----------------------------------------------------------- transforms */

type Json = JsonObject

export function rewriteTauriConfig(config: Json, answers: Answers, pubkey: string): Json {
  const app = (config.app ?? {}) as Json
  const windows = (app.windows ?? []) as Json[]
  const bundle = (config.bundle ?? {}) as Json
  const plugins = (config.plugins ?? {}) as Json
  const updater = (plugins.updater ?? {}) as Json

  return {
    ...config,
    productName: answers.name,
    version: FIRST_VERSION,
    identifier: answers.identifier,
    app: {
      ...app,
      windows: windows.map((window, index) =>
        index === 0 ? { ...window, title: answers.name, width: answers.width, height: answers.height } : window,
      ),
    },
    bundle: {
      ...bundle,
      publisher: answers.publisher,
      copyright: `Copyright ${new Date().getFullYear()} ${answers.publisher}`,
      shortDescription: answers.description,
      longDescription: answers.description,
    },
    plugins: {
      ...plugins,
      updater: {
        ...updater,
        pubkey,
        endpoints: [`https://github.com/${answers.repository}/releases/latest/download/latest.json`],
      },
    },
  }
}

export function rewritePackageJson(pkg: Json, answers: Answers): Json {
  return {
    ...pkg,
    name: answers.packageName,
    version: FIRST_VERSION,
    description: answers.description,
    author: answers.publisher,
  }
}

export function rewritePackageLock(lock: Json, answers: Answers): Json {
  return withLockIdentity(lock, { name: answers.packageName, version: FIRST_VERSION })
}

export function rewriteCargoToml(toml: string, answers: Answers): string {
  let next = setTomlPackageField(toml, 'name', answers.packageName)
  next = setTomlPackageField(next, 'version', FIRST_VERSION)
  next = setTomlPackageField(next, 'description', answers.description)
  return setTomlPackageField(next, 'authors', [answers.publisher])
}

export function rewriteCargoLock(lock: string, currentName: string, answers: Answers): string {
  return setLockEntry(lock, currentName, { name: answers.packageName, version: FIRST_VERSION })
}

export function rewriteIndexHtml(html: string, answers: Answers): string {
  if (!/<title>[^<]*<\/title>/.test(html)) throw new Error('index.html has no <title>')
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(answers.name)}</title>`)
}

export function programReadme(answers: Answers): string {
  return `# ${answers.name}

${answers.description}

Built on [windows-app-template](https://github.com/${TEMPLATE_REPOSITORY}): Tauri 2, React and TypeScript,
with signed installers, verified auto-update, logging and diagnostics already in place.

## Develop

\`\`\`bash
npm install
npm run dev
\`\`\`

\`npm run verify\` runs every check CI runs: types, lint, and the TypeScript and Rust tests.

## Where the program lives

| | |
|---|---|
| \`src/app/\` | The interface: views, features, the program's settings |
| \`src-tauri/src/commands/\` | Native commands the interface calls |
| \`src-tauri/capabilities/app.json\` | What the program is permitted to do |

\`src/chassis/\`, \`src/ui/\` and \`src-tauri/src/chassis/\` belong to the template. Changes there should go
back into the template so every program gets them. See \`CLAUDE.md\` and \`docs/CUSTOMIZATION.md\`.

## Release

\`\`\`bash
npm run version:set -- 0.2.0
git commit -am "Release 0.2.0"
git tag v0.2.0
git push --follow-tags
\`\`\`

GitHub Actions builds, signs and publishes the installers to
[the releases page](https://github.com/${answers.repository}/releases). Installed copies find the new version
and update themselves. The full process is in \`docs/RELEASING.md\`.
`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
