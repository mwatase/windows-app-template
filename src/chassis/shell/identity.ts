import { createContext, useContext } from 'react'

import type { AppIdentity } from '../types'

export const IdentityContext = createContext<AppIdentity>({ name: 'App', version: '0.0.0' })

/** The running program's name and version, for display. */
export function useAppIdentity(): AppIdentity {
  return useContext(IdentityContext)
}
