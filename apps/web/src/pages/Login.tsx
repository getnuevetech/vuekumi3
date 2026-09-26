import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageImagePanel } from '../components/PageImagePanel'
import { LogoMark } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { useSiteContent } from '../context/SiteContentContext'
import { api, ApiError, homeForUser, type GeoCountry } from '../api/client'
import type { PublicConfigDto } from '@vuekumi/shared'

function oauthErrorMessage(code: string): string {
  if (code === 'denied') return 'Google sign-in was cancelled.'
  if (code === 'unverified') return 'Google must verify that email before we can sign you in.'
  if (code === 'suspended') return 'This account is suspended.'
  if (code === 'not_configured') return 'Google sign-in is not configured yet.'
  return 'Google sign-in failed. Try email instead.'
}

function safeRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

type Mode = 'signin' | 'signup'
type Role = 'member' | 'photographer' | 'photo_influencer' | 'contributor' | 'agency' | 'model'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role>('member')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState('')
  const [acceptAgreement, setAcceptAgreement] = useState(false)
  const [agreementTitle, setAgreementTitle] = useState('VueKumi Contributor Platform Agreement')
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [overlay, setOverlay] = useState<{ dataTransferNotice: string; commissionedPhotoPrompt: string; extraNotice: string | null; overlayKind: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauth, setOauth] = useState<PublicConfigDto['oauth']>({ google: false, dev: false })
  const { panels } = useSiteContent()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, register, completeSession } = useAuth()

  const redirect = safeRedirect(searchParams.get('redirect'))
  const signupRole = searchParams.get('signup')
  const wantsCreator =
    signupRole === 'photographer'
    || signupRole === 'photo_influencer'
    || signupRole === 'contributor'
    || Boolean(redirect?.startsWith('/contributor'))
  const wantsModel = signupRole === 'model' || Boolean(redirect?.startsWith('/model'))
  const creatorRole = role === 'photographer' || role === 'photo_influencer' || role === 'contributor'
  const modelRole = role === 'model'
  const needsAgreement = creatorRole || modelRole
  const showOauth = oauth.google || oauth.dev
  const oauthAllowed = mode === 'signin' || role === 'member'

  useEffect(() => {
    api.publicConfig()
      .then((cfg) => setOauth(cfg.oauth))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const err = searchParams.get('oauth_error')
    if (err) setError(oauthErrorMessage(err))
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('mode') !== 'signup') return
    setMode('signup')
  }, [searchParams])

  useEffect(() => {
    if (!wantsCreator && !wantsModel) return
    setMode('signup')
    setRole(
      signupRole === 'contributor'
        ? 'contributor'
        : signupRole === 'photo_influencer'
          ? 'photo_influencer'
          : signupRole === 'model'
            ? 'model'
            : 'photographer',
    )
  }, [wantsCreator, wantsModel, signupRole])

  useEffect(() => {
    if (searchParams.get('oauth') !== 'ok') return
    setLoading(true)
    completeSession()
      .then((user) => {
        const dest = redirect ?? homeForUser(user)
        navigate(dest)
      })
      .catch(() => setError('Signed in with Google, but the session could not be loaded.'))
      .finally(() => setLoading(false))
  }, [completeSession, navigate, redirect, searchParams])

  useEffect(() => {
    if (mode !== 'signup') return
    api.countries(creatorRole)
      .then((d) => setCountries(d.countries))
      .catch(() => setCountries([]))
    if (needsAgreement) {
      const kind = role === 'contributor'
        ? 'contributor'
        : role === 'photo_influencer'
          ? 'photo_influencer'
          : role === 'model'
            ? 'model'
            : 'photographer'
      api.agreement(kind).then((a) => setAgreementTitle(a.title)).catch(() => undefined)
    }
  }, [mode, role, creatorRole, needsAgreement])

  useEffect(() => {
    if (mode !== 'signup' || !country) {
      setOverlay(null)
      return
    }
    api.legalOverlay(country)
      .then((d) => setOverlay(d.overlay))
      .catch(() => setOverlay(null))
  }, [mode, country])

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 pt-28 pb-16 lg:pt-16">
        <div className="w-full max-w-md">
          <LogoMark />

          <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">
            {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {mode === 'signin'
              ? 'Sign in to download, upload and manage your account.'
              : 'Join the marketplace for African imagery.'}
          </p>

          <div className="mt-8 flex rounded-full border border-sand-soft bg-cream p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 rounded-full py-2 font-mono-tech text-[10px] uppercase tracking-[0.18em] transition-colors ${
                  mode === m ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'member' as Role, label: 'Member', note: 'License photos' },
                  { id: 'photographer' as Role, label: 'Photographer', note: 'Commercial stock' },
                  { id: 'photo_influencer' as Role, label: 'Photo influencer', note: 'Social & discovery' },
                  { id: 'contributor' as Role, label: 'Contributor', note: 'Portfolio / community' },
                  { id: 'model' as Role, label: 'Model', note: 'Likeness & upload' },
                  { id: 'agency' as Role, label: 'Agency', note: 'Enterprise' },
                ]
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${
                    role === r.id ? 'border-terra bg-terra/5' : 'border-sand-soft hover:border-terra/50'
                  }`}
                >
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="mt-0.5 block font-mono-tech text-[9px] text-ink-faint">{r.note}</span>
                </button>
              ))}
            </div>
          )}

          <form
            className="mt-6 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              setError(null)
              try {
                const accountType =
                  role === 'member' ? 'user' : role === 'agency' ? 'agency' : role
                const user =
                  mode === 'signin'
                    ? await login({ email, password })
                    : await register({
                        email,
                        password,
                        firstName,
                        lastName,
                        accountType,
                        country: country || undefined,
                        acceptAgreement: needsAgreement ? acceptAgreement : undefined,
                      })
                const dest = redirect ?? homeForUser(user)
                navigate(dest)
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Something went wrong')
              } finally {
                setLoading(false)
              }
            }}
          >
            {mode === 'signup' && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
                  />
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
                  />
                </div>
                <select
                  required={creatorRole}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                >
                  <option value="">{creatorRole ? 'African country (required)' : 'Country (optional)'}</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} · {c.currency}</option>
                  ))}
                </select>
                {creatorRole && (
                  <p className="font-mono-tech text-[10px] text-ink-faint">
                    {role === 'photographer'
                      ? 'Professional photographers must be based in an African country.'
                      : role === 'photo_influencer'
                        ? 'Photo influencers must be based in an African country. This is not a photographer account.'
                        : 'Community contributors must be based in an African country.'}
                  </p>
                )}
                {modelRole && (
                  <p className="font-mono-tech text-[10px] text-ink-faint">
                    Models as subjects are not Africa-restricted. Commercial self-shot work later requires the photographer agreement and an African country.
                  </p>
                )}
                {overlay && (
                  <div className="space-y-2 rounded-2xl border border-sand-soft bg-white px-4 py-3 text-[13px] text-ink-soft">
                    <p>{overlay.dataTransferNotice}</p>
                    {creatorRole && <p>{overlay.commissionedPhotoPrompt}</p>}
                    {overlay.extraNotice && <p>{overlay.extraNotice}</p>}
                    <p className="font-mono-tech text-[10px] text-ink-faint">Product notice. Not legal advice. Counsel has not signed this overlay.</p>
                  </div>
                )}
              </>
            )}
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
            />
            {mode === 'signup' && needsAgreement && (
              <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  required
                  checked={acceptAgreement}
                  onChange={(e) => setAcceptAgreement(e.target.checked)}
                  className="mt-0.5 accent-[#bc773f]"
                />
                I accept the {agreementTitle}. Vuekumi receives a platform licence to sublicense usage rights — not ownership of my photographs.
              </label>
            )}
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
            />
            {error && <p className="text-sm text-[#b3382e]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-paper transition-colors hover:bg-terra disabled:opacity-50"
            >
              {loading
                ? 'Please wait…'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          {showOauth && oauthAllowed && (
            <div className="mt-5">
              <p className="mb-3 text-center font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-faint">or</p>
              {oauth.google && (
                <a
                  href={`/api/auth/oauth/google/start${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                  className="flex w-full items-center justify-center rounded-full border border-sand-soft bg-white py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-ink transition-colors hover:border-terra"
                >
                  Continue with Google
                </a>
              )}
              {oauth.dev && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    const nextEmail = email || window.prompt('Dev Google email') || ''
                    if (!nextEmail) return
                    setLoading(true)
                    setError(null)
                    try {
                      const { user } = await api.oauthDev({
                        email: nextEmail,
                        name: [firstName, lastName].filter(Boolean).join(' ') || nextEmail.split('@')[0],
                      })
                      const signedIn = await completeSession().catch(() => user)
                      navigate(redirect ?? homeForUser(signedIn))
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : 'Dev Google sign-in failed')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="flex w-full items-center justify-center rounded-full border border-sand-soft bg-white py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-ink transition-colors hover:border-terra disabled:opacity-50"
                >
                  Continue with Google (dev)
                </button>
              )}
            </div>
          )}

          {mode === 'signup' && role !== 'member' && (
            <p className="mt-4 text-center text-[12px] text-ink-faint">
              Contributors, models, and agencies register with email so we can collect the platform agreement.
            </p>
          )}

          {mode === 'signin' && (
            <p className="mt-4 text-center font-mono-tech text-[10px] text-ink-faint">
              <Link to="/forgot-password" className="text-terra underline underline-offset-2">Forgot password?</Link>
            </p>
          )}

          <p className="mt-6 text-center font-mono-tech text-[10px] leading-relaxed text-ink-faint">
            Demo: admin@vuekumi.com / Admin123!
          </p>
        </div>
      </div>

      <PageImagePanel panel={panels.auth} />
    </div>
  )
}
