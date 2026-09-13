import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../api/client'
import { LogoMark } from '../components/shared'

export default function VerifyEmail() {
  const { token } = useParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    api.verifyEmail(token)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md text-center">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Email verification</h1>
        {status === 'loading' && <p className="mt-4 text-sm text-ink-soft">Verifying…</p>}
        {status === 'ok' && (
          <p className="mt-4 text-sm text-ink-soft">
            Your email is verified.{' '}
            <Link to="/login" className="text-terra underline underline-offset-2">Sign in</Link>
          </p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-[#b3382e]">
            Invalid or expired link.{' '}
            <Link to="/login" className="text-terra underline underline-offset-2">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}
