import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { BookingAvailability, BuyerPlanDto, CancellationReason, PlanChangeQuote, ProfileFieldKey, SessionDto, SubscriptionStatusDto } from '@vuekumi/shared'
import { CANCELLATION_REASON_LABEL, CANCELLATION_REASONS, planAudienceForAccount, splitDisplayName } from '@vuekumi/shared'
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
  const [phoneCountryCode, setPhoneCountryCode] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [requiredFields, setRequiredFields] = useState<ProfileFieldKey[]>([])
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
  const [offers, setOffers] = useState<BuyerPlanDto[]>([])
  const [planBusy, setPlanBusy] = useState(false)
  const [pendingChange, setPendingChange] = useState<{ slug: string; planName: string; priceUsd: number; quote: PlanChangeQuote } | null>(null)
  const [cancelReason, setCancelReason] = useState<CancellationReason | ''>('')
  const [cancelDetail, setCancelDetail] = useState('')

  const contributor = isCreatorWorkspaceAccount(user?.accountType)
  const model = Boolean(user && hasModelAccess(user))
  const dualRole = Boolean(contributor && user?.hasModelProfile)
  const publicProfile = contributor || model
  const audience = planAudienceForAccount(user?.accountType)
  const canSubscribe = Boolean(audience)
  const need = (field: ProfileFieldKey) => requiredFields.includes(field)

  useEffect(() => {
    if (!user) return
    const parts = splitDisplayName(user.name)
    setFirstName(user.firstName || parts.firstName)
    setLastName(user.lastName || parts.lastName)
    setCountry(user.country ?? '')
    setAvatarUrl(user.avatarUrl ?? '')
    setPhoneCountryCode(user.phoneCountryCode ?? '')
    setPhone(user.phone ?? '')
    setAddressLine(user.addressLine ?? '')
    setCity(user.city ?? '')
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
      api.accountProfileFields().then((page) => setRequiredFields(page.fields)).catch(() => setRequiredFields([]))
    }
  }, [user])

  useEffect(() => {
    if (!audience) return
    api.publicPlans(audience).then((data) => setOffers(data.items)).catch(() => setOffers([]))
  }, [audience])

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
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">{audience} plan</p>
            <div className="mt-2">
              <h2 className="font-serif-display text-2xl font-light">
                {plan && plan.plan !== 'free' ? (plan.planName || plan.plan) : 'Free'} plan
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {plan?.quota.unlimited
                  ? `Unlimited royalty-free downloads${plan.plusUntil ? ` through ${plan.plusUntil.slice(0, 10)}` : ''}. Premium images are still billed per licence.`
                  : audience === 'buyer'
                    ? `${plan?.quota.used ?? user.downloadQuotaUsed ?? 0} of ${plan?.quota.limit ?? 50} royalty-free downloads used today (UTC).`
                    : 'This membership is for your account type. Royalty-free buyer downloads stay on a buyer plan.'}
              </p>
              {plan?.status === 'cancelled' && plan.plusUntil && (
                <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
                  Cancels at period end · {plan.plusUntil.slice(0, 10)}
                </p>
              )}
              {plan && plan.plan !== 'free' && (
                <p className="mt-2 text-sm text-ink-soft">
                  {plan.downgradeMode === 'prorate'
                    ? 'A downgrade credits unused time against the new price.'
                    : plan.downgradeMode === 'refund'
                      ? 'A downgrade refunds unused time and charges the new price in full.'
                      : 'A downgrade charges the new price. Unused time is not credited or refunded.'}
                </p>
              )}
            </div>
            {!plan?.quota.unlimited && audience === 'buyer' && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/8">
                <div
                  className="h-full rounded-full bg-terra"
                  style={{ width: `${Math.min(100, ((plan?.quota.used ?? 0) / (plan?.quota.limit ?? 50)) * 100)}%` }}
                />
              </div>
            )}
            <div className="mt-5 space-y-3">
              {offers.map((offer) => {
                const current = plan?.plan === offer.slug
                const movingUp = plan && plan.plan !== 'free' && offer.priceUsd > (offers.find((row) => row.slug === plan.plan)?.priceUsd ?? offer.priceUsd)
                return (
                  <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 border border-sand px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{offer.name}{current ? ' · current' : ''}</p>
                      <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">${offer.priceUsd} / {offer.periodDays} days</p>
                    </div>
                    {!current && (
                      <button
                        type="button"
                        disabled={planBusy}
                        onClick={async () => {
                          if (!plan || plan.plan === 'free') {
                            setPlanBusy(true)
                            try {
                              const { checkout } = await api.startPlusCheckout({ plan: offer.slug })
                              window.location.assign(checkout.url)
                            } catch (err) {
                              toast.error(err instanceof ApiError ? err.message : 'Could not start checkout')
                              setPlanBusy(false)
                            }
                            return
                          }
                          setPlanBusy(true)
                          try {
                            const quoted = await api.quotePlanChange(offer.slug)
                            setPendingChange({ slug: offer.slug, planName: quoted.planName, priceUsd: quoted.priceUsd, quote: quoted.quote })
                          } catch (err) {
                            toast.error(err instanceof ApiError ? err.message : 'Could not quote this change')
                          } finally {
                            setPlanBusy(false)
                          }
                        }}
                        className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
                      >
                        {plan && plan.plan !== 'free' ? (movingUp ? 'Upgrade' : 'Downgrade') : 'Subscribe'}
                      </button>
                    )}
                  </div>
                )
              })}
              {offers.length === 0 && <p className="text-sm text-ink-soft">No {audience} plans are available yet.</p>}
            </div>
            {pendingChange && (
              <div className="mt-4 border border-terra/40 bg-cream p-4">
                <p className="text-sm text-ink">
                  {pendingChange.quote.kind === 'upgrade'
                    ? `Upgrade to ${pendingChange.planName} charges $${pendingChange.quote.chargeUsd.toFixed(2)} after unused credit.`
                    : pendingChange.quote.mode === 'prorate'
                      ? `Downgrade to ${pendingChange.planName} applies unused time to the new price. You pay $${pendingChange.quote.chargeUsd.toFixed(2)}.`
                      : pendingChange.quote.mode === 'refund'
                        ? `Downgrade to ${pendingChange.planName} charges $${pendingChange.quote.chargeUsd.toFixed(2)} and refunds $${pendingChange.quote.refundUsd.toFixed(2)} of unused time.`
                        : `Downgrade to ${pendingChange.planName} charges $${pendingChange.quote.chargeUsd.toFixed(2)}. Unused time is not credited or refunded.`}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={planBusy}
                    onClick={async () => {
                      setPlanBusy(true)
                      try {
                        const result = await api.changePlan(pendingChange.slug)
                        if (result.checkout?.url) {
                          window.location.assign(result.checkout.url)
                          return
                        }
                        toast.success('Plan updated')
                        setPendingChange(null)
                        await refresh()
                        loadPlan()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not change plan')
                      } finally {
                        setPlanBusy(false)
                      }
                    }}
                    className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
                  >
                    Confirm change
                  </button>
                  <button type="button" onClick={() => setPendingChange(null)} className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em]">
                    Keep current plan
                  </button>
                </div>
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
                phoneCountryCode,
                phone,
                addressLine,
                city,
                bio,
                location,
                ...(publicProfile ? { handle } : {}),
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
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Email</span>
            <input
              readOnly
              value={user.email}
              aria-label="Email address"
              className="mt-1 w-full border border-sand bg-paper px-4 py-2.5 text-sm text-ink-soft outline-none"
            />
          </label>
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
          <div className="flex items-center gap-4">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
            <label className="block flex-1">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Profile picture{need('avatar') ? ' (required)' : ''}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Profile picture"
                required={need('avatar') && !avatarUrl}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(String(reader.result))
                    reader.onerror = () => reject(new Error('Could not read the image'))
                    reader.readAsDataURL(file)
                  })
                  setProfileBusy(true)
                  try {
                    const saved = await api.uploadAvatar(dataUrl)
                    setAvatarUrl(saved.avatarUrl)
                    await refresh()
                    toast.success('Profile picture saved')
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not upload the picture')
                  } finally {
                    setProfileBusy(false)
                  }
                }}
                className="mt-1 w-full text-sm"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
            <input
              required={need('phone')}
              value={phoneCountryCode}
              onChange={(e) => setPhoneCountryCode(e.target.value)}
              placeholder="+234"
              aria-label="Country code"
              autoComplete="tel-country-code"
              className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
            <input
              required={need('phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={need('phone') ? 'Mobile number (required)' : 'Mobile number'}
              aria-label="Mobile number"
              inputMode="tel"
              autoComplete="tel-national"
              className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <input
            required={need('address')}
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder={need('address') ? 'Street address (required)' : 'Street address'}
            aria-label="Street address"
            autoComplete="street-address"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input
            required={need('address')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={need('address') ? 'City (required)' : 'City'}
            aria-label="City"
            autoComplete="address-level2"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
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
            required={need('location')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={need('location') ? 'Public location (required)' : 'Public location (Lagos, Nigeria)'}
            aria-label="Public location"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <textarea
            required={need('bio')}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={need('bio') ? 'Short bio (required)' : 'Short bio'}
            aria-label="Bio"
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

        {canSubscribe && plan && plan.plan !== 'free' && plan.current && plan.status !== 'cancelled' && (
          <form
            className="mt-16 border border-sand bg-white p-6"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!plan.current || !cancelReason) return
              setPlanBusy(true)
              try {
                await api.cancelSubscription(plan.current.id, {
                  reason: cancelReason,
                  detail: cancelDetail.trim() || undefined,
                })
                toast.success('This plan will end after the current period')
                setCancelReason('')
                setCancelDetail('')
                await refresh()
                loadPlan()
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not cancel')
              } finally {
                setPlanBusy(false)
              }
            }}
          >
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#b3382e]">Cancel subscription</p>
            <h2 className="font-serif-display mt-2 text-2xl font-light">End this plan.</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Access lasts through {plan.plusUntil ? plan.plusUntil.slice(0, 10) : 'the paid period'}. Tell us why you are leaving so we can keep a record.
            </p>
            <label className="mt-4 block">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Why are you cancelling?</span>
              <select
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as CancellationReason)}
                aria-label="Cancellation reason"
                className="mt-1 w-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
              >
                <option value="">Choose a reason</option>
                {CANCELLATION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{CANCELLATION_REASON_LABEL[reason]}</option>
                ))}
              </select>
            </label>
            <textarea
              required={cancelReason === 'other'}
              rows={3}
              value={cancelDetail}
              onChange={(e) => setCancelDetail(e.target.value)}
              placeholder={cancelReason === 'other' ? 'Tell us a little more (required)' : 'Anything else (optional)'}
              aria-label="Cancellation details"
              className="mt-3 w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
            <button
              type="submit"
              disabled={planBusy}
              className="mt-4 border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e] disabled:opacity-50"
            >
              Cancel at period end
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
