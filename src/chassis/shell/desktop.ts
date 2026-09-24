/**
 * Makes the webview behave like an application window rather than a web page
 * in a browser. Development builds keep the browser behaviour, because a
 * right-click "Inspect" and a quick reload are how a developer works.
 */
export function installDesktopBehaviour(): () => void {
  if (import.meta.env.DEV) return () => {}

  // The browser's context menu (Back, Reload, Save as, Print) on a desktop
  // app looks broken. It stays where it is useful: in text fields, and over
  // selected text so it can be copied.
  const onContextMenu = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    const editable = target?.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')
    const selected = (window.getSelection()?.toString() ?? '') !== ''
    if (!editable && !selected) event.preventDefault()
  }

  // Reloading an app's interface loses its state and flashes a blank window;
  // printing it produces a screenshot of the app on paper.
  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    const command = event.ctrlKey || event.metaKey
    if (key === 'f5' || (command && (key === 'r' || key === 'p'))) event.preventDefault()
  }

  document.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('keydown', onKeyDown)
  }
}
