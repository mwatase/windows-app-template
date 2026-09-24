import { useState } from 'react'
import { SettingsIcon } from 'lucide-react'

import { Toaster } from '@/ui'

import { ErrorBoundary } from '../errors/ErrorBoundary'
import { SettingsView } from '../settings/SettingsView'
import { useThemeSync } from '../settings/theme'
import type { AppDefinition, AppIdentity } from '../types'
import { UpdateBanner } from '../updater/UpdateBanner'
import { IdentityContext } from './identity'
import { Sidebar, type NavItem } from './Sidebar'

const SETTINGS: NavItem & { description: string } = {
  id: 'chassis.settings',
  label: 'Settings',
  description: 'Preferences, updates and support.',
  icon: SettingsIcon,
}

/**
 * The window's frame: sidebar, the current view, the update banner and the
 * toasts. The native title bar is kept rather than replaced with a custom
 * one: it gives Windows 11 snap layouts, correct behaviour under assistive
 * technology and a frame that matches every other app, for free.
 */
export function Shell({ app, identity }: { app: AppDefinition; identity: AppIdentity }) {
  const theme = useThemeSync()
  const first = app.views[0].id
  const [active, setActive] = useState(first)
  // Views stay mounted once visited, so moving to Settings and back does not
  // throw away half-finished work in the view the user came from.
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([first]))

  const select = (id: string) => {
    setActive(id)
    setVisited((previous) => (previous.has(id) ? previous : new Set(previous).add(id)))
  }

  const pages = [
    ...app.views.map((view) => ({ ...view, render: () => <view.component /> })),
    { ...SETTINGS, render: () => <SettingsView programSettings={app.settings} /> },
  ]

  return (
    <IdentityContext.Provider value={identity}>
      <div className="flex h-full">
        <Sidebar name={identity.name} items={app.views} footer={[SETTINGS]} active={active} onSelect={select} />
        <main className="flex min-w-0 flex-1 flex-col">
          <UpdateBanner />
          {pages
            .filter((page) => visited.has(page.id))
            .map((page) => (
              <section
                key={page.id}
                hidden={page.id !== active}
                aria-labelledby={`${page.id}-title`}
                className="flex min-h-0 flex-1 flex-col"
              >
                <header className="border-b border-border px-8 py-5">
                  <h1 id={`${page.id}-title`} className="text-xl font-semibold tracking-tight">
                    {page.label}
                  </h1>
                  {page.description ? <p className="mt-1 text-sm text-muted-foreground">{page.description}</p> : null}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ErrorBoundary area={`view "${page.id}"`}>{page.render()}</ErrorBoundary>
                </div>
              </section>
            ))}
        </main>
      </div>
      <Toaster theme={theme} />
    </IdentityContext.Provider>
  )
}
