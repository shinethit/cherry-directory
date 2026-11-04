import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, Crown, Shield, User, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { goBackOrHome as goBackOrHomeNav } from '../lib/navigation'

// Raw Supabase (English) auth errors → honest Burmese. Unknown messages fall back to raw.
const AUTH_ERROR_MM = [
  [/invalid login credentials/i, 'အီးမေးလ် (သို့) စကားဝှက် မမှန်ပါ'],
  [/email not confirmed/i, 'အီးမေးလ် အတည်မပြုရသေးပါ — မေးလ်ထဲက လင့်ခ်ကို နှိပ်ပါ'],
  [/user already registered/i, 'ဒီအီးမေးလ်နဲ့ အကောင့်ရှိပြီးသားပါ — Login ဝင်ပါ'],
  [/password should be at least/i, 'စကားဝှက် အနည်းဆုံး ၆ လုံး ရှိရမည်'],
  [/too many requests/i, 'ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ — အကြိမ်များစွာ ကြိုးစားထားသည်'],
  [/email.*invalid|invalid.*email/i, 'အီးမေးလ် လိပ်စာ မမှန်ပါ'],
  [/user not found/i, 'ဒီအီးမေးလ်နဲ့ အကောင့် မရှိပါ'],
  [/expired/i, 'လင့်ခ် သက်တမ်းကုန်သွားပါပြီ — ထပ်တောင်းပါ'],
]

export function translateAuthError(err) {
  const msg = err?.message || ''
  const hit = AUTH_ERROR_MM.find(([re]) => re.test(msg))
  // Unknown errors surface a friendly Myanmar message, never raw English.
  return hit ? hit[1] : 'အမှားတစ်ခု ဖြစ်ပွားသည် — ထပ်ကြိုးစားပါ'
}

const ROLE_INFO = {
  member: { label: 'Member', icon: User, color: 'brand', desc: 'Chat ပြုလုပ်ရန်၊ Review ပေးရန်' },
  moderator: { label: 'Moderator', icon: Shield, color: 'amber', desc: 'Content စီမံရန်' },
  admin: { label: 'Admin', icon: Crown, color: 'gold', desc: 'Full access + Analytics' },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, signInWithOAuth } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Return to the page that sent the user here (location.state.from),
  // or home. Shared lib (S9): never navigate(-1) — window.history.length
  // counts external sites too, so "back" could leave the app (F-MED-3).
  function goBackOrHome() {
    goBackOrHomeNav(navigate, location.state?.from ?? '/')
  }

  async function handleGoogleSignIn() {
    setError(''); setSuccess('')
    setLoading(true)
    try {
      await signInWithOAuth('google')
      // Supabase redirects to Google; no navigation here.
    } catch (err) {
      setError(translateAuthError(err))
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn({ email, password })
        goBackOrHome()
      } else {
        // Confirm password must match before creating the account (F4).
        if (password !== confirmPassword) {
          setError('စကားဝှက် နှစ်ခု မတူပါ — ထပ်စစ်ပါ')
          setLoading(false)
          return
        }
        const data = await signUp({ email, password, fullName })
        // Email confirmation ON → no session yet, user must confirm via email.
        // Confirmation OFF → Supabase returns a session immediately: go in.
        if (data?.session) {
          goBackOrHome()
        } else {
          setSuccess('အကောင့် ဖွင့်ပြီးပါပြီ! အီးမေးလ်ထဲက အတည်ပြုလင့်ခ်ကို နှိပ်ပါ')
          setMode('login')
        }
      }
    } catch (err) {
      setError(translateAuthError(err))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80dvh] flex flex-col">
      {/* Back */}
      <div className="px-4 py-3">
        <button onClick={goBackOrHome} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-4 pb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-gold-500/40 shadow-2xl shadow-brand-900/60 mx-auto mb-4 bg-[#2a0050]">
            <img src="/logo.png" alt="Cherry Directory" className="w-full h-full object-contain" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white">Cherry Directory</h2>
          <p className="text-white/60 text-sm mt-1 font-myanmar">
            {mode === 'login' ? 'အကောင့် ဝင်ရောက်ရန်' : 'အကောင့် အသစ် ဖွင့်ရန်'}
          </p>
        </div>

        {/* Role info cards */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {Object.entries(ROLE_INFO).map(([key, { label, icon: Icon, desc }]) => (
            <div key={key} className="card-dark p-3 text-center rounded-2xl">
              <Icon size={18} className={`mx-auto mb-1 ${key === 'admin' ? 'text-gold-400' : key === 'moderator' ? 'text-amber-400' : 'text-brand-300'}`} />
              <p className="text-[10px] font-display font-bold text-white">{label}</p>
              <p className="text-[8px] text-white/60 mt-0.5 font-myanmar leading-tight">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/60 text-center mb-6 font-myanmar">Admin/Moderator role ကို Signup ပြီးနောက် Administrator မှ ပေးမည်</p>

        {/* Toggle */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); setConfirmPassword('') }}
              className={`flex-1 py-3 rounded-xl text-sm font-display font-semibold transition-all ${mode === m ? 'bg-brand-600 text-white shadow-lg' : 'text-white/60 hover:text-white/70'}`}
            >
              {m === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-myanmar">နာမည် (မြန်မာ/English)</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="သင်၏ နာမည်..."
                required
                className="input-dark font-myanmar"
              />
            </div>
          )}

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

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Password</label>
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

          {mode === 'signup' && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Password အတည်ပြုပါ</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="input-dark font-myanmar"
              />
            </div>
          )}

          {error && <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm text-red-300 font-myanmar">{error}</div>}
          {success && <div className="bg-green-500/15 border border-green-500/30 rounded-xl px-3 py-2.5 text-sm text-green-300 font-myanmar">{success}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {mode === 'login' ? 'Logging in...' : 'Creating...'}
              </span>
            ) : mode === 'login' ? 'Login ဝင်ရောက်မယ်' : 'အကောင့် ဖွင့်မယ်'}
          </button>
        </form>

        {/* No-account-yet / already-have-an-account link (F17) */}
        <p className="text-center mt-4">
          {mode === 'login' ? (
            <button type="button" onClick={() => { setMode('signup'); setError(''); setSuccess(''); setConfirmPassword('') }} className="text-brand-300 text-sm font-myanmar hover:text-brand-200 transition-colors">
              အကောင့် မရှိသေးပါ? အကောင့် ဖွင့်မည်
            </button>
          ) : (
            <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); setConfirmPassword('') }} className="text-brand-300 text-sm font-myanmar hover:text-brand-200 transition-colors">
              အကောင့် ရှိပြီးသား? Login ဝင်မည်
            </button>
          )}
        </p>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full mt-3 py-3 rounded-xl bg-white text-gray-800 text-sm font-display font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
          </svg>
          Google နဲ့ ဝင်ရောက်မည်
        </button>

        {mode === 'login' && (
          <p className="text-center mt-3">
            <Link to="/reset-password" className="text-brand-300 text-xs font-myanmar hover:text-brand-200 transition-colors">
              စကားဝှက် မေ့သွားလား?
            </Link>
          </p>
        )}

        {/* Guest notice */}
        <div className="mt-6 p-4 card-dark rounded-2xl text-center">
          <p className="text-sm text-white/60 font-myanmar">Login မလုပ်ဘဲ</p>
          <p className="text-xs text-white/60 mt-1 font-myanmar">Directory ကြည့်ရန်၊ News ဖတ်ရန် Login မလိုပါ</p>
          <button onClick={() => navigate('/')} className="text-brand-300 text-sm font-semibold mt-2 hover:text-brand-200 transition-colors">
            Guest အဖြစ် ဆက်သွားမယ် →
          </button>
        </div>
      </div>
    </div>
  )
}
