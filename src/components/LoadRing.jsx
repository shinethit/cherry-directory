// LoadRing — v9.35 shared circular progress ring (v9.36: number inside).
// The user asked (2026-11-10) that progress indicators must NOT
// disappear at 100%: "some people like seeing the numbers displayed
// — why would it disappear?" So this ring stays visible permanently
// once a total is known — at 100% it shows a FULL ring + the final
// count (e.g. "173 / 173 · 100%"). Never a fake 0 or a fake 100%:
// `done` / `total` are always real counts from the caller.
//
// Props: { done, total, size = 36, text, innerText }.
//   - Fill is done / total. The Hero passes done = total (full
//     once the total is known); a tile passes done = total = 1
//     once its count has arrived (even a 0 count — 0 listings is
//     a loaded answer) and 0 / 0 while waiting; the list ring
//     passes real loaded / total progress.
//   - `text`: the line beside the ring. Default "done / total · pct%".
//     Pass a string to show custom text, or `false` to render the
//     ring alone (the caller shows the count itself, as the Hero
//     strip does under each ring).
//   - `innerText` (v9.36): text rendered CENTRED inside the circle
//     (SVG <text>, white, bold). When absent (null/undefined) no
//     inner text is rendered — backwards compatible. The font size
//     is scaled from `size` and the text length so the text always
//     fits inside the circle and never overflows it.
//   - Animates in on mount / when the target changes: the ring starts
//     empty and eases to the real fill (CSS transition on
//     stroke-dashoffset, same brand purple #9933ff as the old
//     LoadProgress bar). aria-valuenow always carries the REAL pct
//     immediately — only the visual sweep animates.
// Used in exactly three places: the Directory list (list ring), the
// Home Hero total ring, and the Home category tiles. One component,
// no second ring.
import { useState, useEffect } from 'react'

export function LoadRing({ done = 0, total = 0, size = 36, text = undefined, innerText = undefined }) {
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
  // v9.36: inner text, centred in the circle. Usable width inside
  // the ring is ~size - 12 (stroke + a small margin); a bold glyph
  // is ~0.58em wide, so the font size is the smaller of a
  // size-proportional cap (0.34 * size) and the length fit — e.g.
  // "2,186" in a 64px ring gets ~15px, "100%" in a 36px ring ~11px,
  // "173" in a 30px tile ~10px. Floor of 5px keeps even a 6-digit
  // count inside a 30px tile instead of overflowing it.
  const inner = innerText == null ? null : String(innerText)
  const innerLen = inner ? [...inner].length : 0
  const innerFontSize = inner
    ? Math.max(5, Math.min(size * 0.34, (size - 12) / (innerLen * 0.58)))
    : 0
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
        {inner !== null && (
          <text
            x={centre}
            y={centre}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontWeight="700"
            fontSize={innerFontSize}
          >
            {inner}
          </text>
        )}
      </svg>
      {label !== null && (
        <p className="text-[11px] text-white/60 font-myanmar">{label}</p>
      )}
    </div>
  )
}

export default LoadRing
