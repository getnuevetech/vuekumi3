import type { Prisma, Subscription, UserProfile } from '@prisma/client'
import Stripe from 'stripe'
import {
  FREE_PLAN,
  FREE_RF_DAILY_QUOTA,
  PLUS_PERIOD_DAYS,
  PLUS_PLAN,
  PLUS_PRICE_USD,
  planAudienceForAccount,
  quotePlanChange,
  unusedCreditUsd,
  type QuotaDto,
  type SubscriptionDto,
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
import { loadPlanPolicy, resolveCheckoutPlan } from './buyer-plans.js'
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
  if (!profile || !profile.plusUntil) return false
  if (!profile.subscriptionPlan || profile.subscriptionPlan === FREE_PLAN) return false
  return profile.plusUntil.getTime() > now.getTime()
}

export function displayQuota(
  profile: {
    subscriptionPlan: string
    plusUntil: Date | null
    downloadQuotaUsed: number
    downloadQuotaReset: Date
    planAudience?: string | null
  } | null | undefined,
  now = new Date(),
): QuotaDto {
  const day = utcDayStart(now)
  const buyerAccess = isPlusActive(profile, now) && (profile?.planAudience || 'buyer') === 'buyer'
  if (buyerAccess) {
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
): string {
  if (!isPlusActive(profile, now) || !profile) return FREE_PLAN
  return profile.subscriptionPlan
}

type QuotaSnapshot = {
  plan: string
  plusUntil: Date | null
  used: number
  resetAt: Date
  planAudience?: string | null
}

export function quotaAfterConsume(snapshot: QuotaSnapshot, now = new Date()): {
  ok: boolean
  next?: QuotaSnapshot
  error?: string
  unlimited?: boolean
} {
  if (isPlusActive({ subscriptionPlan: snapshot.plan, plusUntil: snapshot.plusUntil }, now) && (snapshot.planAudience || 'buyer') === 'buyer') {
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
  if (!profile.subscriptionPlan || profile.subscriptionPlan === FREE_PLAN) return profile
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
    plan: row.plan,
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
  const current = await client.subscription.findUnique({ where: { id: subscriptionId } })
  if (!current) throw new SubscriptionError('Subscription not found', 404)
  const meta = (current.metadata ?? {}) as { periodDays?: number; fromSubscriptionId?: string; refundUsd?: number; mode?: string; creditUsd?: number; fromPlan?: string; kind?: string }
  const days = typeof meta.periodDays === 'number' && meta.periodDays > 0 ? meta.periodDays : PLUS_PERIOD_DAYS
  const { periodStart, periodEnd } = plusPeriod(now, days)
  if (meta.fromSubscriptionId) {
    await client.subscription.updateMany({
      where: { id: meta.fromSubscriptionId, userId },
      data: { status: 'expired', periodEnd: now },
    })
  }
  const updated = await client.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'active',
      periodStart,
      periodEnd,
    },
  })
  const planRow = await client.buyerPlan.findUnique({ where: { slug: current.plan } })
  await ensureUserProfile(userId, client)
  await client.userProfile.update({
    where: { userId },
    data: {
      subscriptionPlan: current.plan || PLUS_PLAN,
      plusUntil: periodEnd,
      planAudience: planRow?.audience ?? 'buyer',
    },
  })
  if (meta.kind === 'plan_change' && meta.fromPlan) {
    const refundUsd = typeof meta.refundUsd === 'number' ? meta.refundUsd : 0
    let refundStatus = refundUsd > 0 ? 'recorded' : 'none'
    if (refundUsd > 0 && meta.fromSubscriptionId) {
      const previous = await client.subscription.findUnique({ where: { id: meta.fromSubscriptionId } })
      if (previous) refundStatus = await refundUnusedCredit(previous, refundUsd)
    }
    await client.planAdjustment.create({
      data: {
        userId,
        fromPlan: meta.fromPlan,
        toPlan: current.plan,
        kind: 'change',
        mode: meta.mode || 'neither',
        creditUsd: typeof meta.creditUsd === 'number' ? meta.creditUsd : 0,
        chargeUsd: current.amountUsd,
        refundUsd,
        refundStatus,
      },
    })
  }
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
  returnOrigin?: string
  planSlug?: string
  accountType?: string | null
}) {
  const profile = await ensureUserProfile(input.userId)
  const now = new Date()
  await expirePlusIfNeeded(profile, now)
  if (isPlusActive(await prisma.userProfile.findUnique({ where: { userId: input.userId } }), now)) {
    throw new SubscriptionError('Vuekumi+ is already active on this account', 409)
  }

  const offer = await resolveCheckoutPlan(input.planSlug || PLUS_PLAN)
  const audience = planAudienceForAccount(input.accountType)
  if (audience && offer.audience !== audience) {
    throw new SubscriptionError('That plan is for a different account type', 403)
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
  const origin = (input.returnOrigin || config.webUrl).replace(/\/$/, '')
  const configuredOrigin = config.webUrl.replace(/\/$/, '')
  if (
    existing?.checkoutUrl
    && origin === configuredOrigin
    && existing.plan === offer.slug
    && existing.amountUsd === offer.priceUsd
  ) return existing

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
  const amountUsd = offer.priceUsd
  const amountLocal = currency === 'USD' ? amountUsd : convertFromUsd(amountUsd, pricing.rateToUsd)
  const metadata = {
    buyerEmail: input.email,
    kind: 'buyer_plan',
    planSlug: offer.slug,
    planName: offer.name,
    periodDays: offer.periodDays,
  } as Prisma.InputJsonValue

  const subscription = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: offer.slug,
          amountUsd,
          currency,
          amountLocal,
          provider,
          metadata,
          checkoutUrl: null,
          providerRef: null,
        },
      })
    : await prisma.subscription.create({
        data: {
          userId: input.userId,
          plan: offer.slug,
          status: 'pending',
          amountUsd,
          currency,
          amountLocal,
          provider,
          metadata,
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
    description: `${offer.name} — ${offer.periodDays} days of royalty-free downloads`,
    successUrl: `${origin}/checkout/plus/${subscription.id}`,
    cancelUrl: `${origin}/pricing?checkout=cancelled`,
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

async function refundUnusedCredit(previous: Subscription, refundUsd: number) {
  if (refundUsd <= 0) return 'none'
  if (previous.provider !== 'stripe' || !previous.providerRef) return 'recorded'
  try {
    const secrets = await paymentSecrets()
    const secret = usableStripeSecret(secrets.stripeSecret)
    if (!secret) return 'recorded'
    const stripe = new Stripe(secret)
    const session = await stripe.checkout.sessions.retrieve(previous.providerRef)
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    if (!paymentIntent) return 'recorded'
    await stripe.refunds.create({ payment_intent: paymentIntent, amount: Math.round(refundUsd * 100) })
    return 'refunded'
  } catch {
    return 'recorded'
  }
}

export async function quoteSubscriptionChange(input: { userId: string; accountType?: string | null; planSlug: string }) {
  const audience = planAudienceForAccount(input.accountType)
  if (!audience) throw new SubscriptionError('This account does not use a subscription plan', 400)
  const next = await resolveCheckoutPlan(input.planSlug)
  if (next.audience !== audience) throw new SubscriptionError('That plan is for a different account type', 403)
  const profile = await expirePlusIfNeeded(await ensureUserProfile(input.userId))
  if (!isPlusActive(profile)) throw new SubscriptionError('Subscribe before changing plans', 400)
  const current = await prisma.subscription.findFirst({
    where: { userId: input.userId, plan: profile.subscriptionPlan, status: { in: ['active', 'cancelled'] } },
    orderBy: { periodEnd: 'desc' },
  })
  if (!current?.periodStart || !current.periodEnd) throw new SubscriptionError('The current plan has no billing period', 400)
  const policy = await loadPlanPolicy()
  const creditUsd = unusedCreditUsd(current.amountUsd, current.periodStart, current.periodEnd)
  const quote = quotePlanChange({
    currentPrice: current.amountUsd,
    nextPrice: next.priceUsd,
    creditUsd,
    mode: policy.downgradeMode,
  })
  return { quote, next, current, creditUsd, audience }
}

export async function changePlan(input: {
  userId: string
  email: string
  name: string
  country?: string | null
  accountType?: string | null
  planSlug: string
  returnOrigin?: string
  requestedProvider?: 'stripe' | 'flutterwave'
}) {
  const { quote, next, current, creditUsd } = await quoteSubscriptionChange(input)
  if (current.plan === next.slug) throw new SubscriptionError('That plan is already active', 409)
  const metadata = {
    buyerEmail: input.email,
    kind: 'plan_change',
    planSlug: next.slug,
    planName: next.name,
    periodDays: next.periodDays,
    fromSubscriptionId: current.id,
    fromPlan: current.plan,
    refundUsd: quote.refundUsd,
    creditUsd,
    mode: quote.mode,
  } as Prisma.InputJsonValue

  if (quote.chargeUsd <= 0) {
    const row = await prisma.subscription.create({
      data: {
        userId: input.userId,
        plan: next.slug,
        status: 'pending',
        amountUsd: 0,
        currency: 'USD',
        amountLocal: 0,
        provider: current.provider,
        metadata,
      },
    })
    const subscription = await activatePlus(input.userId, row.id)
    return { subscription, checkout: null, quote }
  }

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
  const currency = provider === 'flutterwave' ? flutterwaveCurrency(pricing.currency.toUpperCase()) : 'USD'
  const amountUsd = quote.chargeUsd
  const amountLocal = currency === 'USD' ? amountUsd : convertFromUsd(amountUsd, pricing.rateToUsd)
  const origin = (input.returnOrigin || config.webUrl).replace(/\/$/, '')
  const subscription = await prisma.subscription.create({
    data: {
      userId: input.userId,
      plan: next.slug,
      status: 'pending',
      amountUsd,
      currency,
      amountLocal,
      provider,
      metadata,
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
    description: `${quote.kind === 'upgrade' ? 'Upgrade' : 'Downgrade'} to ${next.name}`,
    successUrl: `${origin}/checkout/plus/${subscription.id}`,
    cancelUrl: `${origin}/account?checkout=cancelled`,
    metadata: { subscriptionId: subscription.id },
    secrets,
  })
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { checkoutUrl: checkout.url, providerRef: checkout.ref },
  })
  return { subscription: updated, checkout, quote }
}

export async function cancelPlus(userId: string, subscriptionId: string | undefined, reason: { reason: string; detail?: string }) {
  if (reason.reason === 'other' && !reason.detail?.trim()) {
    throw new SubscriptionError('Tell us a little more about why you are cancelling', 400)
  }
  const now = new Date()
  const row = subscriptionId
    ? await prisma.subscription.findUnique({ where: { id: subscriptionId } })
    : await prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        orderBy: { periodEnd: 'desc' },
      })
  if (!row || row.userId !== userId) throw new SubscriptionError('Active subscription not found', 404)
  if (row.status === 'cancelled') return row
  if (row.status !== 'active') throw new SubscriptionError('Only an active plan can be cancelled', 400)

  const updated = await prisma.subscription.update({
    where: { id: row.id },
    data: { status: 'cancelled', cancelledAt: now },
  })
  await prisma.subscriptionCancellation.create({
    data: {
      userId,
      subscriptionId: updated.id,
      plan: updated.plan,
      reason: reason.reason,
      detail: reason.detail?.trim() || null,
    },
  })
  return updated
}
