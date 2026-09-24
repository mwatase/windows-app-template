import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { createInterface, type Interface } from 'node:readline/promises'

import { findProjectRoot, formatJson, projectFiles, readJson, writeText } from './lib/project'
import {
  TEMPLATE_PACKAGE,
  TEMPLATE_REPOSITORY,
  checkIdentifier,
  checkName,
  checkPackageName,
  checkRepository,
  checkText,
  checkWindowSize,
  programReadme,
  repositoryFromRemote,
  rewriteCargoLock,
  rewriteCargoToml,
  rewriteIndexHtml,
  rewritePackageJson,
  rewritePackageLock,
  rewriteTauriConfig,
  slugify,
  suggestIdentifier,
  type Answers,
  type Check,
} from './lib/template'
import { readTomlPackageField } from './lib/version'

/**
 * Turns a fresh clone of the template into a program of your own.
 *
 *   npm run init
 *
 * Or without a terminal (an IDE run button, a CI step):
 *
 *   npm run init -- --name "Invoice Studio" --publisher "Acme Creative" \
 *     --repo acme/invoice-studio --yes
 *
 * It asks for the program's name, identity and release repository, then
 * rewrites the configuration, generates the program's own updater signing
 * key (outside the repository), removes the demo, and says what is left to
 * do. It changes nothing until every answer is in and confirmed; a half
 * renamed program is worse than none.
 */

/* ------------------------------------------------------------------ flags */

interface Flags {
  name?: string
  packageName?: string
  identifier?: string
  publisher?: string
  description?: string
  repository?: string
  window?: string
  keyDir?: string
  yes: boolean
  force: boolean
  help: boolean
}

// Parsed inside main(), so that an unknown option reaches the error handler
// at the bottom instead of throwing while the module loads.
let FLAGS: Flags = { yes: false, force: false, help: false }

const USAGE = `
  npm run init [-- options]

  Interactive by default. Each option answers its question in advance, which
  is what makes this runnable from an IDE run button or a script.

    --name <text>         Program name, as users see it   (required without a terminal)
    --publisher <text>    Company or person publishing it (required without a terminal)
    --repo <owner/name>   GitHub repository for releases  (default: from the git remote)
    --package <name>      npm/Cargo package name          (default: from the name)
    --identifier <id>     Reverse-DNS identifier          (default: com.<publisher>.<package>)
    --description <text>  One sentence about the program  (default: "<name> for Windows.")
    --window <WxH>        Initial window size             (default: 1100x720)
    --key-dir <path>      Where the updater key is written (default: ~/.tauri)
    --yes                 Take the default answer to every confirmation
    --force               Run again on a project that is already set up
    --help                This message
`

/* ----------------------------------------------------------------- output */

const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR
const paint = (code: string) => (text: string) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text)
const bold = paint('1')
const dim = paint('2')
const green = paint('32')
const yellow = paint('33')
const red = paint('31')
const cyan = paint('36')
const say = (line = '') => console.log(line)
const field = (label: string, value: string) => say(`  ${dim(label.padEnd(12))}${value}`)

/* ---------------------------------------------------------------- demo */

/** Paths the demo occupies, relative to the project root. */
const DEMO_PATHS = [
  'src/app/features',
  'src/app/state',
  'src/app/views/WorkbenchView.tsx',
  'src/app/views/WorkbenchSettings.tsx',
  'src-tauri/src/commands/files.rs',
]

/** Starter files that take the demo's place: [source in scripts/starter, destination]. */
const STARTER_FILES: ReadonlyArray<readonly [string, string]> = [
  ['app/index.ts', 'src/app/index.ts'],
  ['app/views/HomeView.tsx', 'src/app/views/HomeView.tsx'],
  ['commands/mod.rs', 'src-tauri/src/commands/mod.rs'],
  ['capabilities/app.json', 'src-tauri/capabilities/app.json'],
]

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  FLAGS = parseArgs(process.argv.slice(2))
  if (FLAGS.help) {
    say(USAGE)
    return
  }

  const files = projectFiles(findProjectRoot())
  const root = files.root
  const show = (path: string) => relative(root, path).replace(/\\/g, '/')

  const currentPackage = String(readJson(files.packageJson).name)
  if (currentPackage !== TEMPLATE_PACKAGE && !FLAGS.force) {
    say()
    say(yellow(`  This project has already been set up: it is "${currentPackage}".`))
    say(dim('  Running init again would replace its identity and generate a new signing key.'))
    say(dim('  If that is really what you want, pass --force.'))
    say()
    process.exitCode = 1
    return
  }

  banner()

  const interactive = process.stdin.isTTY === true
  /*
   * An IDE's run button gives the process no terminal: readline sees end of
   * input at once and the script would either hang or die on a blank answer.
   * Saying so, and naming the options that work instead, avoids that.
   */
  if (!interactive && !(FLAGS.name && FLAGS.publisher)) {
    say(yellow('  No terminal attached, so there is nobody to ask.'))
    say()
    say('  Pass the answers as options instead:')
    say()
    say(`    ${bold('npm run init -- --name "Invoice Studio" --publisher "Acme Creative" --repo acme/invoice-studio --yes')}`)
    say(USAGE)
    process.exitCode = 1
    return
  }

  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null

  try {
    const origin = gitOutput(root, ['remote', 'get-url', 'origin'])
    const answers = await collect(rl, origin)
    const keyDir = FLAGS.keyDir ?? join(homedir(), '.tauri')
    const keyPath = join(keyDir, `${answers.identifier}.key`)

    say()
    say(bold('  Ready to apply'))
    say(dim('  ─────────────'))
    field('name', answers.name)
    field('package', answers.packageName)
    field('identifier', answers.identifier)
    field('publisher', answers.publisher)
    field('description', answers.description)
    field('releases', `https://github.com/${answers.repository}/releases`)
    field('window', `${answers.width}x${answers.height}`)
    field('signing key', `${keyPath} ${dim('(new, outside the repository)')}`)
    field('demo', dim('removed, replaced by an empty Home view'))
    say()

    if (existsSync(keyPath)) {
      // The key is what lets installed copies trust an update. Replacing it
      // silently would cut every existing install off from future updates.
      throw new Error(
        `A signing key already exists at ${keyPath}. It may be signing another program's updates, ` +
          'so it will not be overwritten. Move it, or choose a different --identifier or --key-dir.',
      )
    }

    if (!(await confirm(rl, 'Apply these changes?', true))) {
      say()
      say(dim('  Nothing was written.'))
      return
    }

    /*
     * Read and transform everything BEFORE writing anything. A pattern that
     * fails to match on the fourth of six files would otherwise leave the
     * project half renamed, which is the one state this script must never
     * produce. The key is generated first because it is the step most
     * likely to fail, and it writes nothing inside the repository.
     */
    const cargoToml = readFileSync(files.cargoToml, 'utf8')
    const crate = readTomlPackageField(cargoToml, 'name') ?? TEMPLATE_PACKAGE
    const pending: Array<[string, () => string]> = [
      [files.packageJson, () => formatJson(rewritePackageJson(readJson(files.packageJson), answers))],
      [files.packageLock, () => formatJson(rewritePackageLock(readJson(files.packageLock), answers))],
      [files.cargoToml, () => rewriteCargoToml(cargoToml, answers)],
      [files.cargoLock, () => rewriteCargoLock(readFileSync(files.cargoLock, 'utf8'), crate, answers)],
      [join(root, 'index.html'), () => rewriteIndexHtml(readFileSync(join(root, 'index.html'), 'utf8'), answers)],
      [join(root, 'README.md'), () => programReadme(answers)],
    ]
    const rendered = pending.map(([path, render]) => [path, render()] as const)

    say()
    const { pubkey, password } = generateSigningKey(root, keyPath)
    say(green(`  generated the updater signing key at ${keyPath}`))

    const config = formatJson(rewriteTauriConfig(readJson(files.tauriConfig), answers, pubkey))
    for (const [path, text] of [...rendered, [files.tauriConfig, config] as const]) {
      writeText(path, text)
      say(green(`  wrote ${show(path)}`))
    }

    for (const path of DEMO_PATHS) rmSync(join(root, path), { recursive: true, force: true })
    for (const [source, destination] of STARTER_FILES) {
      const target = join(root, destination)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(join(root, 'scripts', 'starter', source), target)
    }
    say(green('  removed the demo and put an empty Home view in its place'))

    regenerateBindings(root)
    await offerTemplateRemote(rl, root, origin)
    nextSteps(answers, keyPath, password)
  } finally {
    rl?.close()
  }
}

/* -------------------------------------------------------------- questions */

async function collect(rl: Interface | null, origin: string | undefined): Promise<Answers> {
  const name = await ask(rl, { label: 'Program name', hint: 'as people will see it', flag: FLAGS.name, parse: checkName })

  const publisher = await ask(rl, {
    label: 'Publisher',
    hint: 'company or person, shown in the installer',
    flag: FLAGS.publisher,
    parse: checkText('publisher', 80),
  })

  const packageName = await ask(rl, {
    label: 'Package name',
    hint: 'npm and Cargo',
    flag: FLAGS.packageName,
    fallback: slugify(name),
    parse: checkPackageName,
  })

  const identifier = await ask(rl, {
    label: 'Identifier',
    hint: 'reverse-DNS; hard to change after release',
    flag: FLAGS.identifier,
    fallback: suggestIdentifier(publisher, packageName),
    parse: checkIdentifier,
  })

  const description = await ask(rl, {
    label: 'Description',
    hint: 'one sentence',
    flag: FLAGS.description,
    fallback: `${name} for Windows.`,
    parse: checkText('description', 200),
  })

  // A clone of the template still points `origin` at the template itself,
  // which is exactly where this program's releases must not go.
  const fromOrigin = origin ? repositoryFromRemote(origin) : undefined
  const owner = fromOrigin?.split('/')[0] ?? 'your-account'
  const suggestedRepo =
    fromOrigin && fromOrigin.toLowerCase() !== TEMPLATE_REPOSITORY ? fromOrigin : `${owner}/${packageName}`

  const repository = await ask(rl, {
    label: 'GitHub repository',
    hint: 'owner/name, where releases are published',
    flag: FLAGS.repository,
    fallback: suggestedRepo,
    parse: checkRepository,
  })

  const size = await ask(rl, {
    label: 'Window size',
    hint: 'width x height',
    flag: FLAGS.window,
    fallback: '1100x720',
    parse: checkWindowSize,
  })
  const [width, height] = size.split('x').map(Number) as [number, number]

  return { name, packageName, identifier, publisher, description, repository, width, height }
}

interface Question {
  label: string
  hint?: string
  /** Supplied on the command line; skips the prompt. */
  flag?: string
  /** Offered as the default, and used when there is no terminal. */
  fallback?: string
  parse(raw: string): Check
}

/**
 * Asks until the answer validates. An option or a non-interactive run takes
 * the same validation path: a bad --identifier must fail here, before
 * anything has been written.
 */
async function ask(rl: Interface | null, question: Question): Promise<string> {
  const supplied = question.flag ?? (rl ? undefined : question.fallback)
  if (supplied !== undefined) {
    const parsed = question.parse(supplied)
    if (parsed.ok) return parsed.value
    throw new Error(`${question.label}: ${parsed.error}`)
  }
  if (!rl) throw new Error(`${question.label} is required. Pass it as an option; see --help.`)

  const suffix = question.hint ? dim(` (${question.hint})`) : ''
  const shown = question.fallback ? dim(` [${question.fallback}]`) : ''
  for (;;) {
    const raw = (await rl.question(`  ${bold(question.label)}${suffix}${shown}: `)).trim()
    const parsed = question.parse(raw === '' && question.fallback ? question.fallback : raw)
    if (parsed.ok) return parsed.value
    say(`  ${red('×')} ${parsed.error}`)
  }
}

/** `--yes` and a missing terminal both take the default answer, which is not always yes. */
async function confirm(rl: Interface | null, prompt: string, defaultYes: boolean): Promise<boolean> {
  if (FLAGS.yes || !rl) return defaultYes
  const hint = defaultYes ? 'Y/n' : 'y/N'
  for (;;) {
    const raw = (await rl.question(`  ${prompt} ${dim(`(${hint})`)} `)).trim().toLowerCase()
    if (raw === '') return defaultYes
    if (['y', 'yes'].includes(raw)) return true
    if (['n', 'no'].includes(raw)) return false
  }
}

/* ----------------------------------------------------------------- steps */

/**
 * A fresh minisign keypair for this program's updates. The private key and
 * its password never enter the repository: they belong in GitHub Actions
 * secrets, and the key file stays on this machine as the backup.
 */
function generateSigningKey(root: string, keyPath: string): { pubkey: string; password: string } {
  mkdirSync(dirname(keyPath), { recursive: true })
  const password = randomBytes(24).toString('base64url')
  const cli = join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
  if (!existsSync(cli)) throw new Error('The Tauri CLI is not installed yet. Run npm install first.')

  execFileSync(process.execPath, [cli, 'signer', 'generate', '--ci', '-p', password, '-w', keyPath], {
    stdio: 'pipe',
  })
  const pubkey = readFileSync(`${keyPath}.pub`, 'utf8').trim()
  if (pubkey === '') throw new Error(`No public key was written next to ${keyPath}`)
  return { pubkey, password }
}

/**
 * src/app/bindings.ts still describes the demo's commands until the Rust
 * side regenerates it. That needs Cargo; without it, say what to run.
 */
function regenerateBindings(root: string): void {
  say(dim('  regenerating the TypeScript bindings (this compiles the Rust side, and can take a minute)...'))
  try {
    execFileSync('cargo', ['test', '--manifest-path', join(root, 'src-tauri', 'Cargo.toml'), '--lib', 'bindings::tests::export', '--', '--exact'], {
      cwd: root,
      stdio: 'pipe',
    })
    say(green('  regenerated src/app/bindings.ts'))
  } catch {
    say(yellow('  could not regenerate src/app/bindings.ts; run npm run bindings once Rust is installed'))
  }
}

/**
 * Offered, never assumed. A program cloned from the template should keep the
 * template as a second remote, so later improvements can be pulled in:
 * `git pull template main`. Renaming `origin` makes room for the program's
 * own repository.
 */
async function offerTemplateRemote(rl: Interface | null, root: string, origin: string | undefined): Promise<void> {
  if (!origin || repositoryFromRemote(origin)?.toLowerCase() !== TEMPLATE_REPOSITORY) return
  if (gitOutput(root, ['remote', 'get-url', 'template'])) return

  say()
  if (await confirm(rl, 'Rename the git remote "origin" to "template", so template updates can still be pulled?', true)) {
    try {
      execFileSync('git', ['remote', 'rename', 'origin', 'template'], { cwd: root, stdio: 'pipe' })
      say(green('  renamed origin to template'))
    } catch (error) {
      say(red(`  could not rename the remote: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`))
    }
  }
}

function gitOutput(root: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim() || undefined
  } catch {
    return undefined
  }
}

/* ----------------------------------------------------------------- chrome */

function banner(): void {
  say()
  say(`  ${bold('Set up a new program')}`)
  say(dim('  ────────────────────'))
  say(dim('  Press enter to accept a default. Nothing is written until the end.'))
  say()
}

function nextSteps(answers: Answers, keyPath: string, password: string): void {
  say()
  say(`  ${bold(`${answers.name} is set up.`)}`)
  say()
  say(yellow('  Store these now. They are not written anywhere else.'))
  say(`    Updater key password: ${bold(password)}`)
  say(dim(`    Private key file:     ${keyPath}`))
  say(dim('    Keep both in a password manager. If either is lost, installed copies can never'))
  say(dim('    be updated again; people would have to reinstall.'))
  say()
  say(dim('  1  Run it'))
  say(`       ${cyan('npm run dev')}`)
  say()
  say(dim('  2  Create the GitHub repository and push'))
  say(`       ${cyan(`gh repo create ${answers.repository} --private --source . --push`)}`)
  say()
  say(dim('  3  Give the release workflow the signing key (the second command asks for the password)'))
  // PowerShell has no `<` redirection, so the key is piped in there instead.
  const setKey =
    process.platform === 'win32'
      ? `Get-Content -Raw "${keyPath}" | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo ${answers.repository}`
      : `gh secret set TAURI_SIGNING_PRIVATE_KEY --repo ${answers.repository} < "${keyPath}"`
  say(`       ${cyan(setKey)}`)
  say(`       ${cyan(`gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo ${answers.repository}`)}`)
  say()
  say(dim('  4  Make it yours'))
  say(`       •  Replace ${cyan('app-icon.svg')}, then run ${cyan('npm run tauri icon app-icon.svg')}`)
  say(`       •  Build the program in ${cyan('src/app/')}, with native commands in ${cyan('src-tauri/src/commands/')}`)
  say()
  say(`  ${cyan('docs/CUSTOMIZATION.md')} ${dim('walks through adding a view, a command and a permission.')}`)
  say(`  ${cyan('docs/RELEASING.md')} ${dim('covers code signing and the first release.')}`)
  say()
}

/* ----------------------------------------------------------------- pieces */

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { yes: false, force: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const value = () => argv[++i] ?? ''
    switch (argv[i]) {
      case '--name': flags.name = value(); break
      case '--publisher': flags.publisher = value(); break
      case '--repo':
      case '--repository': flags.repository = value(); break
      case '--package': flags.packageName = value(); break
      case '--identifier': flags.identifier = value(); break
      case '--description': flags.description = value(); break
      case '--window': flags.window = value(); break
      case '--key-dir': flags.keyDir = value(); break
      case '--yes':
      case '-y': flags.yes = true; break
      case '--force': flags.force = true; break
      case '--help':
      case '-h': flags.help = true; break
      default:
        throw new Error(`Unknown option ${argv[i]}. See --help.`)
    }
  }
  return flags
}

function wasCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || /readline was closed/i.test(error.message)
}

main().catch((error: unknown) => {
  // Ctrl-C and Ctrl-D land here: readline rejects the pending question. That
  // is a cancellation, and printing a stack trace for it reads as a crash.
  if (wasCancelled(error)) {
    say()
    say(dim('  Cancelled. Nothing was written.'))
    say()
    process.exitCode = 130
    return
  }
  say()
  say(red(bold('  Setup did not finish.')))
  say()
  say(`  ${error instanceof Error ? error.message : String(error)}`)
  say()
  say(dim('  Nothing in the project was written unless a file was reported as written above.'))
  say()
  process.exitCode = 1
})
