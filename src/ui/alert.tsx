import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from './utils'

const alertVariants = cva(
  [
    'relative grid w-full items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm',
    'has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3',
    'grid-cols-[0_1fr] [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  ],
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        destructive:
          'border-destructive/40 bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90',
        success: 'border-success/40 bg-success/10 text-foreground',
        warning: 'border-warning/50 bg-warning/15 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export type AlertProps = React.ComponentProps<'div'> & VariantProps<typeof alertVariants>

/**
 * `role="alert"` is assertive: assistive technology interrupts to read it.
 * Correct for a failure that just happened, wrong for static copy. Pass
 * `role="status"` or `role="note"` for anything that was already on the page.
 */
function Alert({ className, variant, role = 'alert', ...props }: AlertProps) {
  return <div data-slot="alert" role={role} className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="alert-title" className={cn('col-start-2 min-h-4 font-medium tracking-tight', className)} {...props} />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
