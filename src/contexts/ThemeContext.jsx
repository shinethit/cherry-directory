import { createContext, useContext, useEffect } from 'react'

// v0.9.1: pass-through stub. The app is hardcoded dark (Tailwind has no
// darkMode:'class' and the light-mode CSS in index.css keys off
// html:not(.dark)), so the theme toggle is removed — this keeps the same API
// shape so App.jsx / Header.jsx keep working. Do NOT build a light theme.
const ThemeContext = createContext()

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Keep the app dark: without the 'dark' class the html:not(.dark)
    // light-mode overrides in index.css would apply.
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ darkMode: true, toggleDarkMode: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}
