import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LogoMark } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { ApiError, homeForAccountType } from '../api/client'

type Mode = 'signin' | 'signup'
type Role = 'member' | 'contributor' | 'agency'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role>('member')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, register } = useAuth()

  const redirect = searchParams.get('redirect')

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
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'member' as Role, label: 'Member', note: 'Download' },
                  { id: 'contributor' as Role, label: 'Contributor', note: 'Sell photos' },
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
                  role === 'member' ? 'user' : role === 'contributor' ? 'contributor' : 'agency'
                const user =
                  mode === 'signin'
                    ? await login({ email, password })
                    : await register({ email, password, name, accountType })
                const dest = redirect && redirect.startsWith('/') ? redirect : homeForAccountType(user.accountType)
                navigate(dest)
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Something went wrong')
              } finally {
                setLoading(false)
              }
            }}
          >
            {mode === 'signup' && (
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
              />
            )}
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
            />
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

      <div className="relative hidden overflow-hidden bg-ink-deep lg:block">
        <img src="/images/photos/fashion-portrait.jpg" alt="" className="h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/80 via-ink-deep/10 to-ink-deep/40" />
        <div className="absolute bottom-10 left-10 right-10">
          <p className="font-serif-display text-3xl font-light leading-snug text-paper">
            “My photographs of Dakar now pay my rent in Lagos.
            <em className="text-terra"> That&apos;s the point.”</em>
          </p>
          <p className="mt-4 font-mono-tech text-[10px] uppercase tracking-[0.25em] text-paper-faint">
            Adaeze O. — Contributor since 2024
          </p>
        </div>
      </div>
    </div>
  )
}
