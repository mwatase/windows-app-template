import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from './utils'
import './primitives.css'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs',
        'outline-none transition-colors',
        'data-[state=unchecked]:bg-muted-foreground/35 data-[state=checked]:bg-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
          'data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
