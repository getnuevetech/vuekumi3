import type { FastifyInstance } from 'fastify'
import { applyAiFieldsSchema, suggestFileSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import { AiError, loadPhotoImage, resolveVisionProvider, suggestFromContext } from '../lib/ai.js'
import { prisma } from '../lib/prisma.js'
import { serializePhoto } from '../lib/serialize.js'

function aiError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof AiError) return reply.code(err.statusCode).send({ error: err.message })
  throw err
}

function serializeSuggestion(row: {
  id: string
  photoId: string
  provider: string
  status: string
  title: string | null
  description: string | null
  category: string | null
  country: string | null
  tags: string[]
  hasRecognizablePeople: boolean | null
  notes: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    photoId: row.photoId,
    provider: row.provider === 'openai' ? 'openai' : 'dev',
    status: row.status,
    title: row.title,
    description: row.description,
    category: row.category,
    country: row.country,
    tags: row.tags,
    hasRecognizablePeople: row.hasRecognizablePeople,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

async function assertPhotoAccess(photoId: string, userId: string, accountType?: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { assets: true, tags: true },
  })
  if (!photo) return null
  if (accountType !== 'admin' && photo.contributorId !== userId) return 'forbidden' as const
  return photo
}

async function applyFieldsToPhoto(
  photoId: string,
  suggestion: {
    title: string | null
    description: string | null
    category: string | null
    country: string | null
    tags: string[]
    hasRecognizablePeople: boolean | null
  },
  fields: string[],
) {
  const data: Record<string, unknown> = {}
  if (fields.includes('title') && suggestion.title) data.title = suggestion.title
  if (fields.includes('description') && suggestion.description != null) data.description = suggestion.description
  if (fields.includes('category') && suggestion.category) data.category = suggestion.category
  if (fields.includes('country') && suggestion.country) data.country = suggestion.country
  if (fields.includes('hasRecognizablePeople') && suggestion.hasRecognizablePeople != null) {
    data.hasRecognizablePeople = suggestion.hasRecognizablePeople
  }

  const photo = await prisma.$transaction(async (tx) => {
    if (fields.includes('tags')) {
      await tx.photoTag.deleteMany({ where: { photoId } })
      if (suggestion.tags.length) {
        await tx.photoTag.createMany({ data: suggestion.tags.map((tag) => ({ photoId, tag })) })
      }
    }
    const updated = await tx.photo.update({
      where: { id: photoId },
      data,
      include: {
        tags: true,
        rightsRecord: true,
        contributor: { include: { contributorProfile: true } },
      },
    })
    if (fields.includes('hasRecognizablePeople') && suggestion.hasRecognizablePeople) {
      await tx.rightsRecord.updateMany({
        where: { photoId },
        data: {
          modelReleaseRequired: true,
          modelReleaseStatus: 'pending',
        },
      })
    }
    return updated
  })
  return photo
}

export async function aiRoutes(app: FastifyInstance) {
  const staff = { preHandler: requireAccountTypes(app, 'contributor', 'admin') }

  app.get('/ai/status', staff, async () => {
    try {
      const provider = await resolveVisionProvider()
      return { configured: provider.kind === 'openai', provider: provider.kind, manualOnly: true as const }
    } catch {
      return { configured: false, provider: 'dev' as const, manualOnly: true as const }
    }
  })

  app.post('/ai/suggest-file', staff, async (request, reply) => {
    try {
      const body = suggestFileSchema.parse(request.body)
      const raw = Buffer.from(body.imageBase64, 'base64')
      if (raw.byteLength < 32) return reply.code(400).send({ error: 'Image payload is empty' })
      const suggestion = await suggestFromContext({
        title: body.title,
        category: body.category,
        country: body.country,
        filename: body.filename,
        image: raw,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'ai.suggest_file',
        entityType: 'ai_suggestion',
        metadata: { provider: suggestion.provider, filename: body.filename },
        ipAddress: request.ip,
      })
      return { suggestion }
    } catch (err) {
      return aiError(reply, err)
    }
  })

  app.post('/photos/:id/ai/suggest', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const access = await assertPhotoAccess(id, request.userId!, request.authUser?.accountType)
    if (!access) return reply.code(404).send({ error: 'Photo not found' })
    if (access === 'forbidden') return reply.code(403).send({ error: 'Forbidden' })

    try {
      const image = await loadPhotoImage(access)
      const suggestion = await suggestFromContext({
        title: access.title,
        category: access.category,
        country: access.country,
        tags: access.tags.map((t) => t.tag),
        image,
      })
      const row = await prisma.aiSuggestion.create({
        data: {
          photoId: id,
          requestedById: request.userId!,
          provider: suggestion.provider,
          status: 'ready',
          title: suggestion.title,
          description: suggestion.description,
          category: suggestion.category,
          country: suggestion.country,
          tags: suggestion.tags,
          hasRecognizablePeople: suggestion.hasRecognizablePeople,
          notes: suggestion.notes,
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'ai.suggest_photo',
        entityType: 'photo',
        entityId: id,
        metadata: { suggestionId: row.id, provider: suggestion.provider },
        ipAddress: request.ip,
      })
      return { suggestion: serializeSuggestion(row) }
    } catch (err) {
      return aiError(reply, err)
    }
  })

  app.get('/photos/:id/ai/suggestions', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const access = await assertPhotoAccess(id, request.userId!, request.authUser?.accountType)
    if (!access) return reply.code(404).send({ error: 'Photo not found' })
    if (access === 'forbidden') return reply.code(403).send({ error: 'Forbidden' })
    const items = await prisma.aiSuggestion.findMany({
      where: { photoId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return { items: items.map(serializeSuggestion) }
  })

  app.post('/photos/:id/ai/suggestions/:sid/apply', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id, sid } = request.params as { id: string; sid: string }
    const access = await assertPhotoAccess(id, request.userId!, request.authUser?.accountType)
    if (!access) return reply.code(404).send({ error: 'Photo not found' })
    if (access === 'forbidden') return reply.code(403).send({ error: 'Forbidden' })
    const body = applyAiFieldsSchema.parse(request.body)
    const suggestion = await prisma.aiSuggestion.findFirst({ where: { id: sid, photoId: id } })
    if (!suggestion) return reply.code(404).send({ error: 'Suggestion not found' })

    const photo = await applyFieldsToPhoto(id, suggestion, body.fields)
    await prisma.aiSuggestion.update({
      where: { id: sid },
      data: { status: 'applied', appliedAt: new Date() },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'ai.apply_suggestion',
      entityType: 'photo',
      entityId: id,
      metadata: { suggestionId: sid, fields: body.fields },
      ipAddress: request.ip,
    })
    const reloaded = await prisma.photo.findUnique({
      where: { id },
      include: {
        tags: true,
        rightsRecord: true,
        contributor: { include: { contributorProfile: true } },
      },
    })
    return {
      photo: serializePhoto(reloaded ?? photo, photo.contributor.contributorProfile?.handle ?? photo.contributorId, true),
    }
  })

  app.post('/photos/:id/ai/suggestions/:sid/dismiss', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id, sid } = request.params as { id: string; sid: string }
    const access = await assertPhotoAccess(id, request.userId!, request.authUser?.accountType)
    if (!access) return reply.code(404).send({ error: 'Photo not found' })
    if (access === 'forbidden') return reply.code(403).send({ error: 'Forbidden' })
    const suggestion = await prisma.aiSuggestion.findFirst({ where: { id: sid, photoId: id } })
    if (!suggestion) return reply.code(404).send({ error: 'Suggestion not found' })
    await prisma.aiSuggestion.update({ where: { id: sid }, data: { status: 'dismissed' } })
    return { ok: true }
  })
}
