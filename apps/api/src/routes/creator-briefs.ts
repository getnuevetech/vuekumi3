import type { FastifyInstance } from 'fastify'
import { createCreatorBriefSchema } from '@vuekumi/shared'
import { requireAdminCapability, requireCreatorWorkspace } from '../lib/auth-middleware.js'
import { writeAuditLog } from '../lib/audit.js'
import { prisma } from '../lib/prisma.js'

function serializeBrief(row: {
  id: string
  title: string
  body: string
  category: string | null
  country: string | null
  libraryTier: string | null
  sourceLabel: string | null
  status: string
  createdAt: Date
}) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    country: row.country,
    libraryTier: row.libraryTier,
    sourceLabel: row.sourceLabel,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function creatorBriefRoutes(app: FastifyInstance) {
  app.get('/contributor/briefs', { preHandler: requireCreatorWorkspace(app) }, async () => {
    const items = await prisma.creatorBrief.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return { items: items.map(serializeBrief) }
  })

  app.get('/admin/creator-briefs', { preHandler: requireAdminCapability(app, 'content.list') }, async () => {
    const items = await prisma.creatorBrief.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { items: items.map(serializeBrief) }
  })

  app.post('/admin/creator-briefs', { preHandler: requireAdminCapability(app, 'content.list') }, async (request) => {
    const body = createCreatorBriefSchema.parse(request.body)
    const created = await prisma.creatorBrief.create({
      data: {
        title: body.title,
        body: body.body || `Staff brief from buyer demand: ${body.sourceLabel || body.title}`,
        category: body.category ?? null,
        country: body.country ?? null,
        libraryTier: body.libraryTier ?? null,
        sourceLabel: body.sourceLabel ?? null,
        createdById: request.userId ?? null,
        status: 'open',
      },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.creator_brief.create',
      entityType: 'creator_brief',
      entityId: created.id,
      metadata: { title: created.title, sourceLabel: created.sourceLabel },
      ipAddress: request.ip,
    })
    return { brief: serializeBrief(created) }
  })
}
