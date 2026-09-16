import type { FastifyInstance } from 'fastify'
import { photographerListQuerySchema, photoListQuerySchema } from '@vuekumi/shared'
import type { PhotographerDto } from '@vuekumi/shared'
import { authenticate, optionalAuthenticate } from '../lib/auth-middleware.js'
import {
  catalogPhotoInclude,
  favoriteIdSet,
  normalizeQuery,
  photoOrderBy,
  PROFILE_PHOTO_FILTER,
  profilePhotoWhere,
  serializeCatalogPhoto,
} from '../lib/catalog.js'
import { creatorKindWhere } from '../lib/creator-kind.js'
import { followBlocked } from '../lib/follows.js'
import { prisma } from '../lib/prisma.js'

function toPhotographer(
  user: {
    id: string
    name: string
    avatarUrl: string | null
    contributorProfile: {
      handle: string
      location: string | null
      bio: string | null
      creatorKind: 'photographer' | 'photo_influencer'
      profileViews?: number
    } | null
    modelProfile?: { handle: string } | null
  },
  photosCount: number,
  downloads: number,
  followers: number,
  extras?: { following?: boolean; profileViews?: number },
): PhotographerDto | null {
  if (!user.contributorProfile) return null
  return {
    handle: user.contributorProfile.handle,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.contributorProfile.location,
    bio: user.contributorProfile.bio,
    creatorKind: user.contributorProfile.creatorKind,
    photosCount,
    downloads,
    followers,
    profileViews: extras?.profileViews ?? user.contributorProfile.profileViews,
    following: extras?.following,
    modelHandle: user.modelProfile?.handle ?? null,
  }
}

export async function photographerRoutes(app: FastifyInstance) {
  app.get('/photographers', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request) => {
    const query = photographerListQuerySchema.parse(request.query)
    const q = normalizeQuery(query.q)

    const where = {
      accountType: 'contributor' as const,
      status: 'active' as const,
      photos: { some: PROFILE_PHOTO_FILTER },
      ...creatorKindWhere(query.kind),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { contributorProfile: { handle: { contains: q, mode: 'insensitive' as const } } },
              { contributorProfile: { location: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        contributorProfile: true,
        modelProfile: { select: { handle: true } },
        photos: { where: PROFILE_PHOTO_FILTER, select: { downloads: true } },
        _count: { select: { followers: true } },
      },
    })

    const followed = request.userId
      ? new Set(
          (
            await prisma.photographerFollow.findMany({
              where: { followerId: request.userId, photographerId: { in: users.map((u) => u.id) } },
              select: { photographerId: true },
            })
          ).map((row) => row.photographerId),
        )
      : null

    const items = users
      .map((user) => {
        const photosCount = user.photos.length
        const downloads = user.photos.reduce((sum, p) => sum + p.downloads, 0)
        return toPhotographer(user, photosCount, downloads, user._count.followers, {
          following: followed ? followed.has(user.id) : undefined,
        })
      })
      .filter((row): row is PhotographerDto => Boolean(row))
      .sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))

    const start = (query.page - 1) * query.limit
    const pageItems = items.slice(start, start + query.limit)

    return {
      items: pageItems,
      page: query.page,
      limit: query.limit,
      total: items.length,
      hasMore: start + query.limit < items.length,
    }
  })

  app.get('/following', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const query = photographerListQuerySchema.parse(request.query)
    const where = { followerId: request.userId! }

    const [total, rows] = await Promise.all([
      prisma.photographerFollow.count({ where }),
      prisma.photographerFollow.findMany({
        where,
        include: {
          photographer: {
            include: {
              contributorProfile: true,
              modelProfile: { select: { handle: true } },
              photos: { where: PROFILE_PHOTO_FILTER, select: { downloads: true } },
              _count: { select: { followers: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])

    const items = rows
      .map((row) => {
        const user = row.photographer
        const photosCount = user.photos.length
        const downloads = user.photos.reduce((sum, p) => sum + p.downloads, 0)
        return toPhotographer(user, photosCount, downloads, user._count.followers, { following: true })
      })
      .filter((row): row is PhotographerDto => Boolean(row))

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })

  app.get('/photographers/:handle', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const query = photoListQuerySchema.parse(request.query)
    const profile = await prisma.contributorProfile.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      include: { user: { include: { modelProfile: { select: { handle: true } } } } },
    })

    if (!profile || profile.user.accountType !== 'contributor' || profile.user.status !== 'active') {
      return reply.code(404).send({ error: 'Photographer not found' })
    }

    const where = {
      ...profilePhotoWhere(profile.userId),
      ...(query.category && query.category !== 'All' ? { category: query.category } : {}),
    }

    const countOwnView = query.page === 1 && request.userId !== profile.userId
    if (countOwnView) {
      const updated = await prisma.contributorProfile.update({
        where: { id: profile.id },
        data: { profileViews: { increment: 1 } },
        select: { profileViews: true },
      })
      profile.profileViews = updated.profileViews
    }

    const [total, photos, live, followers, followingRow] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: catalogPhotoInclude,
        orderBy: photoOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.photo.aggregate({
        where: { contributorId: profile.userId, ...PROFILE_PHOTO_FILTER },
        _count: { _all: true },
        _sum: { downloads: true },
      }),
      prisma.photographerFollow.count({ where: { photographerId: profile.userId } }),
      request.userId
        ? prisma.photographerFollow.findUnique({
            where: {
              followerId_photographerId: { followerId: request.userId, photographerId: profile.userId },
            },
          })
        : Promise.resolve(null),
    ])

    const photographer = toPhotographer(
      { ...profile.user, contributorProfile: profile, modelProfile: profile.user.modelProfile },
      live._count._all,
      live._sum.downloads ?? 0,
      followers,
      {
        following: request.userId ? Boolean(followingRow) : undefined,
        profileViews: profile.profileViews,
      },
    )
    if (!photographer) {
      return reply.code(404).send({ error: 'Photographer not found' })
    }

    const favorited = await favoriteIdSet(request.userId, photos.map((p) => p.id))

    return {
      photographer,
      items: photos.map((p) => serializeCatalogPhoto(p, request.userId ? favorited.has(p.id) : undefined)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })

  app.post('/photographers/:handle/follow', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const profile = await prisma.contributorProfile.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      include: { user: { select: { id: true, accountType: true, status: true } } },
    })

    const blocked = followBlocked({ followerId: request.userId!, photographer: profile?.user ?? null })
    if (blocked) {
      return reply.code(blocked.status).send({ error: blocked.error })
    }

    const photographerId = profile!.user.id
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.photographerFollow.findUnique({
        where: { followerId_photographerId: { followerId: request.userId!, photographerId } },
      })
      if (existing) {
        await tx.photographerFollow.delete({ where: { id: existing.id } })
      } else {
        await tx.photographerFollow.create({
          data: { followerId: request.userId!, photographerId },
        })
      }
      const followers = await tx.photographerFollow.count({ where: { photographerId } })
      return { following: !existing, followers }
    })

    return result
  })
}
