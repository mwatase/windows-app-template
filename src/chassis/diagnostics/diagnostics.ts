import { commands, type Diagnostics } from '../bindings'
import { unwrap } from '../errors/errors'

/**
 * "Copy diagnostic info": everything a support conversation would otherwise
 * have to ask for, as one block of text for the customer to paste into an
 * email. The native side supplies the build, OS and log; the webview adds
 * what only it can see.
 */

export interface WebviewEnvironment {
  userAgent: string
  language: string
  display: string
  generatedAt: Date
}

export function currentEnvironment(): WebviewEnvironment {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    display: `${window.screen.width}x${window.screen.height} at ${window.devicePixelRatio}x`,
    generatedAt: new Date(),
  }
}

export function formatDiagnostics(native: Diagnostics, webview: WebviewEnvironment): string {
  const row = (label: string, value: string) => `  ${`${label}:`.padEnd(11)}${value}`
  return [
    `${native.appName} ${native.appVersion} (${native.identifier})`,
    `Generated ${webview.generatedAt.toISOString()}`,
    '',
    'System',
    row('OS', native.os),
    row('Arch', native.arch),
    row('WebView2', native.webviewVersion),
    row('Tauri', native.tauriVersion),
    row('Language', webview.language),
    row('Display', webview.display),
    row('Agent', webview.userAgent),
    '',
    `Log file: ${native.logFile}`,
    '',
    'Recent log',
    '----------',
    native.recentLog === '' ? '(empty)' : native.recentLog,
    '',
  ].join('\n')
}

export async function collectDiagnostics(): Promise<string> {
  return formatDiagnostics(await unwrap(commands.getDiagnostics()), currentEnvironment())
}

/** Puts the report on the clipboard. Resolves once it is there. */
export async function copyDiagnostics(): Promise<void> {
  await writeClipboard(await collectDiagnostics())
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // The async clipboard API needs focus and a secure context. When a
    // webview refuses it, the older selection-based copy still works.
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.append(field)
    field.select()
    const copied = document.execCommand('copy')
    field.remove()
    if (!copied) throw new Error('the clipboard is not available')
  }
}
