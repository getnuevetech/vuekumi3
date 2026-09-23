import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { AgencyInvitePreviewDto } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { LogoMark } from '../components/shared'
import { useAuth } from '../context/AuthContext'

export default function JoinAgency() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [preview, setPreview] = useState<AgencyInvitePreviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      return
    }
    api.agencyInvitePreview(token)
      .then((d) => {
        setPreview(d.invite)
        setStatus('ready')
      })
      .catch(() => setStatus('missing'))
  }, [token])

  const signedInMatch = Boolean(user && preview && user.email.toLowerCase() === preview.email)

  async function accept() {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await api.acceptAgencyInvite(token, preview?.needsAccount ? { firstName, lastName, password } : {})
      await refresh()
      navigate('/agency')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Join an agency.</h1>
        {status === 'loading' && <p className="mt-4 text-sm text-ink-soft">Checking invite…</p>}
        {status === 'missing' && (
          <p className="mt-4 text-sm text-[#b3382e]">
            This invite is invalid or expired.{' '}
            <Link to="/login" className="text-terra underline underline-offset-2">Sign in</Link>
          </p>
        )}
        {status === 'ready' && preview && (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              {preview.agencyName} invited <strong>{preview.email}</strong> as {preview.role}.
            </p>
            {preview.needsAccount ? (
              <form
                className="mt-8 space-y-3"
                onSubmit={(e) => { e.preventDefault(); void accept() }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                  />
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                  />
                </div>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (8+ characters)"
                  className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                />
                {error && <p className="text-sm text-[#b3382e]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-terra disabled:opacity-50"
                >
                  Create account & join
                </button>
              </form>
            ) : signedInMatch ? (
              <div className="mt-8 space-y-3">
                {error && <p className="text-sm text-[#b3382e]">{error}</p>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accept()}
                  className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-terra disabled:opacity-50"
                >
                  Accept invite
                </button>
              </div>
            ) : (
              <p className="mt-8 text-sm text-ink-soft">
                Sign in as {preview.email} to join.{' '}
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/join/${token}`)}`}
                  className="text-terra underline underline-offset-2"
                >
                  Sign in
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
