import type { FastifyInstance } from 'fastify'
import {
  adminPayoutActionSchema,
  payoutMethodSchema,
  requestPayoutSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import {
  MIN_PAYOUT_USD,
  PayoutError,
  canRequestPayout,
  earningsMonthSeries,
  markPayoutPaid,
  rejectPayout,
  requestPayout,
  serializePayout,
  serializePayoutMethod,
  upsertDefaultMethod,
} from '../lib/payouts.js'
import { prisma } from '../lib/prisma.js'
import { AUTH_RATE_LIMIT } from '../lib/rate-limit.js'

function payError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof PayoutError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function payoutRoutes(app: FastifyInstance) {
  const contributor = { preHandler: requireAccountTypes(app, 'contributor', 'admin') }
  const admin = { preHandler: requireAccountTypes(app, 'admin') }

  app.get('/contributor/earnings', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    if (request.authUser?.accountType !== 'contributor' && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const contributorId = request.userId!
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [available, reserved, paid, month, items, methods, payouts, seriesRows] = await Promise.all([
      prisma.earningsLedger.aggregate({
        where: { contributorId, status: 'available' },
        _sum: { amountUsd: true },
      }),
      prisma.earningsLedger.aggregate({
        where: { contributorId, status: 'reserved' },
        _sum: { amountUsd: true },
      }),
      prisma.earningsLedger.aggregate({
        where: { contributorId, status: 'paid' },
        _sum: { amountUsd: true },
      }),
      prisma.earningsLedger.aggregate({
        where: { contributorId, createdAt: { gte: monthStart } },
        _sum: { amountUsd: true },
      }),
      prisma.earningsLedger.findMany({
        where: { contributorId },
        include: { photo: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.payoutMethod.findMany({
        where: { userId: contributorId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.payout.findMany({
        where: { contributorId },
        include: { method: true, contributor: { include: { contributorProfile: true } } },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
      prisma.earningsLedger.findMany({
        where: { contributorId },
        select: { createdAt: true, amountUsd: true },
      }),
    ])

    const availableUsd = available._sum.amountUsd ?? 0
    const pendingCount = payouts.filter((p) => p.status === 'requested').length

    return {
      availableUsd,
      pendingUsd: reserved._sum.amountUsd ?? 0,
      paidUsd: paid._sum.amountUsd ?? 0,
      thisMonthUsd: month._sum.amountUsd ?? 0,
      allTimeUsd: (available._sum.amountUsd ?? 0) + (reserved._sum.amountUsd ?? 0) + (paid._sum.amountUsd ?? 0),
      minPayoutUsd: MIN_PAYOUT_USD,
      canRequest: !canRequestPayout({
        availableUsd,
        minUsd: MIN_PAYOUT_USD,
        pendingCount,
        hasMethod: methods.length > 0,
      }),
      requestBlocker: canRequestPayout({
        availableUsd,
        minUsd: MIN_PAYOUT_USD,
        pendingCount,
        hasMethod: methods.length > 0,
      }),
      items: items.map((row) => ({
        id: row.id,
        photoTitle: row.photo.title,
        amountUsd: row.amountUsd,
        source: row.source,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      series: earningsMonthSeries(seriesRows),
      methods: methods.map(serializePayoutMethod),
      payouts: payouts.map(serializePayout),
    }
  })

  app.post('/contributor/payout-methods', {
    ...contributor,
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const body = payoutMethodSchema.parse(request.body)
    try {
      const created = await prisma.$transaction(async (tx) => {
        const count = await tx.payoutMethod.count({ where: { userId: request.userId! } })
        if (count >= 5) throw new PayoutError('You can save up to 5 payout methods')
        if (body.isDefault !== false) {
          await tx.payoutMethod.updateMany({ where: { userId: request.userId! }, data: { isDefault: false } })
        }
        return tx.payoutMethod.create({
          data: {
            userId: request.userId!,
            kind: body.kind,
            label: body.label.trim(),
            accountName: body.accountName.trim(),
            accountRef: body.accountRef.replace(/\s+/g, ''),
            bankName: body.bankName?.trim(),
            country: body.country?.trim() ? body.country.trim().toUpperCase() : undefined,
            isDefault: count === 0 || body.isDefault !== false,
          },
        })
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'payout.method_create',
        entityType: 'payout_method',
        entityId: created.id,
        ipAddress: request.ip,
      })
      return { method: serializePayoutMethod(created) }
    } catch (err) {
      return payError(reply, err)
    }
  })

  app.post('/contributor/payout-methods/:id/default', contributor, async (request, reply) => {
    const { id } = request.params as { id: string }
    const method = await prisma.payoutMethod.findFirst({
      where: { id, userId: request.userId! },
    })
    if (!method) return reply.code(404).send({ error: 'Payout method not found' })
    await upsertDefaultMethod(request.userId!, id)
    const methods = await prisma.payoutMethod.findMany({
      where: { userId: request.userId! },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    return { methods: methods.map(serializePayoutMethod) }
  })

  app.delete('/contributor/payout-methods/:id', contributor, async (request, reply) => {
    const { id } = request.params as { id: string }
    const method = await prisma.payoutMethod.findFirst({
      where: { id, userId: request.userId! },
    })
    if (!method) return reply.code(404).send({ error: 'Payout method not found' })
    const inFlight = await prisma.payout.count({
      where: { payoutMethodId: id, status: 'requested' },
    })
    if (inFlight > 0) {
      return reply.code(400).send({ error: 'Cannot delete a method used by a pending payout' })
    }
    await prisma.payoutMethod.delete({ where: { id } })
    if (method.isDefault) {
      const next = await prisma.payoutMethod.findFirst({
        where: { userId: request.userId! },
        orderBy: { createdAt: 'asc' },
      })
      if (next) await prisma.payoutMethod.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return { ok: true }
  })

  app.post('/contributor/payouts', {
    ...contributor,
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const body = requestPayoutSchema.parse(request.body ?? {})
    try {
      const payout = await requestPayout({
        contributorId: request.userId!,
        methodId: body.methodId,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'payout.request',
        entityType: 'payout',
        entityId: payout.id,
        metadata: { amountUsd: payout.amountUsd },
        ipAddress: request.ip,
      })
      return { payout: serializePayout(payout) }
    } catch (err) {
      return payError(reply, err)
    }
  })

  app.get('/admin/payouts', admin, async (request) => {
    const query = request.query as { status?: string }
    const status = query.status && query.status !== 'all' ? query.status : undefined
    const items = await prisma.payout.findMany({
      where: status ? { status } : undefined,
      include: { method: true, contributor: { include: { contributorProfile: true } } },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    })
    const pending = items.filter((p) => p.status === 'requested')
    const pendingTotal = pending.reduce((sum, p) => sum + p.amountUsd, 0)
    return {
      pendingCount: pending.length,
      pendingTotalUsd: pendingTotal,
      items: items.map(serializePayout),
    }
  })

  app.post('/admin/payouts/:id/pay', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = adminPayoutActionSchema.parse(request.body ?? {})
    try {
      const payout = await markPayoutPaid({
        payoutId: id,
        actorId: request.userId!,
        notes: body.notes,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'payout.pay',
        entityType: 'payout',
        entityId: payout.id,
        metadata: { amountUsd: payout.amountUsd },
        ipAddress: request.ip,
      })
      return { payout: serializePayout(payout) }
    } catch (err) {
      return payError(reply, err)
    }
  })

  app.post('/admin/payouts/:id/reject', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = adminPayoutActionSchema.parse(request.body ?? {})
    try {
      const payout = await rejectPayout({
        payoutId: id,
        actorId: request.userId!,
        notes: body.notes,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'payout.reject',
        entityType: 'payout',
        entityId: payout.id,
        ipAddress: request.ip,
      })
      return { payout: serializePayout(payout) }
    } catch (err) {
      return payError(reply, err)
    }
  })
}
