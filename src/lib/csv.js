// Pure CSV parsing helpers (no Supabase / React imports — safe to unit-test).

// RFC-4180-style CSV parser: quoted fields may contain commas, embedded
// newlines and "" escapes. The old parser split on '\n' first (so a
// quoted newline broke the row) and toggled inQuote on every '"' (so
// "" became an empty field instead of a literal quote).
export function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuote = false
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
      inQuote = true
    } else if (ch === ',') {
      row.push(cur.trim()); cur = ''
    } else if (ch === '\n') {
      row.push(cur.trim()); cur = ''
      rows.push(row); row = []
    } else {
      cur += ch
    }
  }
  // Trailing field / last line without a newline.
  if (cur !== '' || row.length > 0) {
    row.push(cur.trim())
    rows.push(row)
  }
  // Drop fully-empty trailing rows (e.g. a final newline).
  while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop()
  if (rows.length < 2) return { headers: [], rows: [] }
  const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''))
  const dataRows = rows.slice(1).map(values =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
  )
  return { headers, rows: dataRows }
}
