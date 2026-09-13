import { PortalShell, type PortalLink } from '../components/shared'
import { useAuth } from '../context/AuthContext'

const links: PortalLink[] = [
  { to: '/agency', label: 'Dashboard', icon: <span>◎</span> },
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell title="Agency portal" subtitle="Enterprise licensing — team management coming in Phase 7." links={links}>
      {children}
    </PortalShell>
  )
}

export default function AgencyDashboard() {
  const { user } = useAuth()
  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Agency</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Welcome, {user?.name}.</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Your agency workspace is active. Team management, Rights-Managed quotes, and billing arrive in Phase 7.
      </p>
    </Shell>
  )
}
