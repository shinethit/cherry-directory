// v9.23: when something breaks, the error screens tell the user exactly
// what to do — Android: clear the cache and reopen; iOS: delete the
// home-screen Shortcut and re-add it. Platform-aware so each phone only
// sees its own steps; unknown/desktop shows both (brief).
// Pure functions (no React) so both ErrorBoundary and the Home data-error
// banner share the same wording, and unit tests cover them without jsdom.
export function getPlatform(nav) {
  const n = nav || (typeof navigator !== 'undefined' ? navigator : null)
  if (!n) return 'other'
  const ua = n.userAgent || ''
  const platform = n.platform || ''
  const maxTouch = typeof n.maxTouchPoints === 'number' ? n.maxTouchPoints : 0
  // iPadOS reports platform MacIntel + touch points; iPhones/iPods match the UA.
  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouch > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

export const RECOVERY_LINES = {
  android: ['Android: Settings → Apps → Cherry Directory → Storage → Clear cache လုပ်ပြီး ပြန်ဖွင့်ပါ'],
  ios: ['iPhone/iPad: Home Screen က Shortcut ကို ဖျက်ပြီး Safari မှာ ပြန်ဖွင့် → Share → Add to Home Screen နဲ့ ပြန်ထည့်ပါ'],
}

export function getRecoveryLines(platform) {
  const p = platform || getPlatform()
  if (p === 'ios') return RECOVERY_LINES.ios
  if (p === 'android') return RECOVERY_LINES.android
  return [...RECOVERY_LINES.android, ...RECOVERY_LINES.ios]
}
