import type { FastifyInstance } from 'fastify'
import { createBuyerPlanSchema, patchBuyerPlanSchema, patchHomePricingSchema, patchPlanPolicySchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { createBuyerPlan, deleteBuyerPlan, listBuyerPlans, loadHomePricingCopy, loadPlanPolicy, saveHomePricingCopy, savePlanPolicy, serializeBuyerPlan, updateBuyerPlan } from '../lib/buyer-plans.js'
import { prisma } from '../lib/prisma.js'

export async function adminPlanRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'plans.manage') }

  app.get('/admin/plans', gate, async () => {
    const [items, home, policy] = await Promise.all([
      listBuyerPlans({ includeDisabled: true }),
      loadHomePricingCopy(),
      loadPlanPolicy(),
    ])
    return { items, home, policy }
  })

  app.put('/admin/plans/policy', gate, async (request) => {
    const body = patchPlanPolicySchema.parse(request.body)
    const policy = await savePlanPolicy(body.downgradeMode)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.plans.policy',
      entityType: 'plan_policy',
      entityId: 'public',
      metadata: policy,
      ipAddress: request.ip,
    })
    return { policy }
  })

  app.get('/admin/plans/cancellations', gate, async () => {
    const rows = await prisma.subscriptionCancellation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const users = rows.length
      ? await prisma.user.findMany({
          where: { id: { in: rows.map((row) => row.userId) } },
          select: { id: true, email: true },
        })
      : []
    const emails = new Map(users.map((user) => [user.id, user.email]))
    return {
      items: rows.map((row) => ({
        id: row.id,
        plan: row.plan,
        reason: row.reason,
        detail: row.detail,
        email: emails.get(row.userId) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  })

  app.put('/admin/plans/home', gate, async (request) => {
    const body = patchHomePricingSchema.parse(request.body)
    const home = await saveHomePricingCopy(body)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.plans.home',
      entityType: 'homepage',
      entityId: 'pricing',
      metadata: { kicker: home.kicker, title: home.title },
      ipAddress: request.ip,
    })
    return { home }
  })

  app.post('/admin/plans', gate, async (request) => {
    const body = createBuyerPlanSchema.parse(request.body)
    const row = await createBuyerPlan(body)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.plans.create',
      entityType: 'buyer_plan',
      entityId: row.id,
      metadata: { slug: row.slug, priceUsd: row.priceUsd, periodDays: row.periodDays },
      ipAddress: request.ip,
    })
    return serializeBuyerPlan(row)
  })

  app.patch('/admin/plans/:id', gate, async (request) => {
    const { id } = request.params as { id: string }
    const body = patchBuyerPlanSchema.parse(request.body ?? {})
    const row = await updateBuyerPlan(id, body)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.plans.update',
      entityType: 'buyer_plan',
      entityId: row.id,
      metadata: body,
      ipAddress: request.ip,
    })
    return serializeBuyerPlan(row)
  })

  app.delete('/admin/plans/:id', gate, async (request) => {
    const { id } = request.params as { id: string }
    const row = await deleteBuyerPlan(id)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.plans.delete',
      entityType: 'buyer_plan',
      entityId: row.id,
      metadata: { slug: row.slug },
      ipAddress: request.ip,
    })
    return { ok: true }
  })
}
