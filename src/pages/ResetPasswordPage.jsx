import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { showSuccess, showError } from '../lib/toast'
import { translateAuthError } from './LoginPage'
import { goBackOrHome } from '../lib/navigation'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  // Set true after a successful password change: the success message
  // stays on the page for 3 seconds before navigating home (F6).
  const [changed, setChanged] = useState(false)
  // S13 (v9.17): resend cooldown — 60 s after each send, with a countdown.
  const [cooldown, setCooldown] = useState(0)
  // Recovery mode: Supabase puts the recovery session in the URL hash
  // (#access_token=...&type=recovery) after the user clicks the email link.
  const [isRecovery, setIsRecovery] = useState(false)

  // Recovery detection (FB-14): recovery mode comes ONLY from the
  // recovery signal itself — the URL hash (#access_token=...&type=recovery)
  // or the PASSWORD_RECOVERY event the client fires for it. A plain
  // getSession() success must NOT imply recovery: a normally signed-in
  // user visiting this page would otherwise land on the "set new
  // password" form. NOTE: the client clears the hash when it consumes
  // it at boot (auth-js _getSessionFromURL sets window.location.hash
  // = ''), so the hash check alone is unreliable — the event
  // subscription below is the live signal (it fires after a network
  // round-trip, by which time this component has mounted).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    // M5 (v9.17): the reset email now lands on ?recovery=1 (AuthContext
    // redirectTo) — treat that as recovery on mount, before the hash or
    // the PASSWORD_RECOVERY event arrives. The event stays as backup.
    if (hash.get('type') === 'recovery' || new URLSearchParams(window.location.search).get('recovery') === '1') {
      setIsRecovery(true)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // After a successful change, show the success message on the page
  // for 3 seconds before navigating home (F6).
  useEffect(() => {
    if (!changed) return
    const t = setTimeout(() => navigate('/'), 3000)
    return () => clearTimeout(t)
  }, [changed, navigate])

  // S13 (v9.17): tick the resend cooldown down once a second.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleSendLink(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Single redirectTo source: AuthContext.resetPasswordForEmail (F-LOW-1).
      // S1 (v9.17): trim + lowercase the email before sending.
      await resetPasswordForEmail(email.trim().toLowerCase())
      setSent(true)
      setCooldown(60)
      showSuccess('စကားဝှက် ပြန်လည်သတ်မှတ်ရန် လင့်ခ် ပို့ပြီးပါပြီ — အီးမေးလ်ကို စစ်ဆေးပါ')
    } catch (err) {
      setError(translateAuthError(err))
    }
    setLoading(false)
  }

  function handleUseDifferentEmail() {
    setSent(false)
    setEmail('')
    setError('')
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('စကားဝှက် အနည်းဆုံး ၆ လုံး ရှိရမည်')
      return
    }
    if (password !== confirm) {
      setError('စကားဝှက် နှစ်ခု မတူပါ')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      showSuccess('စကားဝှက် ပြောင်းလဲပြီးပါပြီ')
      setChanged(true)
    } catch (err) {
      setError(translateAuthError(err))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80dvh] flex flex-col">
      <div className="px-4 py-3">
        <button onClick={() => goBackOrHome(navigate, '/login')} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-4 pb-8 max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display font-bold text-2xl text-white">
            {isRecovery ? 'စကားဝှက် အသစ် သတ်မှတ်မည်' : 'စကားဝှက် မေ့သွားလား?'}
          </h2>
          <p className="text-white/60 text-sm mt-1 font-myanmar">
            {isRecovery
              ? 'စကားဝှက် အသစ် ရိုက်ထည့်ပါ'
              : 'အီးမေးလ် ထည့်ပါ — ပြန်လည်သတ်မှတ်ရန် လင့်ခ် ပို့ပေးပါမည်'}
          </p>
        </div>

        {changed ? (
          <div className="space-y-3">
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-4 text-center">
              <p className="text-sm text-green-300 font-myanmar">✓ စကားဝှက် ပြောင်းလဲပြီးပါပြီ</p>
              <p className="text-xs text-white/60 font-myanmar mt-2">ခဏအကြာ Home သို့ ပြန်သွားမည်</p>
            </div>
            <button type="button" onClick={() => navigate('/')} className="btn-primary w-full">
              Home သို့ သွားမည်
            </button>
          </div>
        ) : isRecovery ? (
          <form onSubmit={handleSetPassword} className="space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">စကားဝှက် အသစ်</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-dark pr-10"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">စကားဝှက် အသစ် (ထပ်ရိုက်)</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-dark pr-10"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm text-red-300 font-myanmar">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'ပြောင်းနေသည်...' : 'စကားဝှက် ပြောင်းမည်'}
            </button>
          </form>
        ) : sent ? (
          <div className="space-y-3">
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-4 text-center">
              <p className="text-sm text-green-300 font-myanmar">
                လင့်ခ် ပို့ပြီးပါပြီ — <span className="font-semibold">{email}</span> ကို စစ်ဆေးပြီး လင့်ခ်ကို နှိပ်ပါ
              </p>
              <p className="text-xs text-white/60 font-myanmar mt-2">မေးလ် မရောက်ပါက Spam folder ကို စစ်ကြည့်ပါ</p>
            </div>
            <button
              type="button"
              onClick={handleSendLink}
              disabled={loading || cooldown > 0}
              className="btn-ghost w-full text-sm"
            >
              {loading ? 'ပို့နေသည်...' : cooldown > 0 ? `လင့်ခ် ထပ်ပို့မည် (${cooldown}s)` : 'လင့်ခ် ထပ်ပို့မည်'}
            </button>
            <button
              type="button"
              onClick={handleUseDifferentEmail}
              className="w-full text-center text-brand-300 text-xs font-myanmar hover:text-brand-200 transition-colors"
            >
              တခြား အီးမေးလ် သုံးမည်
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendLink} className="space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="input-dark"
              />
            </div>
            {error && <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm text-red-300 font-myanmar">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'ပို့နေသည်...' : 'လင့်ခ် ပို့မည်'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
