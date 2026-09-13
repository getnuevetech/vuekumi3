import { Navigate, useLocation } from 'react-router'
import type { AccountType } from '@vuekumi/shared'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowed: AccountType[]
}

export function ProtectedRoute({ children, allowed }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-mono-tech text-xs uppercase tracking-[0.2em] text-ink-soft">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!allowed.includes(user.accountType)) {
    const fallback =
      user.accountType === 'admin'
        ? '/admin'
        : user.accountType === 'contributor'
          ? '/contributor'
          : user.accountType === 'agency'
            ? '/agency'
            : '/'
    return <Navigate to={fallback} replace />
  }

  if (user.status === 'suspended') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <div>
          <h1 className="font-serif-display text-3xl">Account suspended</h1>
          <p className="mt-2 text-sm text-ink-soft">Contact support if you believe this is an error.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
