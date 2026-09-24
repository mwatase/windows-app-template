import { FileCard } from '../features/files/FileCard'
import { ReleaseCard } from '../features/network/ReleaseCard'
import { NotificationCard } from '../features/notifications/NotificationCard'

/**
 * DEMO: one card per capability the chassis wires in. It proves the template
 * works end to end on a real machine, and `npm run init` replaces it with an
 * empty starting view.
 */
export function WorkbenchView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <FileCard className="lg:col-span-2" />
        <ReleaseCard />
        <NotificationCard />
      </div>
    </div>
  )
}
