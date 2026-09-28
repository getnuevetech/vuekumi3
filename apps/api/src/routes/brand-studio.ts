import type { FastifyInstance } from 'fastify'
import {
  attachBrandCollectionSchema,
  brandProjectCloseBlocked,
  brandProjectEditBlocked,
  createBrandProjectSchema,
  updateBrandProjectSchema,
} from '@vuekumi/shared'
import type { BrandProjectDto, BrandProjectCollectionDto } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'

const projectInclude = {
  campaign: { select: { id: true, title: true, ownerId: true } },
  collections: {
    include: {
      collection: {
        select: {
          id: true,
          name: true,
          shareToken: true,
          ownerId: true,
          agencyId: true,
          _count: { select: { photos: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

type ProjectRow = {
  id: string
  title: string
  notes: string | null
  status: 'open' | 'closed'
  campaignId: string | null
  createdAt: Date
  updatedAt: Date
  campaign: { id: string; title: string; ownerId: string } | null
  collections: {
    collection: {
      id: string
      name: string
      shareToken: string
      ownerId: string
      agencyId: string | null
      _count: { photos: number }
    }
  }[]
}

function serializeCollectionLink(
  row: ProjectRow['collections'][number]['collection'],
): BrandProjectCollectionDto {
  return {
    id: row.id,
    name: row.name,
    photoCount: row._count.photos,
    shareToken: row.shareToken,
  }
}

function serializeProject(row: ProjectRow): BrandProjectDto {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    campaignId: row.campaign?.id ?? row.campaignId,
    campaignTitle: row.campaign?.title ?? null,
    collections: row.collections.map((link) => serializeCollectionLink(link.collection)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function viewerOf(request: {
  userId?: string
  authUser?: { agencyId?: string | null }
}) {
  return {
    id: request.userId!,
    agencyId: request.authUser?.agencyId ?? null,
  }
}

async function loadOwnedProject(id: string, ownerId: string) {
  return prisma.brandProject.findFirst({
    where: { id, ownerId },
    include: projectInclude,
  })
}

export async function brandStudioRoutes(app: FastifyInstance) {
  const brand = { preHandler: requireAccountTypes(app, 'user', 'agency') }

  app.get('/brand/projects', brand, async (request) => {
    const viewer = viewerOf(request)
    const rows = await prisma.brandProject.findMany({
      where: {
        OR: [
          { ownerId: viewer.id },
          ...(viewer.agencyId ? [{ agencyId: viewer.agencyId }] : []),
        ],
      },
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
    })
    return { items: rows.map(serializeProject) }
  })

  app.post('/brand/projects', brand, async (request, reply) => {
    const viewer = viewerOf(request)
    const body = createBrandProjectSchema.parse(request.body)
    let campaignId: string | null = body.campaignId?.trim() || null
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, ownerId: viewer.id },
        select: { id: true },
      })
      if (!campaign) {
        return reply.code(400).send({ error: 'Campaign not found or not owned by you' })
      }
    }

    const row = await prisma.brandProject.create({
      data: {
        ownerId: viewer.id,
        agencyId: viewer.agencyId,
        title: body.title.trim(),
        notes: body.notes?.trim() || null,
        campaignId,
      },
      include: projectInclude,
    })
    await writeAuditLog({
      actorId: viewer.id,
      action: 'brand.project_create',
      entityType: 'brand_project',
      entityId: row.id,
      metadata: { title: row.title },
      ipAddress: request.ip,
    })
    return { project: serializeProject(row) }
  })

  app.get('/brand/projects/:id', brand, async (request, reply) => {
    const viewer = viewerOf(request)
    const { id } = request.params as { id: string }
    const row = await prisma.brandProject.findFirst({
      where: {
        id,
        OR: [
          { ownerId: viewer.id },
          ...(viewer.agencyId ? [{ agencyId: viewer.agencyId }] : []),
        ],
      },
      include: projectInclude,
    })
    if (!row) return reply.code(404).send({ error: 'Project not found' })
    return { project: serializeProject(row) }
  })

  app.patch('/brand/projects/:id', brand, async (request, reply) => {
    const viewer = viewerOf(request)
    const { id } = request.params as { id: string }
    const existing = await loadOwnedProject(id, viewer.id)
    if (!existing) return reply.code(404).send({ error: 'Project not found' })
    const blocked = brandProjectEditBlocked(existing.status)
    if (blocked) return reply.code(400).send({ error: blocked })

    const body = updateBrandProjectSchema.parse(request.body)
    let campaignId = existing.campaignId
    if (body.campaignId !== undefined) {
      const next = body.campaignId === null || body.campaignId === '' ? null : body.campaignId
      if (next) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: next, ownerId: viewer.id },
          select: { id: true },
        })
        if (!campaign) return reply.code(400).send({ error: 'Campaign not found or not owned by you' })
      }
      campaignId = next
    }

    const row = await prisma.brandProject.update({
      where: { id },
      data: {
        ...(body.title != null ? { title: body.title.trim() } : {}),
        ...(body.notes !== undefined
          ? { notes: body.notes === null ? null : body.notes.trim() || null }
          : {}),
        campaignId,
      },
      include: projectInclude,
    })
    return { project: serializeProject(row) }
  })

  app.post('/brand/projects/:id/close', brand, async (request, reply) => {
    const viewer = viewerOf(request)
    const { id } = request.params as { id: string }
    const existing = await loadOwnedProject(id, viewer.id)
    if (!existing) return reply.code(404).send({ error: 'Project not found' })
    const blocked = brandProjectCloseBlocked(existing.status)
    if (blocked) return reply.code(400).send({ error: blocked })

    const row = await prisma.brandProject.update({
      where: { id },
      data: { status: 'closed' },
      include: projectInclude,
    })
    await writeAuditLog({
      actorId: viewer.id,
      action: 'brand.project_close',
      entityType: 'brand_project',
      entityId: id,
      ipAddress: request.ip,
    })
    return { project: serializeProject(row) }
  })

  app.post('/brand/projects/:id/collections', brand, async (request, reply) => {
    const viewer = viewerOf(request)
    const { id } = request.params as { id: string }
    const existing = await loadOwnedProject(id, viewer.id)
    if (!existing) return reply.code(404).send({ error: 'Project not found' })
    const blocked = brandProjectEditBlocked(existing.status)
    if (blocked) return reply.code(400).send({ error: blocked })

    const body = attachBrandCollectionSchema.parse(request.body)
    const collection = await prisma.collection.findFirst({
      where: {
        id: body.collectionId,
        OR: [
          { ownerId: viewer.id },
          ...(viewer.agencyId ? [{ agencyId: viewer.agencyId }] : []),
        ],
      },
      select: { id: true },
    })
    if (!collection) return reply.code(400).send({ error: 'Collection not found or not accessible' })

    await prisma.brandProjectCollection.upsert({
      where: {
        projectId_collectionId: { projectId: id, collectionId: collection.id },
      },
      create: { projectId: id, collectionId: collection.id },
      update: {},
    })

    const row = await loadOwnedProject(id, viewer.id)
    return { project: serializeProject(row!) }
  })

  app.delete('/brand/projects/:id/collections/:collectionId', brand, async (request, reply) => {
    const viewer = viewerOf(request)
    const { id, collectionId } = request.params as { id: string; collectionId: string }
    const existing = await loadOwnedProject(id, viewer.id)
    if (!existing) return reply.code(404).send({ error: 'Project not found' })
    const blocked = brandProjectEditBlocked(existing.status)
    if (blocked) return reply.code(400).send({ error: blocked })

    await prisma.brandProjectCollection.deleteMany({
      where: { projectId: id, collectionId },
    })
    const row = await loadOwnedProject(id, viewer.id)
    return { project: serializeProject(row!) }
  })
}
