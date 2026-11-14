// Shared back navigation (S9) — a deep-link visitor must never be
// ejected out of the app by a Back button. window.history.length is
// UNRELIABLE for this: a fresh tab's new-tab page counts as a history
// entry, so a directly opened page (no in-app history at all) still
// reports history.length > 1 and navigate(-1) lands on chrome://newtab/.
// Instead App.jsx tracks in-app navigation depth in sessionStorage
// (NAV_DEPTH_KEY): 0 means this tab entered the app on this page, so
// Back goes to the fallback; > 0 means the user navigated inside the
// app, so Back goes back one step. sessionStorage persists across
// reload in the same tab, which is correct here: Home→About then
// reload keeps depth 1 (Back goes to Home, which is in history);
// direct-open then reload keeps depth 0 (Back goes to '/').
// Callers pass the relevant parent page as fallback.
export const NAV_DEPTH_KEY = 'cherry-nav-depth'

export function goBackOrHome(navigate, fallback = '/', from) {
  // S2 (v9.17): an explicit `from` (e.g. a login redirect target) wins —
  // navigate there with replace so Back never loops to the login page.
  // Only with no explicit destination fall back to history (-1) or the
  // fallback page when there is no earlier in-app entry.
  if (from) { navigate(from, { replace: true }); return }
  let depth = 0
  try { depth = parseInt(sessionStorage.getItem(NAV_DEPTH_KEY) || '0', 10) || 0 } catch { /* storage unavailable — treat as depth 0 */ }
  if (depth > 0) navigate(-1)
  else navigate(fallback, { replace: true })
}
