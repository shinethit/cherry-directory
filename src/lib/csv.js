// Pure CSV parsing helpers (no Supabase / React imports — safe to unit-test).

// RFC-4180-style CSV serializer (the inverse of parseCSV): fields containing
// a comma, quote or newline are wrapped in double quotes with embedded
// quotes doubled. null/undefined become ''.
export function toCSV(headers, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines = [headers.map(cell).join(',')]
  for (const row of rows || []) lines.push(row.map(cell).join(','))
  return lines.join('\n') + '\n'
}

// RFC-4180-style CSV parser: quoted fields may contain commas, embedded
// newlines and "" escapes. The old parser split on '\n' first (so a
// quoted newline broke the row) and toggled inQuote on every '"' (so
// "" became an empty field instead of a literal quote).
export function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuote = false
  // S38 (v9.17): only trim UNQUOTED fields. A quoted field keeps its
  // exact content (leading/trailing spaces included) — the old code
  // trimmed every field, so `"  spaced  "` lost its spaces.
  let fieldQuoted = false
  const pushField = () => { row.push(fieldQuoted ? cur : cur.trim()); cur = ''; fieldQuoted = false }
  // Normalise line endings, then walk char by char.
  const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuote) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      if (cur === '') fieldQuoted = true
      inQuote = true
    } else if (ch === ',') {
      pushField()
    } else if (ch === '\n') {
      pushField()
      rows.push(row); row = []
    } else {
      cur += ch
    }
  }
  // Trailing field / last line without a newline.
  if (cur !== '' || row.length > 0) {
    pushField()
    rows.push(row)
  }
  // Drop fully-empty trailing rows (e.g. a final newline).
  while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop()
  if (rows.length < 2) return { headers: [], rows: [] }
  // N32 (v9.17): headers come from the state machine already unquoted —
  // the old /^"|"$/ strip is gone; headers are just trimmed.
  const headers = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1).map(values =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
  )
  return { headers, rows: dataRows }
}
