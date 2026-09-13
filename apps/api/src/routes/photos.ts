import type { FastifyInstance } from 'fastify'
import { photoListQuerySchema } from '@vuekumi/shared'
import { prisma } from '../lib/prisma.js'
import { serializePhoto } from '../lib/serialize.js'

export async function photoRoutes(app: FastifyInstance) {
  app.get('/photos', async (request) => {
    const query = photoListQuerySchema.parse(request.query)
    const where = {
      status: 'active' as const,
      ...(query.category && query.category !== 'All' ? { category: query.category } : {}),
      ...(query.country ? { country: query.country } : {}),
      ...(query.license ? { licenseType: query.license } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { country: { contains: query.q, mode: 'insensitive' as const } },
              { category: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [total, photos] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: {
          tags: true,
          rightsRecord: true,
          contributor: { include: { contributorProfile: true, platformAgreements: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])

    return {
      items: photos.map((p) =>
        serializePhoto(
          p,
          p.contributor.contributorProfile?.handle ?? p.contributorId,
          p.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        ),
      ),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })

  app.get('/photos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        tags: true,
        rightsRecord: true,
        contributor: { include: { contributorProfile: true, platformAgreements: true } },
      },
    })

    if (!photo || (photo.status !== 'active' && photo.status !== 'pending')) {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    await prisma.photo.update({
      where: { id },
      data: { views: { increment: 1 } },
    })

    return serializePhoto(
      photo,
      photo.contributor.contributorProfile?.handle ?? photo.contributorId,
      photo.contributor.platformAgreements.some((a) => a.status === 'accepted'),
    )
  })
}
