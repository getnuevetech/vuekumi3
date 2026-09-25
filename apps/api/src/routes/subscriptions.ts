import type { FastifyInstance } from 'fastify'
import { adminHas, cancelSubscriptionSchema, changePlanSchema, startPlusSchema } from '@vuekumi/shared'
import { defaultPlusOffer, loadPlanPolicy } from '../lib/buyer-plans.js'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate } from '../lib/auth-middleware.js'
import { config } from '../config.js'
import { PaymentError } from '../lib/payment-error.js'
import { browserOrigin } from '../lib/public-origin.js'
import { prisma } from '../lib/prisma.js'
import {
  cancelPlus,
  changePlan,
  completeDevSubscription,
  displayPlan,
  displayQuota,
  ensureUserProfile,
  expirePlusIfNeeded,
  quoteSubscriptionChange,
  serializeSubscription,
  startPlusCheckout,
  SubscriptionError,
  verifySubscription,
} from '../lib/subscriptions.js'

function subError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof PaymentError || err instanceof SubscriptionError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/subscriptions', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const profile = await expirePlusIfNeeded(await ensureUserProfile(request.userId!))
    const now = new Date()
    const current = await prisma.subscription.findFirst({
      where: { userId: request.userId!, status: { in: ['active', 'cancelled'] } },
      orderBy: { periodEnd: 'desc' },
    })
    const pending = await prisma.subscription.findFirst({
      where: { userId: request.userId!, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    const plan = displayPlan(profile, now)
    const offer = await defaultPlusOffer()
    const policy = await loadPlanPolicy()
    const activePlan = plan === 'free' ? null : await prisma.buyerPlan.findUnique({ where: { slug: plan } })
    const status = plan !== 'free'
      ? (current?.status === 'cancelled' ? 'cancelled' : 'active')
      : pending
        ? 'pending'
        : current?.status === 'expired'
          ? 'expired'
          : 'none'
    return {
      plan,
      planName: activePlan?.name ?? (plan === 'plus' ? 'Vuekumi+' : null),
      plusUntil: plan !== 'free' && profile.plusUntil ? profile.plusUntil.toISOString() : null,
      status,
      quota: displayQuota(profile, now),
      current: current ? serializeSubscription(current) : null,
      pending: pending ? serializeSubscription(pending) : null,
      priceUsd: offer.priceUsd,
      periodDays: offer.periodDays,
      downgradeMode: policy.downgradeMode,
      audience: profile.planAudience,
    }
  })

  app.post('/subscriptions', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    if (request.authUser?.accountType === 'admin') {
      return reply.code(400).send({ error: 'Admin accounts do not need Vuekumi+' })
    }
    const body = startPlusSchema.parse(request.body ?? {})
    try {
      const subscription = await startPlusCheckout({
        userId: request.userId!,
        email: request.authUser!.email,
        name: request.authUser!.name,
        country: request.authUser?.country,
        requestedProvider: body.provider,
        returnOrigin: browserOrigin(request, config.webUrl),
        planSlug: body.plan,
        accountType: request.authUser?.accountType,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'subscription.checkout',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: { provider: subscription.provider, amountUsd: subscription.amountUsd },
        ipAddress: request.ip,
      })
      return {
        checkout: {
          subscriptionId: subscription.id,
          provider: subscription.provider,
          url: subscription.checkoutUrl ?? `/checkout/plus/${subscription.id}`,
          amountUsd: subscription.amountUsd,
          currency: subscription.currency,
          amountLocal: subscription.amountLocal,
        },
      }
    } catch (err) {
      return subError(reply, err)
    }
  })

  app.get('/subscriptions/:id', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await prisma.subscription.findUnique({ where: { id } })
    if (!row) return reply.code(404).send({ error: 'Subscription not found' })
    if (row.userId !== request.userId && !adminHas(request.authUser, 'accounts.read')) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    return { subscription: serializeSubscription(row) }
  })

  app.post('/subscriptions/:id/verify', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await prisma.subscription.findUnique({ where: { id } })
    if (!row) return reply.code(404).send({ error: 'Subscription not found' })
    if (row.userId !== request.userId && !adminHas(request.authUser, 'accounts.read')) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    try {
      const subscription = await verifySubscription(id)
      return { subscription: serializeSubscription(subscription) }
    } catch (err) {
      return subError(reply, err)
    }
  })

  app.post('/subscriptions/:id/complete-dev', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await prisma.subscription.findUnique({ where: { id } })
    if (!row) return reply.code(404).send({ error: 'Subscription not found' })
    if (row.userId !== request.userId && !adminHas(request.authUser, 'accounts.read')) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    try {
      const subscription = await completeDevSubscription(id)
      await writeAuditLog({
        actorId: request.userId,
        action: 'subscription.activate',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: { provider: 'dev' },
        ipAddress: request.ip,
      })
      return { subscription: serializeSubscription(subscription) }
    } catch (err) {
      return subError(reply, err)
    }
  })

  app.post('/subscriptions/quote', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const body = changePlanSchema.parse(request.body ?? {})
    try {
      const { quote, next } = await quoteSubscriptionChange({
        userId: request.userId!,
        accountType: request.authUser?.accountType,
        planSlug: body.plan,
      })
      return { quote, planName: next.name, priceUsd: next.priceUsd, periodDays: next.periodDays }
    } catch (err) {
      return subError(reply, err)
    }
  })

  app.post('/subscriptions/change', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const body = changePlanSchema.parse(request.body ?? {})
    try {
      const result = await changePlan({
        userId: request.userId!,
        email: request.authUser!.email,
        name: request.authUser!.name,
        country: request.authUser?.country,
        accountType: request.authUser?.accountType,
        planSlug: body.plan,
        returnOrigin: browserOrigin(request, config.webUrl),
      })
      return {
        quote: result.quote,
        checkout: result.checkout
          ? {
              subscriptionId: result.subscription.id,
              provider: result.subscription.provider,
              url: result.subscription.checkoutUrl ?? `/checkout/plus/${result.subscription.id}`,
              amountUsd: result.subscription.amountUsd,
              currency: result.subscription.currency,
              amountLocal: result.subscription.amountLocal,
            }
          : null,
        subscription: serializeSubscription(result.subscription),
      }
    } catch (err) {
      return subError(reply, err)
    }
  })

  app.post('/subscriptions/:id/cancel', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = cancelSubscriptionSchema.parse(request.body ?? {})
    try {
      const subscription = await cancelPlus(request.userId!, id, body)
      await writeAuditLog({
        actorId: request.userId,
        action: 'subscription.cancel',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: { periodEnd: subscription.periodEnd, reason: body.reason },
        ipAddress: request.ip,
      })
      return { subscription: serializeSubscription(subscription) }
    } catch (err) {
      return subError(reply, err)
    }
  })
}
