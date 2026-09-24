import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from './utils'

/**
 * Radix supplies `role="progressbar"` and the aria-value* attributes. Pass an
 * `aria-label` (or `aria-labelledby`) at the call site: a bar with no name is
 * the most common finding in an accessibility audit.
 *
 * `value={null}` renders an indeterminate bar, for work of unknown length.
 */
function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const indeterminate = value === null || value === undefined

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'size-full flex-1 bg-primary transition-transform duration-500 ease-out',
          indeterminate && 'animate-pulse',
        )}
        style={{ transform: `translateX(-${100 - (indeterminate ? 100 : value)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
