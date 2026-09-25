import type { FastifyInstance } from 'fastify'
import { isShareGroup, shareFormulaSchema } from '@vuekumi/shared'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { clearUserFormula, listShareAdmin, saveGroupFormula, saveUserFormula } from '../lib/share-formulas.js'

const accountBody = shareFormulaSchema.extend({
  userId: z.string().min(1),
})

export async function adminShareRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'plans.manage') }

  app.get('/admin/shares', gate, async () => listShareAdmin())

  app.get('/admin/shares/accounts', gate, async (request) => {
    const query = request.query as { q?: string }
    const q = query.q?.trim() ?? ''
    if (q.length < 2) return { items: [] }
    const users = await prisma.user.findMany({
      where: {
        accountType: { in: ['photographer', 'photo_influencer', 'contributor'] },
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { contributorProfile: { handle: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { contributorProfile: true, shareFormula: true },
      take: 8,
      orderBy: { name: 'asc' },
    })
    return {
      items: users.map((user) => ({
        userId: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        handle: user.contributorProfile?.handle ?? null,
        formula: user.shareFormula && user.shareFormula.scope === 'user'
          ? {
              mode: user.shareFormula.mode,
              percent: user.shareFormula.percent,
              fixedUsd: user.shareFormula.fixedUsd,
            }
          : null,
      })),
    }
  })

  app.put('/admin/shares/groups/:groupKey', gate, async (request, reply) => {
    const { groupKey } = request.params as { groupKey: string }
    if (!isShareGroup(groupKey)) return reply.code(400).send({ error: 'Unknown contributor group' })
    const formula = shareFormulaSchema.parse(request.body)
    await saveGroupFormula(groupKey, formula)
    await writeAuditLog({
      actorId: request.userId,
      action: 'shares.group',
      entityType: 'share_formula',
      entityId: groupKey,
      metadata: { mode: formula.mode, percent: formula.percent, fixedUsd: formula.fixedUsd },
      ipAddress: request.ip,
    })
    return listShareAdmin()
  })

  app.put('/admin/shares/accounts', gate, async (request, reply) => {
    const body = accountBody.parse(request.body)
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, accountType: true },
    })
    if (!user || !isShareGroup(user.accountType)) {
      return reply.code(400).send({ error: 'Choose a photographer, photo influencer, or contributor account' })
    }
    const formula = { mode: body.mode, percent: body.percent, fixedUsd: body.fixedUsd }
    await saveUserFormula(user.id, formula)
    await writeAuditLog({
      actorId: request.userId,
      action: 'shares.account',
      entityType: 'share_formula',
      entityId: user.id,
      metadata: { mode: formula.mode, percent: formula.percent, fixedUsd: formula.fixedUsd },
      ipAddress: request.ip,
    })
    return listShareAdmin()
  })

  app.delete('/admin/shares/accounts/:userId', gate, async (request) => {
    const { userId } = request.params as { userId: string }
    await clearUserFormula(userId)
    await writeAuditLog({
      actorId: request.userId,
      action: 'shares.account_clear',
      entityType: 'share_formula',
      entityId: userId,
      ipAddress: request.ip,
    })
    return listShareAdmin()
  })
}
