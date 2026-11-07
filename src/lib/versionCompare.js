// Numeric "server is actually newer" comparison for dotted versions
// ("9.26", "9.3", "10.0") — v9.27. Compares major then minor
// numerically, so 9.10 > 9.9 and a rollback (server older than the
// running bundle) never prompts as an update. Unparseable input falls
// back to exact inequality — prompt when the strings differ — so the
// existing detection path is unchanged for unexpected version shapes.
export function isServerVersionNewer(serverVersion, runningVersion) {
  const parse = (v) => {
    if (typeof v !== 'string') return null
    const m = v.trim().match(/^(\d+)\.(\d+)/)
    if (!m) return null
    return [Number(m[1]), Number(m[2])]
  }
  const s = parse(serverVersion)
  const r = parse(runningVersion)
  if (!s || !r) return serverVersion !== runningVersion
  if (s[0] !== r[0]) return s[0] > r[0]
  return s[1] > r[1]
}
