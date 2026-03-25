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

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState({
    app_name: 'Cherry Directory',
    app_city: 'တောင်ကြီးမြို့',
    cities: ['Taunggyi', 'Kalaw', 'Pindaya', 'Nyaungshwe', 'Loikaw', 'Hopong', 'Aungban', 'Ywangan'],
    loading: true
  })

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const { data } = await supabase.from('app_config').select('*')
      if (data) {
        const newConfig = { ...config }
        data.forEach(({ key, value }) => {
          try {
            const parsed = JSON.parse(value)
            if (key === 'app_name') newConfig.app_name = parsed
            if (key === 'app_city') newConfig.app_city = parsed
            if (key === 'cities') newConfig.cities = Array.isArray(parsed) ? parsed : config.cities
          } catch (e) {
            // ignore parse errors
          }
        })
        setConfig(prev => ({ ...prev, ...newConfig, loading: false }))
      } else {
        setConfig(prev => ({ ...prev, loading: false }))
      }
    } catch (e) {
      console.warn('Failed to load app config:', e)
      setConfig(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  )
}
