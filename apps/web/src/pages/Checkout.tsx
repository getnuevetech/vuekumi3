import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { LicenseGrantDto, PaymentDto } from '@vuekumi/shared'
import { SiteHeader } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useCurrency } from '../context/CurrencyContext'
import { toast } from 'sonner'

export default function Checkout() {
  const { paymentId } = useParams()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const { format } = useCurrency()
  const [payment, setPayment] = useState<PaymentDto | null>(null)
  const [grant, setGrant] = useState<LicenseGrantDto | null>(null)
  const [busy, setBusy] = useState(false)
  const confirmStarted = useRef(false)

  const load = async () => {
    if (!paymentId) return
    const data = await api.payment(paymentId)
    setPayment(data.payment)
    setGrant(data.grant)
  }

  useEffect(() => {
    load().catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load payment'))
  }, [paymentId])

  useEffect(() => {
    if (!paymentId || !sessionId || confirmStarted.current) return
    confirmStarted.current = true
    void verify()
  }, [paymentId, sessionId])

  async function afterGrant(next: LicenseGrantDto) {
    setGrant(next)
    await api.downloadCertificate(next.id)
    if (next.hasOriginal) {
      await api.downloadGrantFile(next.id).catch(() => undefined)
    }
    toast.success('Licence granted — certificate downloaded')
  }

  async function verify() {
    if (!paymentId) return
    setBusy(true)
    try {
      const data = await api.verifyPayment(paymentId)
      await afterGrant(data.grant)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Payment is not complete yet')
    } finally {
      setBusy(false)
    }
  }

  async function completeDev() {
    if (!paymentId) return
    setBusy(true)
    try {
      const data = await api.completeDevPayment(paymentId)
      await afterGrant(data.grant)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not complete test payment')
    } finally {
      setBusy(false)
    }
  }

  const paid = payment?.status === 'paid' || Boolean(grant)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[640px] px-5 pb-24 pt-28">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Checkout</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">
          {paid ? 'Licence paid.' : busy && sessionId ? 'Confirming payment.' : 'Complete payment.'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Vuekumi sells usage permission, not ownership. The grant and certificate issue after payment clears.
        </p>

        {payment && (
          <div className="mt-8 border border-sand bg-white p-6">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {payment.provider} · {payment.status}
            </p>
            <p className="mt-3 text-2xl font-medium">{format(payment.amountUsd)}</p>
            <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
              USD {payment.amountUsd.toFixed(2)} · charged {payment.amountLocal.toFixed(2)} {payment.currency}
            </p>
            {grant && (
              <p className="mt-4 text-sm">
                Certificate <span className="font-mono-tech text-xs">{grant.certificateCode}</span>
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!paid && payment?.provider === 'dev' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void completeDev()}
              className="bg-ink py-4 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-40"
            >
              {busy ? 'Recording…' : 'Record test payment'}
            </button>
          )}
          {!paid && payment?.provider !== 'dev' && payment?.checkoutUrl && (
            <a
              href={payment.checkoutUrl}
              className="bg-ink py-4 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
            >
              Continue to {payment.provider}
            </a>
          )}
          {!paid && payment?.provider !== 'dev' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void verify()}
              className="border border-sand py-4 font-mono-tech text-[11px] uppercase tracking-[0.18em] hover:border-terra disabled:opacity-40"
            >
              {busy ? 'Checking…' : "I've paid — verify"}
            </button>
          )}
          {paid && grant && (
            <Link
              to="/licenses"
              className="bg-ink py-4 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
            >
              Your licences
            </Link>
          )}
          {payment && (
            <Link
              to={`/photo/${payment.photoId}`}
              className="text-center font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra"
            >
              Back to photograph
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
