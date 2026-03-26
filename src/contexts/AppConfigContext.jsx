import { createContext, useContext, useState, useEffect } from 'react'
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

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(_cache || DEFAULTS)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      setConfig(_cache)
      setLoading(false)
      return
    }
    
    if (!_promise) {
      _promise = supabase
        .from('app_config')
        .select('key, value')
        .then(({ data }) => {
          const obj = { ...DEFAULTS }
          if (data) {
            data.forEach(({ key, value }) => {
              try { obj[key] = JSON.parse(value) }
              catch { obj[key] = value }
            })
          }
          _cache = obj
          return obj
        })
        .catch((err) => {
          console.warn('Failed to load app config:', err)
          return DEFAULTS
        })
    }
    
    _promise.then(cfg => {
      setConfig(cfg)
      setLoading(false)
    })
  }, [])

  return (
    <AppConfigContext.Provider value={{ ...config, loading }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function invalidateAppConfig() {
  _cache = null
  _promise = null
}