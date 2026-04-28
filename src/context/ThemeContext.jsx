import { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = [
  {
    id:      'dark',
    label:   'Dark',
    swatch:  { bg: '#0f1117', card: '#1a1d27', accent: '#d8d8d8' },
  },
  {
    id:      'light',
    label:   'Light',
    swatch:  { bg: '#f4f4f5', card: '#ffffff', accent: '#52525b' },
  },
]

const STORAGE_KEY = 'nats-dashboard-theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const isValidTheme = (id) => THEMES.some((themeOption) => themeOption.id === id)

  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    return isValidTheme(savedTheme) ? savedTheme : 'dark'
  })

  const setTheme = (id) => {
    const nextTheme = isValidTheme(id) ? id : 'dark'
    setThemeState(nextTheme)
    localStorage.setItem(STORAGE_KEY, nextTheme)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Apply once on mount so SSR/hydration has the right class immediately
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
