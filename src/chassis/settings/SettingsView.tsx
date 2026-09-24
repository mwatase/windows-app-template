import { useEffect, useId, useState, type ComponentType } from 'react'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { ClipboardCopyIcon, RefreshCwIcon } from 'lucide-react'

import {
  Button,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from '@/ui'

import { copyDiagnostics } from '../diagnostics/diagnostics'
import { reportError } from '../errors/report'
import { formatForLog, logger } from '../logging/logger'
import { useAppIdentity } from '../shell/identity'
import { updater, useUpdateState } from '../updater/updater'
import { THEME_PREFERENCES, chassisSettings, type ThemePreference } from './chassis-settings'
import { SettingsRow, SettingsSection } from './SettingsLayout'
import { useSetting } from './settings'

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Match Windows',
  light: 'Light',
  dark: 'Dark',
}

/** The chassis-owned Settings page, with the program's section inserted. */
export function SettingsView({ programSettings: ProgramSettings }: { programSettings?: ComponentType }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-8 py-6">
      <AppearanceSection />
      <BehaviourSection />
      <UpdatesSection />
      {ProgramSettings ? <ProgramSettings /> : null}
      <SupportSection />
    </div>
  )
}

function AppearanceSection() {
  const [theme, setTheme] = useSetting(chassisSettings, 'theme')
  const id = useId()

  return (
    <SettingsSection title="Appearance">
      <SettingsRow label="Theme" htmlFor={id}>
        <Select value={theme} onValueChange={(value) => void setTheme(value as ThemePreference)}>
          <SelectTrigger id={id} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEME_PREFERENCES.map((preference) => (
              <SelectItem key={preference} value={preference}>
                {THEME_LABELS[preference]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
    </SettingsSection>
  )
}

function BehaviourSection() {
  const [closeToTray, setCloseToTray] = useSetting(chassisSettings, 'closeToTray')
  const [launchAtLogin, setLaunchAtLogin] = useLaunchAtLogin()
  const loginId = useId()
  const trayId = useId()

  // A development build lives in a build folder and changes on every
  // compile. Registering it to start with Windows would leave a stale entry.
  const devBuild = import.meta.env.DEV

  return (
    <SettingsSection title="Behaviour">
      <SettingsRow
        label="Launch at login"
        htmlFor={loginId}
        description={devBuild ? 'Available in the installed app, not in development builds.' : 'Start the app when you sign in to Windows.'}
      >
        <Switch
          id={loginId}
          checked={launchAtLogin ?? false}
          disabled={devBuild || launchAtLogin === null}
          onCheckedChange={(checked) => void setLaunchAtLogin(checked)}
        />
      </SettingsRow>
      <SettingsRow
        label="Keep running in the tray"
        htmlFor={trayId}
        description="Closing the window hides it; quit from the tray icon's menu."
      >
        <Switch id={trayId} checked={closeToTray} onCheckedChange={(checked) => void setCloseToTray(checked)} />
      </SettingsRow>
    </SettingsSection>
  )
}

/** Launch-at-login lives in Windows, not in the settings file, so it is read from there. */
function useLaunchAtLogin(): [boolean | null, (enabled: boolean) => Promise<void>] {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let current = true
    isEnabled().then(
      (value) => {
        if (current) setEnabled(value)
      },
      (error: unknown) => logger.warn(`could not read the launch at login state: ${formatForLog(error)}`),
    )
    return () => {
      current = false
    }
  }, [])

  const update = async (next: boolean) => {
    try {
      await (next ? enable() : disable())
      setEnabled(await isEnabled())
    } catch (error) {
      reportError(error, 'Could not change launch at login')
    }
  }

  return [enabled, update]
}

function UpdatesSection() {
  const identity = useAppIdentity()
  const [automatic, setAutomatic] = useSetting(chassisSettings, 'checkForUpdates')
  const state = useUpdateState()
  const id = useId()

  const status = (() => {
    switch (state.status) {
      case 'checking':
        return 'Checking for updates...'
      case 'current':
        return 'You have the latest version.'
      case 'available':
        return `Version ${state.update.version} is available.`
      case 'downloading':
        return `Downloading version ${state.update.version}...`
      case 'failed':
        return state.message
      case 'idle':
        return `You have version ${identity.version}.`
    }
  })()

  const percent =
    state.status === 'downloading' && state.total ? Math.round((state.received / state.total) * 100) : null

  return (
    <SettingsSection title="Updates">
      <SettingsRow label="Check for updates automatically" htmlFor={id}>
        <Switch id={id} checked={automatic} onCheckedChange={(checked) => void setAutomatic(checked)} />
      </SettingsRow>
      <SettingsRow
        label="Current version"
        description={
          <span role="status" aria-live="polite">
            {status}
          </span>
        }
      >
        {state.status === 'available' ? (
          <Button size="sm" onClick={() => void updater.install()}>
            Install and restart
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            loading={state.status === 'checking'}
            disabled={state.status === 'downloading'}
            onClick={() => void updater.checkNow({ userInitiated: true })}
          >
            {state.status === 'checking' ? null : <RefreshCwIcon aria-hidden="true" />}
            Check now
          </Button>
        )}
      </SettingsRow>
      {state.status === 'downloading' ? (
        <div className="px-4 py-3">
          <Progress value={percent} aria-label="Update download progress" />
        </div>
      ) : null}
    </SettingsSection>
  )
}

function SupportSection() {
  const [copying, setCopying] = useState(false)

  const copy = async () => {
    setCopying(true)
    try {
      await copyDiagnostics()
      toast.success('Diagnostic info copied', { description: 'Paste it into a message to support.' })
    } catch (error) {
      reportError(error, 'Could not copy the diagnostic info')
    } finally {
      setCopying(false)
    }
  }

  return (
    <SettingsSection title="Support">
      <SettingsRow
        label="Diagnostic info"
        description="Copies this app's version, your Windows version and the recent log, ready to paste into an email to support. Nothing is sent anywhere."
      >
        <Button size="sm" variant="outline" loading={copying} onClick={() => void copy()}>
          {copying ? null : <ClipboardCopyIcon aria-hidden="true" />}
          Copy diagnostic info
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
