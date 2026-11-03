import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { showSuccess, showError } from '../lib/toast'
import { translateAuthError } from './LoginPage'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  // Recovery mode: Supabase puts the recovery session in the URL hash
  // (#access_token=...&type=recovery) after the user clicks the email link.
  const [isRecovery, setIsRecovery] = useState(false)

  // Recovery detection (H-24): do NOT rely on window.location.hash.
  // supabase.js sets detectSessionInUrl: true, so the client may parse
  // and consume the #access_token=...&type=recovery hash before this
  // component mounts, leaving isRecovery false and the user stuck on the
  // "send link" form. Instead derive recovery mode from the auth event
  // the client fires when it processes a recovery session, plus a
  // getSession() check (a session exists by the time a recovery link
  // lands here). The hash read stays only as a belt-and-braces fallback
  // for clients that have not consumed it yet.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (hash.get('type') === 'recovery' || hash.get('access_token')) {
      setIsRecovery(true)
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setIsRecovery(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSendLink(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Single redirectTo source: AuthContext.resetPasswordForEmail (F-LOW-1).
      await resetPasswordForEmail(email)
      setSent(true)
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
      navigate('/')
    } catch (err) {
      setError(translateAuthError(err))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80dvh] flex flex-col">
      <div className="px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-4 pb-8 max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display font-bold text-2xl text-white">
            {isRecovery ? 'စကားဝှက် အသစ် သတ်မှတ်မည်' : 'စကားဝှက် မေ့သွားလား?'}
          </h2>
          <p className="text-white/40 text-sm mt-1 font-myanmar">
            {isRecovery
              ? 'စကားဝှက် အသစ် ရိုက်ထည့်ပါ'
              : 'အီးမေးလ် ထည့်ပါ — ပြန်လည်သတ်မှတ်ရန် လင့်ခ် ပို့ပေးပါမည်'}
          </p>
        </div>

        {isRecovery ? (
          <form onSubmit={handleSetPassword} className="space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">စကားဝှက် အသစ်</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">စကားဝှက် အသစ် (ထပ်ရိုက်)</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="input-dark"
              />
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
              <p className="text-xs text-white/40 font-myanmar mt-2">မေးလ် မရောက်ပါက Spam folder ကို စစ်ကြည့်ပါ</p>
            </div>
            <button
              type="button"
              onClick={handleSendLink}
              disabled={loading}
              className="btn-ghost w-full text-sm"
            >
              {loading ? 'ပို့နေသည်...' : 'လင့်ခ် ထပ်ပို့မည်'}
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
