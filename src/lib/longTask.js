// v9.26 — long-task guard.
// A tiny framework-free signal that a long, reload-sensitive task
// (e.g. a CSV import in BulkImportPage) is running. The service-worker
// update reload (useServiceWorker) and the auth-lock-poison reload
// (supabase.js) must NEVER fire mid-task — a reload would wipe the
// task's in-progress state. Both consult isLongTaskRunning() before
// reloading and defer / skip while it is true.
//
// Module-level counter (not a boolean): nested long tasks nest
// correctly — the flag clears only when the last one ends. No React,
// no side effects on import, safe to import from any module.
let longTaskCount = 0

export function beginLongTask() {
  longTaskCount += 1
}

export function endLongTask() {
  // Floor at 0: an unmatched end (e.g. a double-cleanup) must never
  // leave the counter negative and the flag stuck on.
  if (longTaskCount > 0) longTaskCount -= 1
}

export function isLongTaskRunning() {
  return longTaskCount > 0
}
