import { Navigate, useLocation } from 'react-router'
import {
  adminHas,
  canImpersonateCreator,
  firstAdminPath,
  hasModelAccess,
  isCreatorAccount,
  type AccountType,
  type AdminCapability,
} from '@vuekumi/shared'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowed: AccountType[]
  capability?: AdminCapability
}

export function ProtectedRoute({ children, allowed, capability }: ProtectedRouteProps) {
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

  const creatorWorkspace = allowed.includes('photographer') || allowed.includes('photo_influencer') || allowed.includes('contributor')
  const allowedByType =
    allowed.includes(user.accountType)
    || (allowed.includes('agency') && Boolean(user.agencyId))
    || (allowed.includes('model') && hasModelAccess(user))
    || (creatorWorkspace && canImpersonateCreator(user))
  const allowedByCap = capability ? adminHas(user, capability) : true

  if (!allowedByType || !allowedByCap) {
    const fallback =
      user.accountType === 'admin'
        ? firstAdminPath(user)
        : isCreatorAccount(user.accountType)
          ? '/contributor'
          : user.accountType === 'agency' || user.agencyId
            ? '/agency'
            : hasModelAccess(user)
              ? '/model'
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
