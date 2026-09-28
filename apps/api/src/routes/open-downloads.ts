import type { FastifyInstance } from 'fastify'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { OPEN_LICENSE_VERSION } from '@vuekumi/shared'
import { prisma } from '../lib/prisma.js'
import { DOWNLOAD_RATE_LIMIT } from '../lib/rate-limit.js'
import { assertOpenDownloadAllowed } from '../lib/library-tiers.js'
import { mediaSrc } from '../lib/serialize.js'

const openDownloadSchema = z.object({
  fileVariant: z.enum(['preview', 'thumb']).default('preview'),
  source: z.string().max(120).optional(),
  anonymousSessionId: z.string().max(80).optional(),
})

function hashIp(ip: string | undefined) {
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

/**
 * Anonymous VueKumi Open downloads — no login required, still audited.
 * Stamps openLicenseVersion for later policy/dispute evidence.
 */
export async function openDownloadRoutes(app: FastifyInstance) {
  app.post('/open/:photoId/download', {
    config: { rateLimit: DOWNLOAD_RATE_LIMIT },
  }, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const body = openDownloadSchema.parse(request.body ?? {})
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { rightsRecord: true },
    })
    if (!photo || photo.status !== 'active') {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    try {
      assertOpenDownloadAllowed({
        libraryTier: photo.libraryTier,
        commercialStatus: photo.commercialStatus,
        copyrightStatus: photo.rightsRecord?.copyrightStatus,
        modelConsentStatus: photo.rightsRecord?.modelConsentStatus,
        commercialLocked: photo.commercialLocked,
      })
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 403
      const reason = err && typeof err === 'object' && 'reason' in err
        ? String((err as { reason: string }).reason)
        : undefined
      return reply.code(status).send({
        error: err instanceof Error ? err.message : 'Download denied',
        ...(reason ? { reason } : {}),
      })
    }

    const sessionId = body.anonymousSessionId || randomUUID()
    const referrer = typeof request.headers.referer === 'string' ? request.headers.referer.slice(0, 500) : null
    const event = await prisma.openDownloadEvent.create({
      data: {
        imageId: photo.id,
        imageVersion: photo.updatedAt.toISOString(),
        openLicenseVersion: OPEN_LICENSE_VERSION,
        fileVariant: body.fileVariant,
        source: body.source ?? 'public',
        referrer,
        anonymousSessionId: sessionId,
        ipHash: hashIp(request.ip),
      },
    })

    await prisma.photo.update({
      where: { id: photo.id },
      data: { downloads: { increment: 1 } },
    })

    const url = mediaSrc(photo, body.fileVariant === 'thumb' ? 'thumb' : 'preview')
    return {
      downloadId: event.id,
      imageId: photo.id,
      openLicenseVersion: OPEN_LICENSE_VERSION,
      fileVariant: body.fileVariant,
      anonymousSessionId: sessionId,
      url,
    }
  })
}
