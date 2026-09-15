import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { ModelInvitePreviewDto } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { LogoMark } from '../components/shared'
import { useAuth } from '../context/AuthContext'

export default function JoinModel() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [preview, setPreview] = useState<ModelInvitePreviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      return
    }
    api.modelInvitePreview(token)
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
      await api.acceptModelInvite(token, preview?.needsAccount ? { name, password } : {})
      await refresh()
      navigate('/model')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not claim invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Claim a model profile.</h1>
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
              {preview.photographerName} identified <strong>{preview.displayName}</strong> in {preview.photoTitle}.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Invited as {preview.email}. A typed name is not identity. Confirm likeness on the next screen — a checkbox is not consent.
            </p>
            {preview.needsAccount ? (
              <form
                className="mt-8 space-y-3"
                onSubmit={(e) => { e.preventDefault(); void accept() }}
              >
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                />
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
                  Create account & claim
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
                  Claim this profile
                </button>
              </div>
            ) : (
              <p className="mt-8 text-sm text-ink-soft">
                Sign in as {preview.email} to claim.{' '}
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/invite/model/${token}`)}`}
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
