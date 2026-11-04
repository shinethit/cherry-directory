import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'
import { showError, showSuccess } from '../lib/toast'
import { invalidateAppConfig } from '../contexts/AppConfigContext'

export default function AppSettingsPage() {
  const navigate = useNavigate()
  const { isAdmin, loading: authLoading } = useAuth()
  const { log } = useAuditLog()
  useSEO({ title: 'App Settings' })

  const [cities, setCities]   = useState([])
  const [cityError, setCityError] = useState('')
  const [newCity, setNewCity] = useState('')
  const [appName, setAppName] = useState('')
  const [appCity, setAppCity] = useState('')
  const [saving, setSaving]   = useState(false)
  // Which sections were just saved — cleared as soon as anything is
  // edited again (G20).
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => { setJustSaved(false) }, [appName, appCity, cities])

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('app_config').select('*').then(({ data, error }) => {
      if (error) {
        showError('Settings ရယူရာတွင် အမှားရှိသည်: ' + error.message)
        return
      }
      if (!data) return
      data.forEach(({ key, value }) => {
        try {
          const v = JSON.parse(value)
          if (key === 'cities')   setCities(Array.isArray(v) ? v : [])
          if (key === 'app_name') setAppName(v)
          if (key === 'app_city') setAppCity(v)
        } catch {
          // Was a silent skip — an unparseable row now says so instead
          // of leaving a setting mysteriously empty.
          console.warn('Unparseable app_config row, skipped:', key)
          showError(`Settings '${key}' ဖတ်မရပါ — တန်ဖိုး မမှန်ကန်ပါ`)
        }
      })
    })
  }, [isAdmin])

  async function save() {
    if (!appName.trim()) {
      showError('App Name အလွတ် သိမ်းလို့မရပါ — နာမည် ထည့်ပါ')
      return
    }
    setSaving(true)
    // Sequential upserts with per-key error reporting: the old
    // Promise.all() could half-save (two keys changed, one failed)
    // behind a single generic "Error" toast.
    const keys = [
      { key: 'app_name', value: JSON.stringify(appName), label: 'App Name' },
      { key: 'app_city', value: JSON.stringify(appCity), label: 'City Name (Myanmar)' },
      { key: 'cities',   value: JSON.stringify(cities),  label: 'Cities List' },
    ]
    const failedKeys = []
    for (const entry of keys) {
      // supabase upsert() returns { error } — it never throws, so
      // each result must be checked or a failed save looks saved.
      const { error } = await supabase.from('app_config').upsert(entry)
      if (error) failedKeys.push(entry.key + ': ' + error.message)
    }
    if (failedKeys.length > 0) {
      showError('✗ သိမ်းမရသော Settings: ' + failedKeys.join('; '))
      setSaving(false)
      return
    }
    // invalidateAppConfig() now actually re-fetches in the provider,
    // so the app shows the new values without a reload.
    invalidateAppConfig()
    // Audit log (fire-and-forget) — save previously had no audit entry.
    log({ action: 'update', table: 'app_config', name: 'App Settings', after: { app_name: appName, app_city: appCity, cities } })
      .then(ok => { if (!ok) console.warn('Audit log failed for app settings save') })
    showSuccess('✓ သိမ်းပြီး')
    setJustSaved(true)
    setSaving(false)
  }

  function addCity() {
    const c = newCity.trim()
    if (!c) { setCityError('မြို့အမည် ထည့်ပါ'); return }
    if (cities.includes(c)) { setCityError('ဤမြို့ ရှိနေပြီးဖြစ်သည်'); return }
    setCityError('')
    setCities(prev => [...prev, c])
    setNewCity('')
  }

  function removeCity(c) {
    setCities(prev => prev.filter(x => x !== c))
  }

  // While auth is loading the role is unknown — wait instead of
  // flashing the lock screen to a signed-in admin.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <p className="text-white/60 font-myanmar">စစ်ဆေးနေသည်...</p>
      </div>
    )
  }

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center gap-3">
      <p className="text-white/60 font-myanmar">Admin သာ ဝင်ခွင့်ရှိသည်</p>
      <button onClick={() => navigate('/')} className="btn-primary text-xs px-4 py-2">Home ပြန်မည်</button>
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider">App Identity</p>
            {justSaved && <span className="text-[10px] font-bold text-green-400 font-myanmar">✓ သိမ်းပြီးပါပြီ</span>}
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">App Name</label>
            <input value={appName} onChange={e => setAppName(e.target.value)} className="input-dark" placeholder="Cherry Directory" />
            <p className="text-[10px] text-white/60 font-myanmar mt-1">App ၏ အမည် — Header နှင့် browser tab တွင် ပြသမည်</p>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">မြို့အမည် (Header တွင် ပြသမည်)</label>
            <input value={appCity} onChange={e => setAppCity(e.target.value)} className="input-dark font-myanmar" placeholder="တောင်ကြီးမြို့" />
            <p className="text-[10px] text-white/60 font-myanmar mt-1">Header အောက်တွင် ပြမည့် မြို့အမည် — App က ဘယ်မြို့အတွက်လဲဆိုတာ ပြသည်</p>
          </div>
        </div>

        {/* Cities */}
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider">မြို့/ဒေသ List</p>
            {justSaved && <span className="text-[10px] font-bold text-green-400 font-myanmar">✓ သိမ်းပြီးပါပြီ</span>}
          </div>
          <p className="text-[10px] text-white/60 font-myanmar">Directory filter နှင့် listing form တွင် ပေါ်မည် — မြို့အသစ် ထည့်လျှင် filter တွင် ရွေးနိုင်မည်</p>

          {/* Add city */}
          <div className="flex gap-2">
            <input
              value={newCity}
              onChange={e => { setNewCity(e.target.value); setCityError('') }}
              onKeyDown={e => e.key === 'Enter' && addCity()}
              placeholder="မြို့အမည် ထည့်ပါ..."
              className={'input-dark flex-1' + (cityError ? ' border-red-500/60' : '')}
              maxLength={30}
            />
            {cityError && <p className="text-xs text-red-400 mt-1 font-myanmar">{cityError}</p>}
            <button onClick={addCity} disabled={!newCity.trim()} className="btn-primary px-4 disabled:opacity-40">
              <Plus size={16} />
            </button>
          </div>

          {/* City list */}
          <div className="space-y-2">
            {cities.map((c, i) => (
              <div key={c} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/8 rounded-xl">
                <span className="text-[10px] text-white/60 w-5 flex-shrink-0">{i + 1}.</span>
                <p className="flex-1 text-sm text-white">{c}</p>
                <button onClick={() => removeCity(c)} className="w-7 h-7 rounded-lg btn-danger flex items-center justify-center flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}
            {cities.length === 0 && (
              <p className="text-center text-white/60 text-xs py-4">မြို့ မရှိသေး</p>
            )}
          </div>
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving} className="w-full btn-primary flex items-center justify-center gap-2 py-3">
          <Save size={16} />
          {saving ? 'သိမ်းနေသည်...' : 'Settings သိမ်းမည်'}
        </button>
      </div>
    </div>
  )
}