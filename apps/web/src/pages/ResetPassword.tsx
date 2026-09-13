import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, ApiError } from '../api/client'
import { LogoMark } from '../components/shared'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">New password.</h1>
        <p className="mt-2 text-sm text-ink-soft">Choose a password with at least 8 characters.</p>

        {done ? (
          <p className="mt-8 text-sm text-ink-soft">
            Password updated.{' '}
            <Link to="/login" className="text-terra underline underline-offset-2">Sign in</Link>
          </p>
        ) : (
          <form
            className="mt-8 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!token) return
              setError(null)
              try {
                await api.resetPassword(token, password)
                setDone(true)
                setTimeout(() => navigate('/login'), 1500)
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Invalid or expired link')
              }
            }}
          >
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
            />
            {error && <p className="text-sm text-[#b3382e]">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-terra"
            >
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
