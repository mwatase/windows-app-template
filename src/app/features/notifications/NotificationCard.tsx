import { useState } from 'react'
import { BellIcon } from 'lucide-react'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

import { reportError, useAppIdentity } from '@/chassis'
import { Button, Card, CardDescription, CardFooter, CardHeader, CardTitle, toast } from '@/ui'

/** DEMO: raises a native Windows notification. */
export function NotificationCard() {
  const { name } = useAppIdentity()
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      let granted = await isPermissionGranted()
      if (!granted) granted = (await requestPermission()) === 'granted'
      if (!granted) {
        toast.warning('Notifications are turned off for this app', {
          description: 'Turn them on in Windows Settings, under System > Notifications.',
        })
        return
      }
      sendNotification({ title: name, body: 'Native notifications work.' })
      toast.success('Notification sent', { description: 'It appears in the corner of the screen.' })
    } catch (error) {
      reportError(error, 'Could not send the notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="size-4 text-primary" aria-hidden="true" />
          Raise a notification
        </CardTitle>
        <CardDescription>
          Shows a native notification, asking for permission first if Windows has not granted it yet. In a
          development build Windows attributes it to PowerShell; an installed build shows the app&apos;s name.
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <Button variant="outline" onClick={() => void send()} loading={sending}>
          Send a test notification
        </Button>
      </CardFooter>
    </Card>
  )
}
