import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { SubscriptionDto } from '@vuekumi/shared'
import { SiteHeader } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'
import { toast } from 'sonner'

export default function PlusCheckout() {
  const { subscriptionId } = useParams()
  const { format } = useCurrency()
  const { refresh } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!subscriptionId) return
    const data = await api.subscriptionById(subscriptionId)
    setSubscription(data.subscription)
  }

  useEffect(() => {
    load().catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load checkout'))
  }, [subscriptionId])

  async function afterActivate(next: SubscriptionDto) {
    setSubscription(next)
    await refresh()
    toast.success('Vuekumi+ is active — unlimited royalty-free downloads for 30 days')
  }

  async function verify() {
    if (!subscriptionId) return
    setBusy(true)
    try {
      const data = await api.verifySubscription(subscriptionId)
      await afterActivate(data.subscription)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Payment is not complete yet')
    } finally {
      setBusy(false)
    }
  }

  async function completeDev() {
    if (!subscriptionId) return
    setBusy(true)
    try {
      const data = await api.completeDevSubscription(subscriptionId)
      await afterActivate(data.subscription)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not complete test payment')
    } finally {
      setBusy(false)
    }
  }

  const paid = subscription?.status === 'active' || subscription?.status === 'cancelled'

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[640px] px-5 pb-24 pt-28">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Vuekumi+</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">
          {paid ? 'Plus is active.' : 'Complete payment.'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Vuekumi+ lifts the daily royalty-free quota. Premium images stay billed per licence. Copyright stays with the photographer.
        </p>

        {subscription && (
          <div className="mt-8 border border-sand bg-white p-6">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {subscription.provider} · {subscription.status}
            </p>
            <p className="mt-3 text-2xl font-medium">{format(subscription.amountUsd)}</p>
            <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
              USD {subscription.amountUsd.toFixed(2)} · 30 days · charged {subscription.amountLocal.toFixed(2)} {subscription.currency}
            </p>
            {subscription.periodEnd && (
              <p className="mt-4 text-sm text-ink-soft">
                Access through {subscription.periodEnd.slice(0, 10)}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!paid && subscription?.provider === 'dev' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void completeDev()}
              className="bg-ink py-4 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-40"
            >
              {busy ? 'Recording…' : 'Record test payment'}
            </button>
          )}
          {!paid && subscription?.provider !== 'dev' && subscription?.checkoutUrl && (
            <a
              href={subscription.checkoutUrl}
              className="bg-ink py-4 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
            >
              Continue to {subscription.provider}
            </a>
          )}
          {!paid && subscription?.provider !== 'dev' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void verify()}
              className="border border-sand py-4 font-mono-tech text-[11px] uppercase tracking-[0.18em] hover:border-terra disabled:opacity-40"
            >
              {busy ? 'Checking…' : "I've paid — verify"}
            </button>
          )}
          {paid && (
            <Link
              to="/account"
              className="bg-ink py-4 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
            >
              Account &amp; quota
            </Link>
          )}
          <Link
            to="/pricing"
            className="text-center font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra"
          >
            Back to pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
