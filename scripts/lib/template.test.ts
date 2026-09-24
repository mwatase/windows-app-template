// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  checkIdentifier,
  checkName,
  checkPackageName,
  checkRepository,
  checkWindowSize,
  programReadme,
  repositoryFromRemote,
  rewriteIndexHtml,
  rewritePackageJson,
  rewriteTauriConfig,
  slugify,
  suggestIdentifier,
  type Answers,
} from './template'

const answers: Answers = {
  name: 'Invoice Studio',
  packageName: 'invoice-studio',
  identifier: 'com.acmecreative.invoicestudio',
  publisher: 'Acme Creative',
  description: 'Invoices for Acme.',
  repository: 'acme/invoice-studio',
  width: 1280,
  height: 800,
}

const valid = (check: { ok: boolean }) => check.ok

describe('answers are validated before anything is written', () => {
  it('program names must be valid Windows file names', () => {
    expect(valid(checkName('Invoice Studio'))).toBe(true)
    expect(valid(checkName('Invoices: 2026'))).toBe(false)
    expect(valid(checkName('Invoices.'))).toBe(false)
    expect(valid(checkName('CON'))).toBe(false)
    expect(valid(checkName('   '))).toBe(false)
  })

  it('package names are lowercase kebab case, and not the template’s', () => {
    expect(valid(checkPackageName('invoice-studio'))).toBe(true)
    expect(valid(checkPackageName('Invoice-Studio'))).toBe(false)
    expect(valid(checkPackageName('invoice--studio'))).toBe(false)
    expect(valid(checkPackageName('windows-app-template'))).toBe(false)
  })

  it('identifiers are reverse-DNS, not the template’s, and never end in .app', () => {
    expect(valid(checkIdentifier('com.acme.invoicestudio'))).toBe(true)
    expect(valid(checkIdentifier('invoicestudio'))).toBe(false)
    expect(valid(checkIdentifier('com.acme.invoices.app'))).toBe(false)
    expect(valid(checkIdentifier('com.mwatase.windowsapptemplate'))).toBe(false)
  })

  it('releases never go to the template repository', () => {
    expect(checkRepository('https://github.com/acme/invoice-studio.git')).toEqual({
      ok: true,
      value: 'acme/invoice-studio',
    })
    expect(valid(checkRepository('mwatase/windows-app-template'))).toBe(false)
    expect(valid(checkRepository('invoice-studio'))).toBe(false)
  })

  it('window sizes are parsed and bounded', () => {
    expect(checkWindowSize('1280 x 800')).toEqual({ ok: true, value: '1280x800' })
    expect(valid(checkWindowSize('200x100'))).toBe(false)
    expect(valid(checkWindowSize('big'))).toBe(false)
  })
})

describe('defaults', () => {
  it('derives a package name and an identifier', () => {
    expect(slugify('Invoice Studio & Co.')).toBe('invoice-studio-and-co')
    expect(slugify('3D Viewer')).toBe('app-3d-viewer')
    expect(suggestIdentifier('Acme Creative', 'invoice-studio')).toBe('com.acmecreative.invoicestudio')
  })

  it('reads owner/name from every spelling of a GitHub remote', () => {
    expect(repositoryFromRemote('https://github.com/acme/invoice-studio.git')).toBe('acme/invoice-studio')
    expect(repositoryFromRemote('git@github.com:acme/invoice-studio.git')).toBe('acme/invoice-studio')
    expect(repositoryFromRemote('https://gitlab.com/acme/invoice-studio')).toBeUndefined()
  })
})

describe('transforms', () => {
  const config = {
    productName: 'Windows App Template',
    version: '0.3.0',
    identifier: 'com.mwatase.windowsapptemplate',
    app: { windows: [{ label: 'main', title: 'Windows App Template', width: 1100, height: 720 }], security: {} },
    bundle: { targets: ['nsis', 'msi'], publisher: 'mwatase' },
    plugins: { updater: { pubkey: 'PLACEHOLDER', endpoints: ['https://x.test'], windows: { installMode: 'passive' } } },
  }

  it('gives tauri.conf.json the new identity, key and release feed, keeping everything else', () => {
    const next = rewriteTauriConfig(config, answers, 'PUBKEY') as typeof config
    expect(next.productName).toBe('Invoice Studio')
    expect(next.version).toBe('0.1.0')
    expect(next.identifier).toBe('com.acmecreative.invoicestudio')
    expect(next.app.windows[0]).toEqual({ label: 'main', title: 'Invoice Studio', width: 1280, height: 800 })
    expect(next.bundle.targets).toEqual(['nsis', 'msi'])
    expect(next.plugins.updater).toEqual({
      pubkey: 'PUBKEY',
      endpoints: ['https://github.com/acme/invoice-studio/releases/latest/download/latest.json'],
      windows: { installMode: 'passive' },
    })
  })

  it('renames package.json and resets the version', () => {
    expect(rewritePackageJson({ name: 'windows-app-template', version: '0.3.0', scripts: {} }, answers)).toEqual({
      name: 'invoice-studio',
      version: '0.1.0',
      description: 'Invoices for Acme.',
      author: 'Acme Creative',
      scripts: {},
    })
  })

  it('escapes the name into index.html', () => {
    const html = rewriteIndexHtml('<title>Windows App Template</title>', { ...answers, name: 'R&D <Tools>' })
    expect(html).toBe('<title>R&amp;D &lt;Tools&gt;</title>')
  })

  it('writes a README that points at the program’s own releases', () => {
    const readme = programReadme(answers)
    expect(readme.startsWith('# Invoice Studio\n')).toBe(true)
    expect(readme).toContain('https://github.com/acme/invoice-studio/releases')
  })
})
