import { HouseIcon } from 'lucide-react'

import type { AppDefinition } from '@/chassis'

import { HomeView } from './views/HomeView'

/**
 * THE PROGRAM. Everything the chassis needs to know about it: its views, its
 * section of the Settings page (`settings`), and anything to run before the
 * first render (`init`). src/main.tsx hands this to the chassis.
 */
export const app: AppDefinition = {
  views: [
    {
      id: 'home',
      label: 'Home',
      icon: HouseIcon,
      component: HomeView,
    },
  ],
}
