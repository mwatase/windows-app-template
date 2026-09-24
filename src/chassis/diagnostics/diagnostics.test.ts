import { describe, expect, it } from 'vitest'

import { formatDiagnostics } from './diagnostics'

const native = {
  appName: 'Invoice Studio',
  appVersion: '1.4.2',
  identifier: 'com.example.invoices',
  tauriVersion: '2.11.6',
  webviewVersion: '140.0.3485.54',
  os: 'Windows 10.0.19045 [64-bit]',
  arch: 'x86_64',
  logFile: 'C:\\Users\\someone\\AppData\\Local\\com.example.invoices\\logs\\app.log',
  recentLog: '[2026-09-24][10:00:00][INFO] started\n[2026-09-24][10:00:05][ERROR] command failed [not_found]',
}

const webview = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/140',
  language: 'en-US',
  display: '1920x1080 at 1.25x',
  generatedAt: new Date('2026-09-24T10:01:00Z'),
}

describe('formatDiagnostics', () => {
  it('puts everything a support conversation needs into one block of text', () => {
    const text = formatDiagnostics(native, webview)

    expect(text.split('\n')[0]).toBe('Invoice Studio 1.4.2 (com.example.invoices)')
    for (const expected of [
      'Generated 2026-09-24T10:01:00.000Z',
      'OS:        Windows 10.0.19045 [64-bit]',
      'WebView2:  140.0.3485.54',
      'Language:  en-US',
      `Log file: ${native.logFile}`,
      'command failed [not_found]',
    ]) {
      expect(text).toContain(expected)
    }
  })

  it('says so when the log is empty rather than printing nothing', () => {
    expect(formatDiagnostics({ ...native, recentLog: '' }, webview)).toContain('(empty)')
  })
})
