import { Component } from 'react'
import * as Sentry from '@sentry/react'
import { safeRemove } from '../lib/safeStorage'

// v9.22: Retry used to be a plain reload — correct for a transient chunk
// failure, a deterministic loop for a render throw (same profile, same
// throw, every reload). Count trips in this session: on the 2nd trip the
// Retry button instead clears the cached profile and goes Home, so the
// screen is never a dead end.
const CRASH_COUNT_KEY = 'cherry-error-boundary-trips'
const PROFILE_CACHE_KEY = 'cherry-directory-profile'

function readCrashCount() {
  try {
    return Number(window.sessionStorage.getItem(CRASH_COUNT_KEY)) || 0
  } catch {
    return 0
  }
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, crashCount: 0 }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // v9.18: one console line (message only) — this is a real crash, so
    // the log stays, but the full object + component stack used to dump
    // three long lines. Sentry below still gets the full detail.
    console.error('ERROR BOUNDARY CAUGHT:', error?.message || error)
    // Report to Sentry when it was initialized (initErrorTracking
    // with VITE_SENTRY_DSN); captureException is a no-op otherwise.
    Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } })
    // Same-session crash counter (v9.22): a repeat trip means the reload
    // will throw again, so remember it and offer the escape hatch.
    let crashCount = 0
    try {
      crashCount = readCrashCount() + 1
      window.sessionStorage.setItem(CRASH_COUNT_KEY, String(crashCount))
    } catch {
      crashCount = 0
    }
    this.setState({ errorInfo, crashCount })
  }

  // v9.22: 1st trip → plain reload (transient failures recover this way).
  // 2nd+ trip in the same session → the throw is deterministic, so clear
  // the cached profile (the usual suspect: a stale/bad cached row) and
  // go Home instead of reloading into the same crash.
  handleRetry() {
    if (this.state.crashCount >= 2) {
      safeRemove(PROFILE_CACHE_KEY)
      window.location.href = '/'
      return
    }
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0015] flex items-center justify-center p-4">
          <div className="card-dark rounded-2xl p-6 max-w-md w-full text-center border border-red-500/30">
            <span className="text-5xl mb-4 block">😵</span>
            <h2 className="text-white font-display font-bold text-xl mb-3">
              တစ်ခုခု မှားသွားပါပြီ
            </h2>
            {/* I-LOW: never render the raw error text — it can leak paths,
                query fragments or other internals. Generic message only;
                the real error is in the console + Sentry. */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 text-left">
              <p className="text-white/60 text-xs font-myanmar">
                အမှားတစ်ခု ဖြစ်သွားပါသည်။ စာမျက်နှာကို ပြန်ဖွင့်ကြည့်ပါ။ ပြဿနာ ဆက်ဖြစ်နေပါက Admin ကို ဆက်သွယ်ပါ။
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => this.handleRetry()}
                className="flex-1 btn-primary text-sm py-3 min-h-[44px]"
              >
                {this.state.crashCount >= 2 ? 'Profile ရှင်းပြီး ပင်မသို့ သွားမည်' : 'ပြန်ကြိုးစားမည်'}
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                className="flex-1 btn-ghost text-sm py-3 min-h-[44px]"
              >
                ပင်မသို့ သွားမည်
              </button>
            </div>
            <p className="text-[10px] text-white/50 mt-4 font-myanmar">
              ပြဿနာ ဆက်ဖြစ်နေပါက Admin ကို ဆက်သွယ်ပါ
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
