// v9.14 (F-1): at-most-one floating banner.
// The update toast always wins — the PWA install banner and the HomePage
// install pill subscribe here and render nothing while the toast is
// visible. Module-scoped state + listener set, no React context needed:
// the toast is mounted in main.jsx, outside <App />, so a context
// provider in App could never reach it.
// setUpdateToastVisible(v) publishes; subscribeUpdateToastVisible(fn)
// returns an unsubscribe function and immediately calls fn with the
// current value, so a banner mounted while the toast is already up
// hides right away instead of waiting for the next change.
let updateToastVisible = false
const listeners = new Set()

export function setUpdateToastVisible(v) {
  const next = !!v
  if (next === updateToastVisible) return
  updateToastVisible = next
  listeners.forEach((fn) => fn(updateToastVisible))
}

export function subscribeUpdateToastVisible(fn) {
  listeners.add(fn)
  fn(updateToastVisible)
  return () => {
    listeners.delete(fn)
  }
}
