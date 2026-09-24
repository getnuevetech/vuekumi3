import type { FastifyInstance } from 'fastify'
import { adminHas, startPlusSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate } from '../lib/auth-middleware.js'
import { config } from '../config.js'
import { PaymentError } from '../lib/payment-error.js'
import { browserOrigin } from '../lib/public-origin.js'
import { prisma } from '../lib/prisma.js'
import {
  cancelPlus,
  completeDevSubscription,
  displayPlan,
  displayQuota,
  ensureUserProfile,
  expirePlusIfNeeded,
  plusCatalog,
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
    const status = plan === 'plus'
      ? (current?.status === 'cancelled' ? 'cancelled' : 'active')
      : pending
        ? 'pending'
        : current?.status === 'expired'
          ? 'expired'
          : 'none'
    return {
      plan,
      plusUntil: plan === 'plus' && profile.plusUntil ? profile.plusUntil.toISOString() : null,
      status,
      quota: displayQuota(profile, now),
      current: current ? serializeSubscription(current) : null,
      pending: pending ? serializeSubscription(pending) : null,
      priceUsd: plusCatalog.priceUsd,
      periodDays: plusCatalog.periodDays,
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

  app.post('/subscriptions/:id/cancel', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const subscription = await cancelPlus(request.userId!, id)
      await writeAuditLog({
        actorId: request.userId,
        action: 'subscription.cancel',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: { periodEnd: subscription.periodEnd },
        ipAddress: request.ip,
      })
      return { subscription: serializeSubscription(subscription) }
    } catch (err) {
      return subError(reply, err)
    }
  })
}
