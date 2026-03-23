import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { invalidateAppConfig } from '../hooks/useAppConfig'

export default function AppSettingsPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  useSEO({ title: 'App Settings' })

  const [cities, setCities]   = useState([])
  const [newCity, setNewCity] = useState('')
  const [appName, setAppName] = useState('')
  const [appCity, setAppCity] = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState('')

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('app_config').select('*').then(({ data }) => {
      if (!data) return
      data.forEach(({ key, value }) => {
        try {
          const v = JSON.parse(value)
          if (key === 'cities')   setCities(Array.isArray(v) ? v : [])
          if (key === 'app_name') setAppName(v)
          if (key === 'app_city') setAppCity(v)
        } catch { /* skip */ }
      })
    })
  }, [isAdmin])

  async function save() {
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('app_config').upsert({ key: 'app_name', value: JSON.stringify(appName), label: 'App Name' }),
        supabase.from('app_config').upsert({ key: 'app_city', value: JSON.stringify(appCity), label: 'City Name (Myanmar)' }),
        supabase.from('app_config').upsert({ key: 'cities',   value: JSON.stringify(cities),  label: 'Cities List' }),
      ])
      invalidateAppConfig()
      setToast('✓ သိမ်းပြီး')
      setTimeout(() => setToast(''), 3000)
    } catch (err) {
      setToast('✗ Error: ' + err.message)
      setTimeout(() => setToast(''), 4000)
    }
    setSaving(false)
  }

  function addCity() {
    const c = newCity.trim()
    if (!c || cities.includes(c)) return
    setCities(prev => [...prev, c])
    setNewCity('')
  }

  function removeCity(c) {
    setCities(prev => prev.filter(x => x !== c))
  }

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60dvh]">
      <p className="text-white/40 font-myanmar">Admin သာ ဝင်ခွင့်ရှိသည်</p>
    </div>
  )

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">⚙️ App Settings</h1>
      </div>

      <div className="px-4 space-y-5">

        {/* App identity */}
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider">App Identity</p>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">App Name</label>
            <input value={appName} onChange={e => setAppName(e.target.value)} className="input-dark" placeholder="Cherry Directory" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">မြို့အမည် (Header တွင် ပြသမည်)</label>
            <input value={appCity} onChange={e => setAppCity(e.target.value)} className="input-dark font-myanmar" placeholder="တောင်ကြီးမြို့" />
          </div>
        </div>

        {/* Cities */}
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider">မြို့/ဒေသ List</p>
          <p className="text-[10px] text-white/30 font-myanmar">Directory filter နှင့် listing form တွင် ပေါ်မည်</p>

          {/* Add city */}
          <div className="flex gap-2">
            <input
              value={newCity}
              onChange={e => setNewCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCity()}
              placeholder="မြို့အမည် ထည့်ပါ..."
              className="input-dark flex-1 text-sm"
              maxLength={30}
            />
            <button onClick={addCity} disabled={!newCity.trim()} className="btn-primary px-4 disabled:opacity-40">
              <Plus size={16} />
            </button>
          </div>

          {/* City list */}
          <div className="space-y-2">
            {cities.map((c, i) => (
              <div key={c} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/8 rounded-xl">
                <span className="text-[10px] text-white/30 w-5 flex-shrink-0">{i + 1}.</span>
                <p className="flex-1 text-sm text-white">{c}</p>
                <button onClick={() => removeCity(c)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}
            {cities.length === 0 && (
              <p className="text-center text-white/30 text-xs py-4">မြို့ မရှိသေး</p>
            )}
          </div>
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving} className="w-full btn-primary flex items-center justify-center gap-2 py-3">
          <Save size={16} />
          {saving ? 'သိမ်းနေသည်...' : 'Settings သိမ်းမည်'}
        </button>

        {toast && (
          <p className={`text-sm text-center font-myanmar ${toast.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {toast}
          </p>
        )}
      </div>
    </div>
  )
}
