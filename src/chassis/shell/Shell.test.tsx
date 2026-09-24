import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlaskConicalIcon, WrenchIcon } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSettings, memoryBackend, resetSettingsForTests } from '../settings/settings'
import type { AppDefinition } from '../types'
import { Shell } from './Shell'

function Crashes(): never {
  throw new Error('boom')
}

const app: AppDefinition = {
  views: [
    { id: 'first', label: 'First', icon: FlaskConicalIcon, component: () => <p>first view content</p> },
    { id: 'broken', label: 'Broken', icon: WrenchIcon, component: Crashes },
  ],
}

const identity = { name: 'Test Program', version: '1.2.3' }

const pageOf = (text: string) => screen.getByText(text).closest('section')

beforeEach(async () => {
  resetSettingsForTests()
  await loadSettings(memoryBackend())
  // React and the error boundary both report the deliberate crash.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Shell', () => {
  it('opens on the first view, with the program name in the sidebar', () => {
    render(<Shell app={app} identity={identity} />)
    expect(screen.getByRole('navigation', { name: 'Main' }).textContent).toContain('Test Program')
    expect(pageOf('first view content')?.hidden).toBe(false)
    expect(screen.getByRole('button', { name: 'First' }).getAttribute('aria-current')).toBe('page')
  })

  it('contains a crashing view, leaving the sidebar and other views working', async () => {
    const user = userEvent.setup()
    render(<Shell app={app} identity={identity} />)

    await user.click(screen.getByRole('button', { name: 'Broken' }))
    expect(screen.getByRole('heading', { name: 'Something went wrong here' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'First' }))
    expect(pageOf('first view content')?.hidden).toBe(false)
  })

  it('always offers Settings, with the version on it', async () => {
    const user = userEvent.setup()
    render(<Shell app={app} identity={identity} />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy()
    expect(screen.getByText('You have version 1.2.3.')).toBeTruthy()
  })

  it('keeps a visited view mounted, so its state survives a trip to Settings', async () => {
    const user = userEvent.setup()
    render(<Shell app={app} identity={identity} />)
    const firstPage = pageOf('first view content')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(firstPage?.isConnected).toBe(true)
    expect(firstPage?.hidden).toBe(true)
  })
})
