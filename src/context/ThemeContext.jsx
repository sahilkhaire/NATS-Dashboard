import { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = [
  {
    id:      'dark',
    label:   'Dark',
    swatch:  { bg: '#0f1117', card: '#1a1d27', accent: '#00c8b4' },
  },
  {
    id:      'light',
    label:   'Light',
    swatch:  { bg: '#f2f4fa', card: '#ffffff', accent: '#008b7d' },
  },
  {
    id:      'ocean',
    label:   'Ocean',
    swatch:  { bg: '#060d1a', card: '#0a1630', accent: '#00e5d0' },
  },
  {
    id:      'midnight',
    label:   'Midnight',
    swatch:  { bg: '#09090b', card: '#18181b', accent: '#a855f7' },
  },
  {
    id:      'nord',
    label:   'Nord',
    swatch:  { bg: '#2e3440', card: '#3b4252', accent: '#88c0d0' },
  },
]

const STORAGE_KEY = 'nats-dashboard-theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'dark'
  })

  const setTheme = (id) => {
    setThemeState(id)
    localStorage.setItem(STORAGE_KEY, id)
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
