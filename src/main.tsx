import './index.css'

import { app } from '@/app'
import { bootstrap } from '@/chassis'

// The composition root: the one place the program (src/app) and the chassis
// meet. Neither imports the other's internals; this file joins them.
bootstrap(app).catch((error: unknown) => {
  console.error(error)
  document.body.textContent = 'The app could not start. Please reinstall it or contact support.'
})
