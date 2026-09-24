import { useCallback, useEffect, useState } from 'react'
import { FileTextIcon, FolderOpenIcon } from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { open } from '@tauri-apps/plugin-dialog'

import { formatForLog, logger, reportError, unwrap } from '@/chassis'
import { Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@/ui'

import { commands, type TextFileSummary } from '../../bindings'

/**
 * DEMO: reads a file the user chose, in Rust.
 *
 * The path comes from the file dialog or from a drop anywhere on the window.
 * Both put the path into the filesystem scope, which is what the native
 * command checks before it reads anything (see src-tauri/src/commands/files.rs).
 */
export function FileCard({ className }: { className?: string }) {
  const [summary, setSummary] = useState<TextFileSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const inspect = useCallback(async (path: string) => {
    setBusy(true)
    try {
      setSummary(await unwrap(commands.inspectTextFile(path)))
    } catch (error) {
      reportError(error, 'Could not open the file')
    } finally {
      setBusy(false)
    }
  }, [])

  const choose = async () => {
    try {
      const path = await open({ title: 'Choose a text file', multiple: false, directory: false })
      if (path) await inspect(path)
    } catch (error) {
      reportError(error, 'Could not show the file picker')
    }
  }

  useEffect(() => {
    if (!isTauri()) return
    let stop: (() => void) | undefined
    let disposed = false

    getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === 'enter' || payload.type === 'over') setDragging(true)
        else if (payload.type === 'leave') setDragging(false)
        else {
          setDragging(false)
          const [first] = payload.paths
          if (first) void inspect(first)
        }
      })
      .then(
        (unlisten) => {
          if (disposed) unlisten()
          else stop = unlisten
        },
        (error: unknown) => logger.warn(`could not listen for dropped files: ${formatForLog(error)}`),
      )

    return () => {
      disposed = true
      stop?.()
    }
  }, [inspect])

  return (
    <Card className={cn(dragging && 'border-primary ring-[3px] ring-primary/30', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-primary" aria-hidden="true" />
          Read a file
        </CardTitle>
        <CardDescription>
          Choose a text file, or drop one anywhere on this window. Rust reads it off the interface thread and sends
          back a typed summary.
        </CardDescription>
        <CardAction>
          <Button variant="outline" onClick={() => void choose()} loading={busy}>
            {busy ? null : <FolderOpenIcon aria-hidden="true" />}
            Choose a file
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-3">
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Fact label="File" value={summary.name} />
              <Fact label="Size" value={formatBytes(summary.sizeBytes)} />
              <Fact label="Lines" value={summary.lines.toLocaleString()} />
              <Fact label="Words" value={summary.words.toLocaleString()} />
            </dl>
            <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap select-text">
              {summary.preview}
              {summary.truncated ? '\n...' : ''}
            </pre>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground',
              dragging && 'border-primary text-foreground',
            )}
          >
            {dragging ? 'Drop to read it' : 'No file yet'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
