import type { FastifyBaseLogger } from 'fastify'
import { prisma } from './prisma.js'
import { processPhotoAssets } from './process-photo.js'

const INTERVAL_MS = 30_000
const STALE_PROCESSING_MS = 5 * 60_000

export function startMediaWorker(log: FastifyBaseLogger) {
  const tick = async () => {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS)
    const photos = await prisma.photo.findMany({
      where: {
        OR: [
          { processingStatus: { in: ['pending', 'failed'] } },
          { processingStatus: 'processing', updatedAt: { lt: staleBefore } },
        ],
      },
      take: 3,
      orderBy: { updatedAt: 'asc' },
    })
    for (const photo of photos) {
      try {
        await processPhotoAssets(photo.id)
        log.info({ photoId: photo.id }, 'media worker processed photo')
      } catch (err) {
        log.warn({ err, photoId: photo.id }, 'media worker failed')
      }
    }
  }

  setInterval(() => {
    void tick()
  }, INTERVAL_MS)
  void tick()
}
