import type { FastifyInstance } from 'fastify'
import { authenticate, optionalAuthenticate } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { streamObject } from '../lib/storage.js'

async function canSeePreview(
  photo: { id: string; status: string; contributorId: string },
  userId?: string,
  accountType?: string,
) {
  if (photo.status === 'active' || photo.status === 'pending') return true
  if (!userId) return false
  if (accountType === 'admin' || photo.contributorId === userId) return true
  const grant = await prisma.licenseGrant.findFirst({
    where: { photoId: photo.id, buyerId: userId },
    select: { id: true },
  })
  return Boolean(grant)
}

async function sendAsset(
  reply: { header: (k: string, v: string | number) => unknown; send: (b: unknown) => unknown },
  key: string,
  mimeType: string,
  cache: string,
  disposition?: string,
) {
  const obj = await streamObject(key)
  reply.header('Content-Type', mimeType || obj.mimeType || 'image/jpeg')
  reply.header('Cache-Control', cache)
  if (disposition) reply.header('Content-Disposition', disposition)
  if (obj.bytes) reply.header('Content-Length', obj.bytes)
  return reply.send(obj.stream)
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/media/:id/preview', async (request, reply) => {
    await optionalAuthenticate(app, request, reply)
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { assets: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!(await canSeePreview(photo, request.userId, request.authUser?.accountType))) {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    const watermarked =
      photo.licenseType === 'premium' ? photo.assets.find((a) => a.kind === 'watermarked') : undefined
    const preview = photo.assets.find((a) => a.kind === 'preview')
    const asset = watermarked ?? preview
    if (!asset) return reply.code(404).send({ error: 'Preview not ready' })

    return sendAsset(reply, asset.storageKey, asset.mimeType, 'public, max-age=86400')
  })

  app.get('/media/:id/thumb', async (request, reply) => {
    await optionalAuthenticate(app, request, reply)
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { assets: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!(await canSeePreview(photo, request.userId, request.authUser?.accountType))) {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    const thumb = photo.assets.find((a) => a.kind === 'thumb')
    const preview = photo.assets.find((a) => a.kind === 'preview')
    const asset = thumb ?? preview
    if (!asset) return reply.code(404).send({ error: 'Thumb not ready' })

    return sendAsset(reply, asset.storageKey, asset.mimeType, 'public, max-age=86400')
  })

  app.get('/media/:id/original', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { assets: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const isOwner = photo.contributorId === request.userId
    const isAdmin = request.authUser?.accountType === 'admin'
    const grant = await prisma.licenseGrant.findFirst({
      where: { photoId: id, buyerId: request.userId! },
      select: { id: true },
    })
    if (!isOwner && !isAdmin && !grant) {
      return reply.code(403).send({ error: 'A licence grant is required to download the original' })
    }

    const original = photo.assets.find((a) => a.kind === 'original')
    const key = original?.storageKey ?? photo.storageKey
    if (!key) {
      return reply.code(404).send({ error: 'Original is not stored for this image' })
    }

    return sendAsset(
      reply,
      key,
      original?.mimeType || 'application/octet-stream',
      'private, no-store',
      `attachment; filename="${photo.id}-original.jpg"`,
    )
  })
}
