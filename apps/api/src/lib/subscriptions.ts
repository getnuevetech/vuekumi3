import type { Prisma, Subscription, UserProfile } from '@prisma/client'
import Stripe from 'stripe'
import {
  FREE_PLAN,
  FREE_RF_DAILY_QUOTA,
  PLUS_PERIOD_DAYS,
  PLUS_PLAN,
  PLUS_PRICE_USD,
  type QuotaDto,
  type SubscriptionDto,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@vuekumi/shared'
import { config } from '../config.js'
import { openGatewayCheckout } from './checkout.js'
import { convertFromUsd, pricingForCountry } from './fx.js'
import { PaymentError } from './payment-error.js'
import {
  assertStripeSecretUsable,
  chooseProvider,
  flutterwaveCurrency,
  paymentSecrets,
  usableStripeSecret,
} from './payments-config.js'
import { prisma } from './prisma.js'

type Tx = Prisma.TransactionClient
type Db = Tx | typeof prisma

export class QuotaError extends Error {
  statusCode: number
  quota: QuotaDto
  constructor(message: string, quota: QuotaDto, statusCode = 429) {
    super(message)
    this.name = 'QuotaError'
    this.statusCode = statusCode
    this.quota = quota
  }
}

export class SubscriptionError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'SubscriptionError'
    this.statusCode = statusCode
  }
}

export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function isPlusActive(
  profile: { subscriptionPlan: string; plusUntil: Date | null } | null | undefined,
  now = new Date(),
): boolean {
  if (!profile || profile.subscriptionPlan !== PLUS_PLAN || !profile.plusUntil) return false
  return profile.plusUntil.getTime() > now.getTime()
}

export function displayQuota(
  profile: {
    subscriptionPlan: string
    plusUntil: Date | null
    downloadQuotaUsed: number
    downloadQuotaReset: Date
  } | null | undefined,
  now = new Date(),
): QuotaDto {
  const day = utcDayStart(now)
  if (isPlusActive(profile, now)) {
    return {
      used: 0,
      limit: null,
      remaining: null,
      unlimited: true,
      resetAt: day.toISOString(),
    }
  }
  const resetAt = !profile || profile.downloadQuotaReset.getTime() < day.getTime() ? day : profile.downloadQuotaReset
  const used = !profile || profile.downloadQuotaReset.getTime() < day.getTime() ? 0 : profile.downloadQuotaUsed
  return {
    used,
    limit: FREE_RF_DAILY_QUOTA,
    remaining: Math.max(0, FREE_RF_DAILY_QUOTA - used),
    unlimited: false,
    resetAt: resetAt.toISOString(),
  }
}

export function displayPlan(
  profile: { subscriptionPlan: string; plusUntil: Date | null } | null | undefined,
  now = new Date(),
): SubscriptionPlan {
  return isPlusActive(profile, now) ? PLUS_PLAN : FREE_PLAN
}

type QuotaSnapshot = {
  plan: SubscriptionPlan
  plusUntil: Date | null
  used: number
  resetAt: Date
}

export function quotaAfterConsume(snapshot: QuotaSnapshot, now = new Date()): {
  ok: boolean
  next?: QuotaSnapshot
  error?: string
  unlimited?: boolean
} {
  if (isPlusActive({ subscriptionPlan: snapshot.plan, plusUntil: snapshot.plusUntil }, now)) {
    return { ok: true, unlimited: true, next: snapshot }
  }
  const day = utcDayStart(now)
  const used = snapshot.resetAt.getTime() < day.getTime() ? 0 : snapshot.used
  if (used >= FREE_RF_DAILY_QUOTA) {
    return {
      ok: false,
      error: 'Daily royalty-free download limit reached. Upgrade to Vuekumi+ for unlimited free-collection downloads.',
    }
  }
  return {
    ok: true,
    unlimited: false,
    next: {
      plan: FREE_PLAN,
      plusUntil: snapshot.plusUntil,
      used: used + 1,
      resetAt: snapshot.resetAt.getTime() < day.getTime() ? day : snapshot.resetAt,
    },
  }
}

export function plusPeriod(from = new Date(), days = PLUS_PERIOD_DAYS) {
  const periodStart = from
  const periodEnd = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
  return { periodStart, periodEnd }
}

export function cancelKeepsAccess(periodEnd: Date | null, now = new Date()) {
  return Boolean(periodEnd && periodEnd.getTime() > now.getTime())
}

export async function ensureUserProfile(userId: string, client: Db = prisma): Promise<UserProfile> {
  const existing = await client.userProfile.findUnique({ where: { userId } })
  if (existing) return existing
  return client.userProfile.create({ data: { userId, downloadQuotaReset: utcDayStart() } })
}

export async function expirePlusIfNeeded(profile: UserProfile, now = new Date(), client: Db = prisma): Promise<UserProfile> {
  if (profile.subscriptionPlan !== PLUS_PLAN) return profile
  if (profile.plusUntil && profile.plusUntil.getTime() > now.getTime()) return profile

  await client.subscription.updateMany({
    where: { userId: profile.userId, status: { in: ['active', 'cancelled'] }, periodEnd: { lte: now } },
    data: { status: 'expired' },
  })

  return client.userProfile.update({
    where: { id: profile.id },
    data: { subscriptionPlan: FREE_PLAN, plusUntil: null },
  })
}

export async function consumeRfQuota(userId: string, client: Db = prisma): Promise<QuotaDto> {
  const now = new Date()
  let profile = await ensureUserProfile(userId, client)
  profile = await expirePlusIfNeeded(profile, now, client)
  const quota = displayQuota(profile, now)

  if (quota.unlimited) return quota

  const day = utcDayStart(now)
  if (profile.downloadQuotaReset.getTime() < day.getTime()) {
    profile = await client.userProfile.update({
      where: { id: profile.id },
      data: { downloadQuotaUsed: 0, downloadQuotaReset: day },
    })
  }

  if (profile.downloadQuotaUsed >= FREE_RF_DAILY_QUOTA) {
    throw new QuotaError(
      'Daily royalty-free download limit reached. Upgrade to Vuekumi+ for unlimited free-collection downloads.',
      displayQuota(profile, now),
    )
  }

  const updated = await client.userProfile.update({
    where: { id: profile.id },
    data: { downloadQuotaUsed: { increment: 1 } },
  })
  return displayQuota(updated, now)
}

export function serializeSubscription(row: Subscription): SubscriptionDto {
  return {
    id: row.id,
    plan: PLUS_PLAN,
    status: row.status as SubscriptionStatus,
    amountUsd: row.amountUsd,
    currency: row.currency,
    amountLocal: row.amountLocal,
    provider: row.provider as SubscriptionDto['provider'],
    checkoutUrl: row.checkoutUrl,
    periodStart: row.periodStart?.toISOString() ?? null,
    periodEnd: row.periodEnd?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function activatePlus(userId: string, subscriptionId: string, now = new Date(), client: Db = prisma) {
  const { periodStart, periodEnd } = plusPeriod(now)
  const updated = await client.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'active',
      periodStart,
      periodEnd,
    },
  })
  await ensureUserProfile(userId, client)
  await client.userProfile.update({
    where: { userId },
    data: { subscriptionPlan: PLUS_PLAN, plusUntil: periodEnd },
  })
  return updated
}

export const plusCatalog = {
  priceUsd: PLUS_PRICE_USD,
  periodDays: PLUS_PERIOD_DAYS,
  dailyQuota: FREE_RF_DAILY_QUOTA,
}

export async function startPlusCheckout(input: {
  userId: string
  email: string
  name: string
  country?: string | null
  requestedProvider?: 'stripe' | 'flutterwave'
}) {
  const profile = await ensureUserProfile(input.userId)
  const now = new Date()
  await expirePlusIfNeeded(profile, now)
  if (isPlusActive(await prisma.userProfile.findUnique({ where: { userId: input.userId } }), now)) {
    throw new SubscriptionError('Vuekumi+ is already active on this account', 409)
  }

  const staleBefore = new Date(Date.now() - 30 * 60_000)
  const existing = await prisma.subscription.findFirst({
    where: {
      userId: input.userId,
      status: 'pending',
      createdAt: { gte: staleBefore },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing?.checkoutUrl) return existing

  const secrets = await paymentSecrets()
  assertStripeSecretUsable(secrets, input.requestedProvider)
  const country = input.country
    ? await prisma.country.findUnique({ where: { code: input.country.toUpperCase() } })
    : null
  const provider = chooseProvider({
    requested: input.requestedProvider,
    stripe: Boolean(usableStripeSecret(secrets.stripeSecret)),
    flutterwave: Boolean(secrets.flutterwaveSecret),
    africanBuyer: country?.region === 'africa',
    allowDev: config.isDev,
  })

  const pricing = await pricingForCountry(input.country)
  const currency =
    provider === 'flutterwave'
      ? flutterwaveCurrency((pricing.currency).toUpperCase())
      : 'USD'
  const amountUsd = PLUS_PRICE_USD
  const amountLocal = currency === 'USD' ? amountUsd : convertFromUsd(amountUsd, pricing.rateToUsd)

  const subscription = await prisma.subscription.create({
    data: {
      userId: input.userId,
      plan: PLUS_PLAN,
      status: 'pending',
      amountUsd,
      currency,
      amountLocal,
      provider,
      metadata: { buyerEmail: input.email, kind: 'plus' } as Prisma.InputJsonValue,
    },
  })

  const checkout = await openGatewayCheckout({
    checkoutId: subscription.id,
    provider,
    amountUsd,
    amountLocal,
    currency,
    buyerEmail: input.email,
    buyerName: input.name,
    description: 'Vuekumi+ — 30 days of unlimited royalty-free downloads',
    successUrl: `${config.webUrl}/checkout/plus/${subscription.id}`,
    cancelUrl: `${config.webUrl}/pricing?checkout=cancelled`,
    metadata: { subscriptionId: subscription.id },
    secrets,
  })

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { checkoutUrl: checkout.url, providerRef: checkout.ref },
  })
}

export async function fulfillSubscription(subscriptionId: string, providerRef?: string) {
  const row = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!row) throw new PaymentError('Subscription not found', 404)
  if (row.status === 'active' || row.status === 'cancelled') return row
  if (row.status === 'expired') throw new PaymentError('This Vuekumi+ period has ended', 400)

  const claimed = await prisma.subscription.updateMany({
    where: { id: subscriptionId, status: 'pending' },
    data: {
      ...(providerRef ? { providerRef } : {}),
    },
  })
  if (claimed.count === 0) {
    const current = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
    if (current && (current.status === 'active' || current.status === 'cancelled')) return current
  }

  return activatePlus(row.userId, subscriptionId)
}

export async function verifySubscription(subscriptionId: string) {
  const row = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!row) throw new PaymentError('Subscription not found', 404)
  if (row.status === 'active' || row.status === 'cancelled') return row

  const secrets = await paymentSecrets()

  if (row.provider === 'stripe' && row.providerRef && secrets.stripeSecret) {
    const stripe = new Stripe(secrets.stripeSecret)
    const session = await stripe.checkout.sessions.retrieve(row.providerRef)
    if (session.payment_status === 'paid' || session.status === 'complete') {
      return fulfillSubscription(subscriptionId, session.id)
    }
    throw new PaymentError('Stripe payment is not complete yet', 409)
  }

  if (row.provider === 'flutterwave' && secrets.flutterwaveSecret) {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(row.id)}`,
      { headers: { Authorization: `Bearer ${secrets.flutterwaveSecret}` } },
    )
    const json = (await res.json()) as { status?: string; data?: { status?: string; id?: number } }
    if (json.status === 'success' && json.data?.status === 'successful') {
      return fulfillSubscription(subscriptionId, String(json.data.id ?? row.id))
    }
    throw new PaymentError('Flutterwave payment is not complete yet', 409)
  }

  if (row.provider === 'dev') {
    throw new PaymentError('Confirm the test payment to activate Vuekumi+', 409)
  }

  throw new PaymentError('Unable to verify this payment yet', 409)
}

export async function completeDevSubscription(subscriptionId: string) {
  const row = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!row) throw new PaymentError('Subscription not found', 404)
  if (row.provider !== 'dev' || !config.isDev) {
    throw new PaymentError('Test completion is only available in development', 403)
  }
  return fulfillSubscription(subscriptionId, `dev_${subscriptionId}`)
}

export async function cancelPlus(userId: string, subscriptionId?: string) {
  const now = new Date()
  const row = subscriptionId
    ? await prisma.subscription.findUnique({ where: { id: subscriptionId } })
    : await prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        orderBy: { periodEnd: 'desc' },
      })
  if (!row || row.userId !== userId) throw new SubscriptionError('Active Vuekumi+ subscription not found', 404)
  if (row.status === 'cancelled') return row
  if (row.status !== 'active') throw new SubscriptionError('Only an active Vuekumi+ period can be cancelled', 400)

  return prisma.subscription.update({
    where: { id: row.id },
    data: { status: 'cancelled', cancelledAt: now },
  })
}
