import { useState } from 'react'
import { Link } from 'react-router'
import { api, ApiError } from '../api/client'
import { LogoMark } from '../components/shared'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Reset password.</h1>
        <p className="mt-2 text-sm text-ink-soft">We&apos;ll email you a link to choose a new password.</p>

        {sent ? (
          <p className="mt-8 rounded-2xl border border-sand-soft bg-cream px-4 py-3 text-sm text-ink-soft">
            If an account exists for that email, a reset link has been sent.
          </p>
        ) : (
          <form
            className="mt-8 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await api.forgotPassword(email)
                setSent(true)
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Something went wrong')
              }
            }}
          >
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
            />
            {error && <p className="text-sm text-[#b3382e]">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-terra"
            >
              Send reset link
            </button>
          </form>
        )}

        <p className="mt-6 text-center font-mono-tech text-[10px] text-ink-faint">
          <Link to="/login" className="text-terra underline underline-offset-2">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
