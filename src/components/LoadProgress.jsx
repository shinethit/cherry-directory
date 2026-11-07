// LoadProgress — v9.25 regen #2 (progress % indicator, user request
// 2026-11-07 16:23).
// Slim top progress bar + % text driven ONLY by real section completion:
// props { done, total } — sections settled / total sections. Never a fake
// indeterminate spinner or a made-up percentage. Renders nothing once
// every section has settled (done >= total), so it disappears when the
// load completes. The bar animates smoothly as sections arrive
// (transition on width). Props-driven only — it shares no state with the
// header's Manual Sync button, which has its own % display.
export default function LoadProgress({ done = 0, total = 0 }) {
  if (!total || done >= total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div
      className="px-4"
      data-testid="load-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="တင်နေသည်"
    >
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-400 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[11px] text-white/50 font-myanmar">
        {done}/{total} · {pct}%
      </p>
    </div>
  );
}
