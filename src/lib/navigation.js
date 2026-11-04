// Shared back navigation (S9) — a deep-link visitor must never be
// ejected out of the app by a Back button. If the browser history has an
// earlier entry, go back; otherwise go to the fallback page instead.
// NOTE: window.history.length counts external sites too, so this is only
// a "is there any entry at all" check — exactly the pattern EventFormPage
// already used. Callers pass the relevant parent page as fallback.
export function goBackOrHome(navigate, fallback = '/') {
  if (window.history.length > 1) navigate(-1)
  else navigate(fallback, { replace: true })
}
