import type { Prisma } from '@prisma/client'
import Stripe from 'stripe'
import { config } from '../config.js'
import type { GrantWithRelations } from './grants.js'
import { convertFromUsd, pricingForCountry } from './fx.js'
import { issueGrant } from './grants.js'
import {
  chooseProvider,
  flutterwaveCurrency,
  paymentSecrets,
  type CheckoutProvider,
} from './payments-config.js'
import { prisma } from './prisma.js'

export class PaymentError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'PaymentError'
    this.statusCode = statusCode
  }
}

export async function startLicenseCheckout(input: {
  buyerId: string
  buyerEmail: string
  buyerName: string
  buyerCountry?: string | null
  photoId: string
  productId: string
  licenseType: Parameters<typeof issueGrant>[0]['licenseType']
  amountUsd: number
  currency?: string
  agencyId?: string | null
  quoteId?: string | null
  scopeJson: Record<string, unknown>
  requestedProvider?: 'stripe' | 'flutterwave'
}) {
  const secrets = await paymentSecrets()
  const country = input.buyerCountry
    ? await prisma.country.findUnique({ where: { code: input.buyerCountry.toUpperCase() } })
    : null
  const provider = chooseProvider({
    requested: input.requestedProvider,
    stripe: Boolean(secrets.stripeSecret),
    flutterwave: Boolean(secrets.flutterwaveSecret),
    africanBuyer: country?.region === 'africa',
    allowDev: config.isDev,
  })

  const pricing = await pricingForCountry(input.buyerCountry)
  const currency =
    provider === 'flutterwave'
      ? flutterwaveCurrency((input.currency ?? pricing.currency).toUpperCase())
      : 'USD'
  const rate = currency === 'USD' ? 1 : currency === pricing.currency ? pricing.rateToUsd : pricing.rateToUsd
  const amountLocal = currency === 'USD' ? input.amountUsd : convertFromUsd(input.amountUsd, rate)

  const staleBefore = new Date(Date.now() - 30 * 60_000)
  const existing = await prisma.payment.findFirst({
    where: {
      buyerId: input.buyerId,
      photoId: input.photoId,
      productId: input.productId,
      status: 'pending',
      createdAt: { gte: staleBefore },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing?.checkoutUrl) {
    return existing
  }

  const payment = await prisma.payment.create({
    data: {
      buyerId: input.buyerId,
      photoId: input.photoId,
      productId: input.productId,
      quoteId: input.quoteId,
      provider,
      status: 'pending',
      amountUsd: input.amountUsd,
      currency,
      amountLocal,
      metadata: {
        licenseType: input.licenseType,
        agencyId: input.agencyId,
        scopeJson: input.scopeJson,
        buyerEmail: input.buyerEmail,
      } as Prisma.InputJsonValue,
    },
  })

  const checkout = await createProviderCheckout({
    paymentId: payment.id,
    provider,
    amountUsd: input.amountUsd,
    amountLocal,
    currency,
    photoId: input.photoId,
    buyerEmail: input.buyerEmail,
    buyerName: input.buyerName,
    description: `Vuekumi licence — ${input.licenseType.replace('_', ' ')}`,
    secrets,
  })

  return prisma.payment.update({
    where: { id: payment.id },
    data: { checkoutUrl: checkout.url, providerRef: checkout.ref },
  })
}

async function createProviderCheckout(input: {
  paymentId: string
  provider: CheckoutProvider
  amountUsd: number
  amountLocal: number
  currency: string
  photoId: string
  buyerEmail: string
  buyerName: string
  description: string
  secrets: Awaited<ReturnType<typeof paymentSecrets>>
}) {
  const returnUrl = `${config.webUrl}/checkout/${input.paymentId}`
  const cancelUrl = `${config.webUrl}/photo/${input.photoId}?checkout=cancelled`

  if (input.provider === 'dev') {
    return { url: returnUrl, ref: `dev_${input.paymentId}` }
  }

  if (input.provider === 'stripe') {
    const stripe = new Stripe(input.secrets.stripeSecret)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.buyerEmail,
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
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
      metadata: { paymentId: input.paymentId, photoId: input.photoId },
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
      tx_ref: input.paymentId,
      amount: input.amountLocal,
      currency: input.currency,
      redirect_url: returnUrl,
      customer: { email: input.buyerEmail, name: input.buyerName },
      customizations: {
        title: 'Vuekumi',
        description: input.description,
      },
      meta: { paymentId: input.paymentId, photoId: input.photoId },
    }),
  })
  const json = (await res.json()) as { status?: string; data?: { link?: string }; message?: string }
  if (!res.ok || !json.data?.link) {
    throw new PaymentError(json.message ?? 'Flutterwave checkout failed', 502)
  }
  return { url: json.data.link, ref: input.paymentId }
}

export async function fulfillPayment(paymentId: string, providerRef?: string): Promise<GrantWithRelations> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { grant: { include: { photo: true, product: true } } },
  })
  if (!payment) throw new PaymentError('Payment not found', 404)
  if (payment.status === 'paid' && payment.grant) return payment.grant
  if (payment.status === 'failed' || payment.status === 'cancelled') {
    throw new PaymentError('Payment was not completed', 400)
  }

  const meta = (payment.metadata ?? {}) as {
    licenseType?: Parameters<typeof issueGrant>[0]['licenseType']
    agencyId?: string | null
    scopeJson?: Record<string, unknown>
  }

  const grant = await prisma.$transaction(async (tx): Promise<GrantWithRelations> => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'pending' },
      data: {
        status: 'paid',
        paidAt: new Date(),
        ...(providerRef ? { providerRef } : {}),
      },
    })
    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { grant: { include: { photo: true, product: true } } },
      })
      if (current?.grant) return current.grant
    }

    const issued = await issueGrant(
      {
        buyerId: payment.buyerId,
        photoId: payment.photoId,
        productId: payment.productId,
        agencyId: meta.agencyId,
        quoteId: payment.quoteId,
        licenseType: meta.licenseType ?? 'commercial',
        amountUsd: payment.amountUsd,
        currency: payment.currency,
        amountLocal: payment.amountLocal,
        scopeJson: meta.scopeJson ?? { grant: 'usage_permission', ownership: false },
        paymentId: payment.id,
      },
      tx,
    )

    await tx.payment.update({
      where: { id: paymentId },
      data: { grantId: issued.id, status: 'paid', paidAt: new Date() },
    })
    return issued
  })

  return grant
}

export async function verifyAndFulfill(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new PaymentError('Payment not found', 404)
  if (payment.status === 'paid') return fulfillPayment(paymentId)

  const secrets = await paymentSecrets()

  if (payment.provider === 'stripe' && payment.providerRef && secrets.stripeSecret) {
    const stripe = new Stripe(secrets.stripeSecret)
    const session = await stripe.checkout.sessions.retrieve(payment.providerRef)
    if (session.payment_status === 'paid' || session.status === 'complete') {
      return fulfillPayment(paymentId, session.id)
    }
    throw new PaymentError('Stripe payment is not complete yet', 409)
  }

  if (payment.provider === 'flutterwave' && secrets.flutterwaveSecret) {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.id)}`,
      { headers: { Authorization: `Bearer ${secrets.flutterwaveSecret}` } },
    )
    const json = (await res.json()) as { status?: string; data?: { status?: string; id?: number } }
    if (json.status === 'success' && json.data?.status === 'successful') {
      return fulfillPayment(paymentId, String(json.data.id ?? payment.id))
    }
    throw new PaymentError('Flutterwave payment is not complete yet', 409)
  }

  if (payment.provider === 'dev') {
    throw new PaymentError('Confirm the test payment to issue the grant', 409)
  }

  throw new PaymentError('Unable to verify this payment yet', 409)
}

export async function completeDevPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new PaymentError('Payment not found', 404)
  if (payment.provider !== 'dev' || !config.isDev) {
    throw new PaymentError('Test completion is only available in development', 403)
  }
  return fulfillPayment(paymentId, `dev_${paymentId}`)
}

export async function handleStripeWebhook(rawBody: Buffer | string, signature: string | undefined) {
  const secrets = await paymentSecrets()
  if (!secrets.stripeSecret || !secrets.stripeWebhook) {
    throw new PaymentError('Stripe webhook is not configured', 503)
  }
  if (!signature) throw new PaymentError('Missing Stripe signature', 400)
  const stripe = new Stripe(secrets.stripeSecret)
  const event = stripe.webhooks.constructEvent(rawBody, signature, secrets.stripeWebhook)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const paymentId = session.metadata?.paymentId
    if (paymentId) await fulfillPayment(paymentId, session.id)
  }
  return { received: true }
}

export async function handleFlutterwaveWebhook(payload: Record<string, unknown>, hashHeader?: string) {
  const secrets = await paymentSecrets()
  if (secrets.flutterwaveHash && hashHeader && hashHeader !== secrets.flutterwaveHash) {
    throw new PaymentError('Invalid Flutterwave hash', 401)
  }
  const data = (payload.data ?? payload) as { status?: string; tx_ref?: string; id?: number }
  const event = String(payload.event ?? payload['event.type'] ?? '')
  const ok = data.status === 'successful' || event.includes('charge.completed')
  const paymentId = data.tx_ref
  if (ok && paymentId) {
    await fulfillPayment(paymentId, data.id != null ? String(data.id) : paymentId)
  }
  return { received: true }
}
