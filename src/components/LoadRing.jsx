// LoadRing — v9.35 shared circular progress ring.
// The user asked (2026-11-10) that progress indicators must NOT
// disappear at 100%: "some people like seeing the numbers displayed
// — why would it disappear?" So this ring stays visible permanently
// once a total is known — at 100% it shows a FULL ring + the final
// count (e.g. "173 / 173 · 100%"). Never a fake 0 or a fake 100%:
// `done` / `total` are always real counts from the caller.
//
// Props: { done, total, size = 36, text }.
//   - Fill is done / total (largest sector = full ring when the
//     caller passes total = max count, as the Home Hero does).
//   - `text`: the line beside the ring. Default "done / total · pct%".
//     Pass a string to show custom text, or `false` to render the
//     ring alone (the caller shows the count itself, as the Hero
//     strip does under each ring).
//   - Animates in on mount / when the target changes: the ring starts
//     empty and eases to the real fill (CSS transition on
//     stroke-dashoffset, same brand purple #9933ff as the old
//     LoadProgress bar). aria-valuenow always carries the REAL pct
//     immediately — only the visual sweep animates.
// Used in exactly two places: the Directory list (list ring) and the
// Home Hero top-5 sector strip. One component, no second ring.
import { useState, useEffect } from 'react'

export function LoadRing({ done = 0, total = 0, size = 36, text = undefined }) {
  const safeTotal = Math.max(total, 0)
  const safeDone = safeTotal ? Math.min(Math.max(done, 0), safeTotal) : 0
  const pct = safeTotal ? Math.round((safeDone / safeTotal) * 100) : 0
  const [animatedPct, setAnimatedPct] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimatedPct(pct))
    return () => cancelAnimationFrame(raf)
  }, [pct])
  const stroke = 3.5
  const R = size / 2 - 2.5
  const C = 2 * Math.PI * R
  const label = text === false ? null : (text ?? `${safeDone} / ${safeTotal} · ${pct}%`)
  const centre = size / 2
  return (
    <div
      className="flex items-center gap-2"
      data-testid="load-ring"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="တင်နေသည်"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="flex-shrink-0">
        <circle cx={centre} cy={centre} r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={centre} cy={centre} r={R} fill="none" stroke="#9933ff" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - animatedPct / 100)}
          transform={`rotate(-90 ${centre} ${centre})`}
          style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
          data-testid="load-ring-arc"
        />
      </svg>
      {label !== null && (
        <p className="text-[11px] text-white/60 font-myanmar">{label}</p>
      )}
    </div>
  )
}

export default LoadRing
