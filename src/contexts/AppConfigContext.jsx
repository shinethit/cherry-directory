import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppConfigContext = createContext()

export function useAppConfig() {
  const context = useContext(AppConfigContext)
  if (!context) {
    throw new Error('useAppConfig must be used within AppConfigProvider')
  }
  return context
}

const DEFAULTS = {
  app_name: 'Cherry Directory',
  app_city: 'တောင်ကြီးမြို့',
  cities: ['Taunggyi', 'Kalaw', 'Pindaya', 'Nyaungshwe', 'Loikaw', 'Hopong', 'Aungban', 'Ywangan'],
}

let _cache = null
let _promise = null
// Every mounted provider registers its refresh fn here so
// invalidateAppConfig() can re-fetch everywhere at once.
const _refreshers = new Set()

async function fetchConfig() {
  const { data, error } = await supabase.from('app_config').select('key, value')
  if (error) throw error
  const obj = { ...DEFAULTS }
  if (data) {
    data.forEach(({ key, value }) => {
      try { obj[key] = JSON.parse(value) }
      catch { obj[key] = value }
    })
  }
  _cache = obj
  return obj
}

function loadConfig() {
  if (_cache) return Promise.resolve(_cache)
  if (!_promise) {
    _promise = fetchConfig().catch((err) => {
      console.warn('Failed to load app config:', err)
      _promise = null
      return DEFAULTS
    })
  }
  return _promise
}

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(_cache || DEFAULTS)
  const [loading, setLoading] = useState(!_cache)

  const refresh = useCallback(async () => {
    if (!_cache) setLoading(true)
    const cfg = await loadConfig()
    setConfig(cfg)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    _refreshers.add(refresh)
    return () => { _refreshers.delete(refresh) }
  }, [refresh])

  return (
    <AppConfigContext.Provider value={{ ...config, loading, refreshAppConfig: refresh }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function invalidateAppConfig() {
  _cache = null
  _promise = null
  // Previously this only cleared the module cache — nothing ever
  // re-fetched, so the app kept showing old values until reload.
  // Now every mounted provider re-fetches from Supabase.
  _refreshers.forEach(fn => fn())
}
