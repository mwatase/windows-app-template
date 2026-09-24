import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ClipboardCopyIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react'

import { Button, toast } from '@/ui'

import { copyDiagnostics } from '../diagnostics/diagnostics'
import { formatForLog, logger } from '../logging/logger'

interface Props {
  children: ReactNode
  /** Names the region in the log, so a crash report says where it happened. */
  area: string
}

interface State {
  error: Error | null
}

/**
 * Catches an interface crash and shows a way forward instead of a blank
 * window. The shell wraps each view in one, so a broken view leaves the
 * sidebar and every other view working.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    logger.error(`interface crashed in ${this.props.area}: ${formatForLog(error)}\n${info.componentStack ?? ''}`)
  }

  private readonly retry = () => this.setState({ error: null })

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return <RecoveryScreen onRetry={this.retry} />
  }
}

function RecoveryScreen({ onRetry }: { onRetry: () => void }) {
  const copy = () => {
    copyDiagnostics().then(
      () => toast.success('Diagnostic info copied', { description: 'Paste it into a message to support.' }),
      (error: unknown) => {
        logger.error(`could not copy diagnostics: ${formatForLog(error)}`)
        toast.error('Could not copy the diagnostic info')
      },
    )
  }

  return (
    <div role="alert" className="flex h-full min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
      <TriangleAlertIcon className="size-10 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Something went wrong here</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This part of the app stopped working. The problem has been written to the log. Trying again usually
          helps; if it keeps happening, send the diagnostic info to support.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onRetry}>
          <RotateCcwIcon aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload the window
        </Button>
        <Button variant="ghost" onClick={copy}>
          <ClipboardCopyIcon aria-hidden="true" />
          Copy diagnostic info
        </Button>
      </div>
    </div>
  )
}
