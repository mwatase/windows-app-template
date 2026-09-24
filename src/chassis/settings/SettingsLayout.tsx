import { useId, type ReactNode } from 'react'

import { Label } from '@/ui'

/**
 * The building blocks of the Settings page, exported so a program's own
 * section (AppDefinition.settings) looks like the chassis's.
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <h2 id={headingId} className="text-sm font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">{children}</div>
    </section>
  )
}

/**
 * One labelled control. Pass the control's `id` as `htmlFor` so clicking the
 * label operates the control, as it would in any native settings window.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string
  description?: ReactNode
  htmlFor?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  )
}
