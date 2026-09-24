import * as React from 'react'
import { Toaster as SonnerToaster, toast, type ToasterProps } from 'sonner'

/**
 * Mount once, in the shell. `toast()` is re-exported so call sites import
 * notifications from the design system rather than from the library, and
 * swapping the implementation touches this file only.
 *
 * The theme comes in as a prop rather than being read from settings here:
 * ui/ knows nothing about where the theme preference lives.
 */
function Toaster({ theme = 'system', ...props }: ToasterProps) {
  return (
    <SonnerToaster
      data-slot="toaster"
      theme={theme}
      className="toaster group"
      position="bottom-right"
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          // Status toasts are a tinted surface with ordinary body text rather
          // than coloured text on a plain surface: --success and --warning sit
          // near 3:1 against the popover background, which fails AA at 14px.
          '--success-bg': 'color-mix(in oklab, var(--success) 12%, var(--popover))',
          '--success-text': 'var(--popover-foreground)',
          '--success-border': 'color-mix(in oklab, var(--success) 40%, var(--border))',
          '--warning-bg': 'color-mix(in oklab, var(--warning) 14%, var(--popover))',
          '--warning-text': 'var(--popover-foreground)',
          '--warning-border': 'color-mix(in oklab, var(--warning) 45%, var(--border))',
          '--error-bg': 'color-mix(in oklab, var(--destructive) 12%, var(--popover))',
          '--error-text': 'var(--popover-foreground)',
          '--error-border': 'color-mix(in oklab, var(--destructive) 40%, var(--border))',
          '--border-radius': 'var(--radius-md)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster, toast }
export type { ToasterProps }
