/**
 * useAppConfig — loads dynamic config (cities, app name, etc.) from Supabase
 * Stored in `app_config` table as key-value pairs
 * Falls back to defaults if DB not reachable
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULTS = {
  app_name:    'Cherry Directory',
  app_city:    'တောင်ကြီးမြို့',
  cities:      ['Taunggyi', 'Kalaw', 'Pindaya', 'Nyaungshwe', 'Loikaw'],
  fuel_note:   'ဓာတ်ဆီဆိုင်ကို နှိပ်ပြဲ့ပြီး Report လုပ်ပါ • ၅ မိနစ် Cooldown',
}

// Module-level cache so we only fetch once per session
let _cache = null
let _promise = null

export function useAppConfig() {
  const [config, setConfig] = useState(_cache || DEFAULTS)

  useEffect(() => {
    if (_cache) { setConfig(_cache); return }
    if (!_promise) {
      _promise = supabase.from('app_config').select('key, value').then(({ data }) => {
        if (!data) return
        const obj = { ...DEFAULTS }
        data.forEach(({ key, value }) => {
          try { obj[key] = JSON.parse(value) }
          catch { obj[key] = value }
        })
        _cache = obj
        return obj
      }).catch(() => DEFAULTS)
    }
    _promise.then(cfg => { if (cfg) setConfig(cfg) })
  }, [])

  return config
}

// Invalidate cache (call after admin saves config)
export function invalidateAppConfig() {
  _cache = null
  _promise = null
}
