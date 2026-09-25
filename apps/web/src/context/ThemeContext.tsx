import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'

export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'vuekumi-theme'

function readStored(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function applyTheme(choice: ThemeChoice | null) {
  if (choice) document.documentElement.dataset.theme = choice
  else delete document.documentElement.dataset.theme
}

interface ThemeContextValue {
  choice: ThemeChoice | null
  setChoice: (choice: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth()
  const [choice, setChoiceState] = useState<ThemeChoice | null>(() => {
    const stored = readStored()
    applyTheme(stored)
    return stored
  })

  useEffect(() => {
    if (user?.theme === 'light' || user?.theme === 'dark') {
      setChoiceState(user.theme)
      applyTheme(user.theme)
      try { localStorage.setItem(STORAGE_KEY, user.theme) } catch { /* private mode */ }
    }
  }, [user?.theme])

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    applyTheme(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
    if (user) {
      api.updateMe({ theme: next }).then(() => refresh()).catch(() => { /* local choice still applies */ })
    }
  }, [user, refresh])

  const value = useMemo(() => ({ choice, setChoice }), [choice, setChoice])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
