import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { BookingAvailability, SessionDto, SubscriptionStatusDto } from '@vuekumi/shared'
import { splitDisplayName } from '@vuekumi/shared'
import { AVAILABILITY_LABELS, hasModelAccess, isCreatorWorkspaceAccount } from '@vuekumi/shared'
import { SiteHeader } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { api, ApiError, type GeoCountry } from '../api/client'
import { toast } from 'sonner'

export default function Account() {
  const { user, refresh, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [country, setCountry] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [availability, setAvailability] = useState<BookingAvailability>('open')
  const [dayRate, setDayRate] = useState('')
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [profileBusy, setProfileBusy] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [sessionsBusy, setSessionsBusy] = useState(false)
  const [plan, setPlan] = useState<SubscriptionStatusDto | null>(null)
  const [planBusy, setPlanBusy] = useState(false)

  const contributor = isCreatorWorkspaceAccount(user?.accountType)
  const model = Boolean(user && hasModelAccess(user))
  const dualRole = Boolean(contributor && user?.hasModelProfile)
  const publicProfile = contributor || model
  const canSubscribe = user?.accountType === 'user' || user?.accountType === 'agency' || isCreatorWorkspaceAccount(user?.accountType)

  useEffect(() => {
    if (!user) return
    const parts = splitDisplayName(user.name)
    setFirstName(user.firstName || parts.firstName)
    setLastName(user.lastName || parts.lastName)
    setCountry(user.country ?? '')
    setAvatarUrl(user.avatarUrl ?? '')
    setHandle(user.contributorHandle ?? user.modelHandle ?? '')
    setBio(user.bio ?? '')
    setLocation(user.location ?? '')
    setAvailability(user.availability ?? 'open')
    setDayRate(user.dayRateUsd != null ? String(user.dayRateUsd) : '')
  }, [user])

  useEffect(() => {
    api.countries(contributor)
      .then((d) => setCountries(d.countries))
      .catch(() => setCountries([]))
  }, [contributor])

  function loadSessions() {
    api.sessions().then((d) => setSessions(d.items)).catch(() => setSessions([]))
  }

  function loadPlan() {
    if (!canSubscribe) return
    api.subscription().then(setPlan).catch(() => setPlan(null))
  }

  useEffect(() => {
    if (user) {
      loadSessions()
      loadPlan()
    }
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <p className="pt-36 text-center font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading…</p>
      </div>
    )
  }

  if (!user) {
    navigate('/login?redirect=/account')
    return null
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-28 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Account</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Your settings.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {user.email} · {user.accountType}
          {dualRole ? ' · photographer and model' : ''}
          {user.emailVerified ? '' : ' · email not verified'}
        </p>
        {dualRole && (
          <p className="mt-2 text-sm text-ink-soft">
            One account, both roles. You keep this photographer login and a model profile on the same email. Models do not earn.
          </p>
        )}

        {canSubscribe && (
          <div className="mt-10 border border-sand bg-white p-6">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Vuekumi+</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif-display text-2xl font-light">
                  {plan?.plan === 'plus' ? 'Plus' : 'Free'} plan
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {plan?.quota.unlimited
                    ? `Unlimited royalty-free downloads${plan.plusUntil ? ` through ${plan.plusUntil.slice(0, 10)}` : ''}. Premium images are still billed per licence.`
                    : `${plan?.quota.used ?? user.downloadQuotaUsed ?? 0} of ${plan?.quota.limit ?? 50} royalty-free downloads used today (UTC).`}
                </p>
                {plan?.status === 'cancelled' && plan.plusUntil && (
                  <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
                    Cancels at period end · {plan.plusUntil.slice(0, 10)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {plan?.plan !== 'plus' && (
                  <button
                    type="button"
                    disabled={planBusy}
                    onClick={async () => {
                      setPlanBusy(true)
                      try {
                        const { checkout } = await api.startPlusCheckout()
                        window.location.assign(checkout.url)
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not start Vuekumi+')
                        setPlanBusy(false)
                      }
                    }}
                    className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
                  >
                    {planBusy ? 'Starting…' : 'Go Vuekumi+ · $19'}
                  </button>
                )}
                {plan?.plan === 'plus' && plan.current && plan.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={planBusy}
                    onClick={async () => {
                      if (!plan.current) return
                      setPlanBusy(true)
                      try {
                        await api.cancelSubscription(plan.current.id)
                        toast.success('Vuekumi+ will end after this period')
                        await refresh()
                        loadPlan()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not cancel')
                      } finally {
                        setPlanBusy(false)
                      }
                    }}
                    className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e]"
                  >
                    Cancel at period end
                  </button>
                )}
              </div>
            </div>
            {!plan?.quota.unlimited && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/8">
                <div
                  className="h-full rounded-full bg-terra"
                  style={{ width: `${Math.min(100, ((plan?.quota.used ?? 0) / (plan?.quota.limit ?? 50)) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        <form
          className="mt-10 space-y-4 border border-sand bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setProfileBusy(true)
            try {
              await api.updateMe({
                firstName,
                lastName,
                country,
                avatarUrl,
                ...(publicProfile ? { handle, bio, location } : {}),
                ...(publicProfile
                  ? { availability, dayRateUsd: dayRate === '' ? null : Number(dayRate) }
                  : {}),
              })
              await refresh()
              toast.success('Profile saved')
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not save profile')
            } finally {
              setProfileBusy(false)
            }
          }}
        >
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Profile</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              autoComplete="given-name"
              className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              autoComplete="family-name"
              className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <select
            required={contributor}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
          >
            <option value="">{contributor ? 'African country (required)' : 'Country'}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name} · {c.currency}</option>
            ))}
          </select>
          {publicProfile && (
            <>
              <input
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Public handle"
                className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
              <p className="font-mono-tech text-[10px] text-ink-faint">
                {dualRole
                  ? `Shown as /p/${handle || 'your-handle'} and /m/${handle || 'your-handle'}. Approving likeness does not transfer copyright.`
                  : contributor
                  ? `Shown as /p/${handle || 'your-handle'}`
                  : `Shown as /m/${handle || 'your-handle'}. Approving likeness does not transfer copyright.`}
              </p>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Public location (Lagos, Nigeria)"
                className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short bio"
                className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
              <div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(AVAILABILITY_LABELS) as BookingAvailability[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAvailability(a)}
                      className={`border px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] transition-colors ${
                        availability === a ? 'border-terra bg-terra/5 text-ink' : 'border-sand text-ink-soft hover:border-ink'
                      }`}
                    >
                      {AVAILABILITY_LABELS[a]}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  step={25}
                  value={dayRate}
                  onChange={(e) => setDayRate(e.target.value)}
                  placeholder="Indicative day rate (USD, optional)"
                  className="mt-2 w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
                />
                <p className="mt-1.5 font-mono-tech text-[10px] text-ink-faint">
                  Booking visibility on your public profile. Payment is settled directly between
                  the parties — Vuekumi charges no booking fee in this phase.
                </p>
              </div>
            </>
          )}
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Avatar URL (optional)"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <button
            type="submit"
            disabled={profileBusy}
            className="bg-ink px-6 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
          >
            {profileBusy ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <form
          className="mt-6 space-y-4 border border-sand bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            if (password !== confirm) {
              toast.error('New passwords do not match')
              return
            }
            setPasswordBusy(true)
            try {
              await api.changePassword({
                password,
                ...(user.hasPassword ? { currentPassword } : {}),
              })
              setCurrentPassword('')
              setPassword('')
              setConfirm('')
              toast.success(user.hasPassword ? 'Password updated' : 'Password set')
              await refresh()
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not update password')
            } finally {
              setPasswordBusy(false)
            }
          }}
        >
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Password</p>
          <p className="text-sm text-ink-soft">
            {user.hasPassword
              ? 'Changing your password signs out other devices.'
              : 'This account signed in with Google. Set a password to also use email login.'}
          </p>
          {user.hasPassword && (
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          )}
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input
            required
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <button
            type="submit"
            disabled={passwordBusy}
            className="bg-ink px-6 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
          >
            {passwordBusy ? 'Saving…' : user.hasPassword ? 'Update password' : 'Set password'}
          </button>
        </form>

        <div className="mt-6 border border-sand bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Sessions</p>
              <p className="mt-1 text-sm text-ink-soft">Devices signed in to this account.</p>
            </div>
            <button
              type="button"
              disabled={sessionsBusy || sessions.filter((s) => !s.current).length === 0}
              onClick={async () => {
                setSessionsBusy(true)
                try {
                  const result = await api.revokeOtherSessions()
                  toast.success(`Signed out ${result.revoked} other session${result.revoked === 1 ? '' : 's'}`)
                  loadSessions()
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Could not revoke sessions')
                } finally {
                  setSessionsBusy(false)
                }
              }}
              className="border border-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] hover:bg-ink hover:text-paper disabled:opacity-40"
            >
              Sign out other devices
            </button>
          </div>
          <div className="mt-4 divide-y divide-sand">
            {sessions.length === 0 && (
              <p className="py-4 text-sm text-ink-soft">No active sessions.</p>
            )}
            {sessions.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {session.device}
                    {session.current && (
                      <span className="ml-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra">This device</span>
                    )}
                  </p>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {session.ipAddress ?? 'IP hidden'} · last used {session.lastUsedAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const result = await api.revokeSession(session.id)
                      if (result.current) {
                        await logout()
                        navigate('/login')
                        return
                      }
                      loadSessions()
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Could not revoke session')
                    }
                  }}
                  className="border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#b3382e]"
                >
                  {session.current ? 'Sign out' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {contributor && user.contributorHandle && (
          <p className="mt-8 text-sm text-ink-soft">
            Public photographer page:{' '}
            <Link to={`/p/${user.contributorHandle}`} className="text-terra">/p/{user.contributorHandle}</Link>
          </p>
        )}
        {model && user.modelHandle && (
          <p className={`${contributor && user.contributorHandle ? 'mt-2' : 'mt-8'} text-sm text-ink-soft`}>
            Public model portfolio:{' '}
            <Link to={`/m/${user.modelHandle}`} className="text-terra">/m/{user.modelHandle}</Link>
          </p>
        )}
      </div>
    </div>
  )
}
