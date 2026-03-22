import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Crown, Shield, User, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ROLE_INFO = {
  member: { label: 'Member', icon: User, color: 'brand', desc: 'Chat ပြုလုပ်ရန်၊ Review ပေးရန်' },
  moderator: { label: 'Moderator', icon: Shield, color: 'amber', desc: 'Content စီမံရန်' },
  admin: { label: 'Admin', icon: Crown, color: 'gold', desc: 'Full access + Analytics' },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn({ email, password })
        navigate(-1)
      } else {
        await signUp({ email, password, fullName })
        setSuccess('အကောင့် ဖွင့်ပြီးပါပြီ! Email ကို စစ်ဆေးပါ')
        setMode('login')
      }
    } catch (err) {
      setError(err.message || 'Error ဖြစ်ပွားသည်')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80dvh] flex flex-col">
      {/* Back */}
      <div className="px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
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
          <p className="text-white/40 text-sm mt-1 font-myanmar">
            {mode === 'login' ? 'အကောင့် ဝင်ရောက်ရန်' : 'အကောင့် အသစ် ဖွင့်ရန်'}
          </p>
        </div>

        {/* Role info cards */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {Object.entries(ROLE_INFO).map(([key, { label, icon: Icon, desc }]) => (
            <div key={key} className="card-dark p-3 text-center rounded-2xl">
              <Icon size={18} className={`mx-auto mb-1 ${key === 'admin' ? 'text-gold-400' : key === 'moderator' ? 'text-amber-400' : 'text-brand-300'}`} />
              <p className="text-[10px] font-display font-bold text-white">{label}</p>
              <p className="text-[8px] text-white/40 mt-0.5 font-myanmar leading-tight">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/30 text-center mb-6 font-myanmar">Admin/Moderator role ကို Signup ပြီးနောက် Administrator မှ ပေးမည်</p>

        {/* Toggle */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-display font-semibold transition-all ${mode === m ? 'bg-brand-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
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

        {/* Guest notice */}
        <div className="mt-6 p-4 card-dark rounded-2xl text-center">
          <p className="text-sm text-white/60 font-myanmar">Login မလုပ်ဘဲ</p>
          <p className="text-xs text-white/40 mt-1 font-myanmar">Directory ကြည့်ရန်၊ News ဖတ်ရန် Login မလိုပါ</p>
          <button onClick={() => navigate('/')} className="text-brand-300 text-sm font-semibold mt-2 hover:text-brand-200 transition-colors">
            Guest အဖြစ် ဆက်သွားမယ် →
          </button>
        </div>
      </div>
    </div>
  )
}
