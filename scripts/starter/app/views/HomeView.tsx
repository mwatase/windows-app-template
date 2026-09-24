import { useAppIdentity } from '@/chassis'
import { Card, CardDescription, CardHeader, CardTitle } from '@/ui'

/** The program's first view. Replace it with the program. */
export function HomeView() {
  const { name } = useAppIdentity()

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{name} is ready to build</CardTitle>
          <CardDescription>
            This view lives in src/app/views/HomeView.tsx. Add views in src/app/index.ts, native commands in
            src-tauri/src/commands/, and the permissions they need in src-tauri/capabilities/app.json.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
