import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from './utils'

/*
 * `success` and `warning` are tinted rather than solid on purpose: the theme
 * defines --success and --warning but no paired foreground token, and solid
 * fills of either fall below 4.5:1 against both candidate text colours in
 * light mode. A tint behind --foreground keeps the hue and the contrast.
 */
const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap',
    'rounded-md border px-2 py-0.5 text-xs font-medium transition-[color,box-shadow]',
    "[&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-3",
  ],
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success: 'border-success/30 bg-success/15 text-foreground',
        warning: 'border-warning/40 bg-warning/20 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  /** Render the child element instead of a <span>. */
  asChild?: boolean
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
