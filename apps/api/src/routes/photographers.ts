import type { Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { hireAvailabilityWhere, photographerListQuerySchema, photoListQuerySchema } from '@vuekumi/shared'
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
import { accountHasFeature, accountTypesWithFeature } from '../lib/account-features.js'
import { contributorCardType, ensureDigitalIdCard } from '../lib/digital-id.js'
import { creatorKindWhere } from '../lib/creator-kind.js'
import { followBlocked } from '../lib/follows.js'
import { photographerCollaboratingModels } from '../lib/profile-collaborators.js'
import { photographerPublicCollections } from '../lib/profile-collections.js'
import { photographerDirectoryExtras } from '../lib/profile-directory.js'
import { prisma } from '../lib/prisma.js'

function toPhotographer(
  user: {
    id: string
    name: string
    accountType?: string
    avatarUrl: string | null
    contributorProfile: {
      id?: string
      handle: string
      location: string | null
      bio: string | null
      creatorKind: 'photographer' | 'photo_influencer'
      availability: 'open' | 'limited' | 'unavailable'
      dayRateUsd: number | null
      profileViews?: number
      createdAt?: Date
    } | null
    modelProfile?: { handle: string } | null
    representation?: { status: string } | null
  },
  photosCount: number,
  downloads: number,
  followers: number,
  extras?: {
    following?: boolean
    profileViews?: number
    hireable?: boolean
    coverPhotoUrl?: string | null
    specialties?: string[]
    collaborators?: PhotographerDto['collaborators']
    collections?: PhotographerDto['collections']
    portfolioStrip?: PhotographerDto['portfolioStrip']
    digitalId?: PhotographerDto['digitalId']
  },
): PhotographerDto | null {
  if (!user.contributorProfile) return null
  const hireable = extras?.hireable ?? user.accountType === 'photographer'
  const accountType = (user.accountType === 'contributor' || user.accountType === 'photo_influencer' || user.accountType === 'photographer')
    ? user.accountType
    : 'photographer'
  return {
    handle: user.contributorProfile.handle,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.contributorProfile.location,
    bio: user.contributorProfile.bio,
    creatorKind: user.contributorProfile.creatorKind,
    accountType,
    availability: hireable ? user.contributorProfile.availability : 'unavailable',
    dayRateUsd: hireable ? user.contributorProfile.dayRateUsd : null,
    represented: user.representation?.status === 'represented',
    photosCount,
    downloads,
    followers,
    profileViews: extras?.profileViews ?? user.contributorProfile.profileViews,
    following: extras?.following,
    modelHandle: user.modelProfile?.handle ?? null,
    coverPhotoUrl: extras?.coverPhotoUrl ?? null,
    memberSince: user.contributorProfile.createdAt?.toISOString() ?? null,
    specialties: extras?.specialties ?? [],
    collaborators: extras?.collaborators ?? [],
    collections: extras?.collections ?? [],
    portfolioStrip: extras?.portfolioStrip ?? [],
    digitalId: extras?.digitalId ?? null,
  }
}

export async function photographerRoutes(app: FastifyInstance) {
  app.get('/photographers', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request) => {
    const query = photographerListQuerySchema.parse(request.query)
    const q = normalizeQuery(query.q)
    const communityTypes = query.listing === 'community' ? await accountTypesWithFeature('contributor_listing') : null
    const bookableTypes = new Set<string>(await accountTypesWithFeature('receive_bookings'))
    const availabilityFilter = hireAvailabilityWhere(query.availability)

    const where: Prisma.UserWhereInput = {
      status: 'active',
      photos: { some: PROFILE_PHOTO_FILTER },
      ...(communityTypes
        ? { accountType: { in: communityTypes } }
        : query.availability === 'hireable'
          ? { accountType: { in: [...bookableTypes] as ('photographer' | 'photo_influencer' | 'contributor')[] } }
          : creatorKindWhere(query.kind)),
      ...(availabilityFilter
        ? { contributorProfile: { is: { availability: availabilityFilter } } }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { contributorProfile: { handle: { contains: q, mode: 'insensitive' } } },
              { contributorProfile: { location: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        contributorProfile: true,
        modelProfile: { select: { handle: true } },
        representation: { select: { status: true } },
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
          hireable: bookableTypes.has(user.accountType),
        })
      })
      .filter((row): row is PhotographerDto => Boolean(row))
      .sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))

    // When browsing for hire, drop non-hireable DTOs (community/influencer without bookings).
    const hireScoped = query.availability === 'hireable'
      ? items.filter((row) => row.availability === 'open' || row.availability === 'limited')
      : items

    const start = (query.page - 1) * query.limit
    const pageItems = hireScoped.slice(start, start + query.limit)

    const extrasByUser = await photographerDirectoryExtras(
      pageItems
        .map((row) => users.find((user) => user.contributorProfile?.handle === row.handle)?.id)
        .filter((id): id is string => Boolean(id)),
    )

    const enriched = await Promise.all(pageItems.map(async (row) => {
      const profile = users.find((user) => user.contributorProfile?.handle === row.handle)
      if (!profile?.contributorProfile) return row
      const cardType = contributorCardType(profile.accountType, profile.contributorProfile.creatorKind)
      const digitalId = await ensureDigitalIdCard({
        profileId: profile.contributorProfile.id,
        cardType,
        handle: row.handle,
        preferredToken: `seed-${row.handle}-${cardType}-id`,
      })
      const extras = extrasByUser.get(profile.id)
      return {
        ...row,
        accountType: (profile.accountType === 'contributor' || profile.accountType === 'photo_influencer' || profile.accountType === 'photographer')
          ? profile.accountType
          : 'photographer' as const,
        memberSince: profile.contributorProfile.createdAt.toISOString(),
        specialties: extras?.specialties ?? [],
        portfolioStrip: extras?.portfolioStrip ?? [],
        coverPhotoUrl: extras?.coverPhotoUrl ?? null,
        digitalId,
      }
    }))

    return {
      items: enriched,
      page: query.page,
      limit: query.limit,
      total: hireScoped.length,
      hasMore: start + query.limit < hireScoped.length,
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
              representation: { select: { status: true } },
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
      include: {
        user: {
          include: {
            modelProfile: { select: { handle: true } },
            representation: { select: { status: true } },
          },
        },
      },
    })

    if (!profile || (profile.user.accountType !== 'photographer' && profile.user.accountType !== 'photo_influencer' && profile.user.accountType !== 'contributor') || profile.user.status !== 'active') {
      return reply.code(404).send({ error: 'Photographer not found' })
    }

    const where = {
      ...profilePhotoWhere(profile.userId),
      ...(query.category && query.category !== 'All' ? { category: query.category } : {}),
      ...(query.libraryTier ? { libraryTier: query.libraryTier } : {}),
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

    const [total, photos, live, followers, followingRow, cover, specialtyRows, tierRows] = await Promise.all([
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
      prisma.photo.findFirst({
        where: { contributorId: profile.userId, ...PROFILE_PHOTO_FILTER },
        orderBy: [{ createdAt: 'desc' }],
        select: { src: true },
      }),
      prisma.photo.groupBy({
        by: ['category'],
        where: { contributorId: profile.userId, ...PROFILE_PHOTO_FILTER },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
        take: 6,
      }),
      prisma.photo.groupBy({
        by: ['libraryTier'],
        where: { contributorId: profile.userId, ...PROFILE_PHOTO_FILTER },
        _count: { _all: true },
        orderBy: { _count: { libraryTier: 'desc' } },
      }),
    ])

    const cardType = contributorCardType(profile.user.accountType, profile.creatorKind)
    const [digitalId, collaborators, collections] = await Promise.all([
      ensureDigitalIdCard({
        profileId: profile.id,
        cardType,
        handle: profile.handle,
        preferredToken: `seed-${profile.handle}-${cardType}-id`,
      }),
      photographerCollaboratingModels(profile.userId),
      photographerPublicCollections(profile.userId),
    ])

    const photographer = toPhotographer(
      { ...profile.user, contributorProfile: profile, modelProfile: profile.user.modelProfile },
      live._count._all,
      live._sum.downloads ?? 0,
      followers,
      {
        following: request.userId ? Boolean(followingRow) : undefined,
        profileViews: profile.profileViews,
        hireable: await accountHasFeature(profile.user.accountType, 'receive_bookings'),
        coverPhotoUrl: cover?.src ?? null,
        specialties: specialtyRows.map((row) => row.category),
        collaborators,
        collections,
        digitalId,
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
      libraryTierFacets: tierRows.map((row) => ({
        value: row.libraryTier,
        count: row._count._all,
      })),
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
