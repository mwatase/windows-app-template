import { FlaskConicalIcon } from 'lucide-react'

import type { AppDefinition } from '@/chassis'

import { WorkbenchSettings } from './views/WorkbenchSettings'
import { WorkbenchView } from './views/WorkbenchView'

/**
 * THE PROGRAM. Everything the chassis needs to know about it: its views, its
 * section of the Settings page, and anything to run before the first render.
 * src/main.tsx hands this to the chassis.
 */
export const app: AppDefinition = {
  views: [
    {
      id: 'workbench',
      label: 'Workbench',
      description: 'The template demo: one card for each capability the chassis wires in.',
      icon: FlaskConicalIcon,
      component: WorkbenchView,
    },
  ],
  settings: WorkbenchSettings,
}
