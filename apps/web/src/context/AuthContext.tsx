import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthUser } from '@vuekumi/shared'
import type { LoginInput, RegisterInput } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (input: LoginInput) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  completeSession: () => Promise<AuthUser>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api.me()
      setUser(me)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        try {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
          const { user: me } = await api.me()
          setUser(me)
          return
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (input: LoginInput) => {
    const { user: loggedIn } = await api.login(input)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const { user: registered } = await api.register(input)
    setUser(registered)
    return registered
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const completeSession = useCallback(async () => {
    const { user: me } = await api.me()
    setUser(me)
    return me
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, completeSession }),
    [user, loading, login, register, logout, refresh, completeSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
