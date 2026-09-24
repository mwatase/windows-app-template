import { DownloadIcon, TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle, Button, Progress } from '@/ui'

import { updater, useUpdateState } from './updater'

/** Offers an available update. Shown above every view; absent otherwise. */
export function UpdateBanner() {
  const state = useUpdateState()

  if (state.status === 'available') {
    return (
      <Alert role="status" className="rounded-none border-x-0 border-t-0">
        <DownloadIcon aria-hidden="true" />
        <AlertTitle>Version {state.update.version} is available</AlertTitle>
        <AlertDescription>
          <p>You have {state.update.currentVersion}. The app restarts to finish installing.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void updater.install()}>
              Install and restart
            </Button>
            <Button size="sm" variant="ghost" onClick={updater.dismiss}>
              Later
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (state.status === 'downloading') {
    const percent = state.total ? Math.min(100, Math.round((state.received / state.total) * 100)) : null
    return (
      <Alert role="status" className="rounded-none border-x-0 border-t-0">
        <DownloadIcon aria-hidden="true" />
        <AlertTitle>
          Downloading version {state.update.version}
          {percent === null ? '' : ` - ${percent}%`}
        </AlertTitle>
        <AlertDescription>
          <Progress value={percent} aria-label="Update download progress" className="mt-1 max-w-sm" />
        </AlertDescription>
      </Alert>
    )
  }

  if (state.status === 'failed' && state.update) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle>{state.message}</AlertTitle>
        <AlertDescription>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void updater.install()}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={updater.dismiss}>
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
