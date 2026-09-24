import { useState } from 'react'
import { GlobeIcon } from 'lucide-react'

import { reportError, useSetting } from '@/chassis'
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui'

import { workbenchSettings } from '../../state/settings'
import { fetchLatestRelease, type Release } from './github'

/** DEMO: calls a web API through the chassis's HTTP client. */
export function ReleaseCard() {
  const [repository] = useSetting(workbenchSettings, 'repository')
  const [release, setRelease] = useState<Release | null>(null)
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    try {
      setRelease(await fetchLatestRelease(repository))
    } catch (error) {
      setRelease(null)
      reportError(error, 'Could not check for a release')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GlobeIcon className="size-4 text-primary" aria-hidden="true" />
          Call an API
        </CardTitle>
        <CardDescription>
          Asks GitHub for the latest release of <span className="font-medium text-foreground">{repository}</span>,
          through the native HTTP client with a timeout and retries. The repository is a saved setting: change it
          in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {release ? (
          // minmax(0, 1fr): a plain 1fr column never shrinks below its
          // content, so a long URL would push out of the card instead of
          // truncating.
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Release</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <Badge variant="secondary">{release.tag}</Badge>
              <span className="truncate">{release.name}</span>
            </dd>
            <dt className="text-muted-foreground">Published</dt>
            <dd>{release.publishedAt ? release.publishedAt.toLocaleDateString() : 'Unknown'}</dd>
            <dt className="text-muted-foreground">Page</dt>
            <dd className="truncate font-mono text-xs select-text">{release.url}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No release fetched yet.</p>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={() => void check()} loading={checking}>
          Check latest release
        </Button>
      </CardFooter>
    </Card>
  )
}
