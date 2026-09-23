import Stripe from 'stripe'
import { PaymentError } from './payment-error.js'
import {
  paymentSecrets,
  STRIPE_NOT_CONFIGURED,
  usableStripeSecret,
  type CheckoutProvider,
} from './payments-config.js'

export function paymentErrorFromStripe(err: unknown): PaymentError {
  const status =
    err && typeof err === 'object' && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 0
  const type = err && typeof err === 'object' && 'type' in err ? String((err as { type: unknown }).type) : ''
  const raw = err instanceof Error ? err.message : ''
  const redacted = raw.replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+/g, '…').slice(0, 240)
  if (status === 401 || type === 'StripeAuthenticationError') {
    return new PaymentError(
      'Stripe rejected the API key. In Admin → Gateways, open Stripe and paste the secret key (sk_… or rk_…), not the publishable key.',
      400,
    )
  }
  if (type === 'StripeConnectionError' || (!status && /ECONN|ENOTFOUND|network|timeout/i.test(raw))) {
    return new PaymentError('Could not reach Stripe. Try again in a moment.', 502)
  }
  if (status === 400 || type === 'StripeInvalidRequestError') {
    return new PaymentError(redacted || 'Stripe rejected the checkout request.', 400)
  }
  return new PaymentError(redacted || 'Stripe checkout failed.', status >= 400 && status < 500 ? status : 502)
}

export async function openGatewayCheckout(input: {
  checkoutId: string
  provider: CheckoutProvider
  amountUsd: number
  amountLocal: number
  currency: string
  buyerEmail: string
  buyerName: string
  description: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  secrets: Awaited<ReturnType<typeof paymentSecrets>>
}) {
  if (input.provider === 'dev') {
    return { url: input.successUrl, ref: `dev_${input.checkoutId}` }
  }

  if (input.provider === 'stripe') {
    const secret = usableStripeSecret(input.secrets.stripeSecret)
    if (!secret) throw new PaymentError(STRIPE_NOT_CONFIGURED, 400)
    try {
      const stripe = new Stripe(secret)
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: input.buyerEmail,
        success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.max(50, Math.round(input.amountUsd * 100)),
              product_data: { name: input.description },
            },
          },
        ],
        metadata: input.metadata,
      })
      if (!session.url) throw new PaymentError('Stripe did not return a checkout URL', 502)
      return { url: session.url, ref: session.id }
    } catch (err) {
      if (err instanceof PaymentError) throw err
      throw paymentErrorFromStripe(err)
    }
  }

  const res = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secrets.flutterwaveSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: input.checkoutId,
      amount: input.amountLocal,
      currency: input.currency,
      redirect_url: input.successUrl,
      customer: { email: input.buyerEmail, name: input.buyerName },
      customizations: {
        title: 'Vuekumi',
        description: input.description,
      },
      meta: input.metadata,
    }),
  })
  let json: { status?: string; data?: { link?: string }; message?: string }
  try {
    json = (await res.json()) as { status?: string; data?: { link?: string }; message?: string }
  } catch {
    throw new PaymentError('Flutterwave did not return a checkout link. Check the Flutterwave secret key on Admin → Gateways.', 502)
  }
  if (!res.ok || !json.data?.link) {
    throw new PaymentError(json.message ?? 'Flutterwave checkout failed', 502)
  }
  return { url: json.data.link, ref: input.checkoutId }
}
