// Shared back navigation (S9) — a deep-link visitor must never be
// ejected out of the app by a Back button. If the browser history has an
// earlier entry, go back; otherwise go to the fallback page instead.
// NOTE: window.history.length counts external sites too, so this is only
// a "is there any entry at all" check — exactly the pattern EventFormPage
// already used. Callers pass the relevant parent page as fallback.
export function goBackOrHome(navigate, fallback = '/', from) {
  // S2 (v9.17): an explicit `from` (e.g. a login redirect target) wins —
  // navigate there with replace so Back never loops to the login page.
  // Only with no explicit destination fall back to history (-1) or the
  // fallback page when there is no earlier entry.
  if (from) { navigate(from, { replace: true }); return }
  if (window.history.length > 1) navigate(-1)
  else navigate(fallback, { replace: true })
}
