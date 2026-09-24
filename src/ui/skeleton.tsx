import * as React from 'react'

import { cn } from './utils'

/**
 * A placeholder block for a loading state. Hidden from assistive technology:
 * the region that owns the skeleton announces that it is busy, and a screen
 * reader reading out a dozen empty boxes is worse than silence.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="skeleton" aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
  )
}

export { Skeleton }
