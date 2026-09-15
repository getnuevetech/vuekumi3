import Stripe from 'stripe'
import { config } from '../config.js'
import { PaymentError } from './payment-error.js'
import {
  paymentSecrets,
  type CheckoutProvider,
} from './payments-config.js'

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
    const stripe = new Stripe(input.secrets.stripeSecret)
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
  const json = (await res.json()) as { status?: string; data?: { link?: string }; message?: string }
  if (!res.ok || !json.data?.link) {
    throw new PaymentError(json.message ?? 'Flutterwave checkout failed', 502)
  }
  return { url: json.data.link, ref: input.checkoutId }
}
