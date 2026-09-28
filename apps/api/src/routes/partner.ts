import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { LicenseProduct } from '@prisma/client'
import {
  createPartnerKeySchema,
  partnerApiEventSchema,
  partnerListQuerySchema,
  PARTNER_API_TERMS,
} from '@vuekumi/shared'
import type { PartnerApiEventDto, PartnerKeyDto, PartnerPhotoDto } from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import {
  buildPhotoWhere,
  catalogPhotoInclude,
  photoOrderBy,
  STOCK_PHOTO_FILTER,
  type CatalogPhoto,
} from '../lib/catalog.js'
import { authenticatePartner, generatePartnerKey } from '../lib/partner.js'
import { prisma } from '../lib/prisma.js'
import { mediaSrc, serializeLicenseProduct } from '../lib/serialize.js'

/** Per-key limit — well below the anonymous global limit's abuse ceiling. */
export const PARTNER_RATE_LIMIT = { max: 120, timeWindow: '1 minute' as const }

function serializePartnerKey(row: {
  id: string
  name: string
  note: string | null
  keyPrefix: string
  status: 'active' | 'revoked'
  requestCount: number
  lastUsedAt: Date | null
  createdAt: Date
}): PartnerKeyDto {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    keyPrefix: row.keyPrefix,
    status: row.status,
    requestCount: row.requestCount,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

function absoluteMediaUrl(src: string): string {
  return src.startsWith('http') ? src : `${config.webUrl}${src}`
}

function serializePartnerPhoto(photo: CatalogPhoto, products: LicenseProduct[]): PartnerPhotoDto {
  const handle = photo.contributor.contributorProfile?.handle ?? photo.contributorId
  const profileUrl = `${config.webUrl}/p/${handle}`
  const webUrl = `${config.webUrl}/photo/${photo.id}`
  const photographerName = photo.contributor.name
  return {
    id: photo.id,
    title: photo.title,
    description: photo.description,
    category: photo.category,
    country: photo.country,
    tags: photo.tags.map((t) => t.tag),
    libraryTier: photo.libraryTier,
    licenseType: photo.licenseType === 'premium' ? 'premium' : 'free',
    width: photo.width,
    height: photo.height,
    urls: {
      thumb: absoluteMediaUrl(mediaSrc(photo, 'thumb')),
      preview: absoluteMediaUrl(mediaSrc(photo, 'preview')),
    },
    photographer: {
      name: photographerName,
      handle,
      profileUrl,
    },
    attribution: {
      required: true,
      text: `Photo by ${photographerName} / VueKumi (${webUrl})`,
      photographerName,
      profileUrl,
      webUrl,
    },
    // Same guards as checkout: the API never claims an uncleared image is
    // commercially licensable.
    licenses: products.map((product) => {
      const dto = serializeLicenseProduct(product, photo, photo.rightsRecord ?? null, photo.appearances)
      return {
        type: dto.type,
        name: dto.name,
        priceUsd: dto.priceUsd,
        offered: dto.offered,
        ...(dto.blockedReason ? { reason: dto.blockedReason } : {}),
      }
    }),
    webUrl,
    createdAt: photo.createdAt.toISOString(),
    aiTrainingConsented: Boolean((photo as { aiTrainingEligible?: boolean }).aiTrainingEligible),
    aiTrainingPermitted: false as const,
  }
}

function serializePartnerEvent(row: {
  id: string
  partnerKeyId: string
  photoId: string
  eventType: string
  fileVariant: string | null
  referrer: string | null
  createdAt: Date
}): PartnerApiEventDto {
  return {
    id: row.id,
    partnerKeyId: row.partnerKeyId,
    photoId: row.photoId,
    eventType: row.eventType as PartnerApiEventDto['eventType'],
    fileVariant: row.fileVariant,
    referrer: row.referrer,
    createdAt: row.createdAt.toISOString(),
  }
}

async function recordPartnerEvent(input: {
  partnerKeyId: string
  photoId: string
  eventType: string
  fileVariant?: string | null
  referrer?: string | null
}) {
  return prisma.partnerApiEvent.create({
    data: {
      partnerKeyId: input.partnerKeyId,
      photoId: input.photoId,
      eventType: input.eventType,
      fileVariant: input.fileVariant ?? null,
      referrer: input.referrer?.trim().slice(0, 500) || null,
      source: 'partner_api',
    },
  })
}

export async function partnerRoutes(app: FastifyInstance) {
  const listKeys = { preHandler: requireAdminCapability(app, 'partner.keys.list') }
  const createKey = { preHandler: requireAdminCapability(app, 'partner.keys.create') }
  const revokeKey = { preHandler: requireAdminCapability(app, 'partner.keys.revoke') }

  app.get('/admin/partner-keys', listKeys, async () => {
    const keys = await prisma.partnerApiKey.findMany({ orderBy: { createdAt: 'desc' } })
    return { items: keys.map(serializePartnerKey) }
  })

  app.post('/admin/partner-keys', createKey, async (request) => {
    const body = createPartnerKeySchema.parse(request.body)
    const { key, hash, prefix } = generatePartnerKey()
    const row = await prisma.partnerApiKey.create({
      data: {
        name: body.name.trim(),
        note: body.note?.trim() || null,
        keyHash: hash,
        keyPrefix: prefix,
        createdById: request.userId ?? null,
      },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'partner.key_create',
      entityType: 'partner_key',
      entityId: row.id,
      metadata: { name: row.name },
      ipAddress: request.ip,
    })
    // The raw key is returned exactly once; only the hash is stored.
    return { key, partnerKey: serializePartnerKey(row) }
  })

  app.post('/admin/partner-keys/:id/revoke', revokeKey, async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await prisma.partnerApiKey.findUnique({ where: { id } })
    if (!row) return reply.code(404).send({ error: 'Key not found' })
    if (row.status === 'revoked') return reply.code(400).send({ error: 'Key is already revoked' })
    const updated = await prisma.partnerApiKey.update({ where: { id }, data: { status: 'revoked' } })
    await writeAuditLog({
      actorId: request.userId,
      action: 'partner.key_revoke',
      entityType: 'partner_key',
      entityId: id,
      ipAddress: request.ip,
    })
    return { partnerKey: serializePartnerKey(updated) }
  })

  app.get('/admin/partner-keys/:id/events', listKeys, async (request, reply) => {
    const { id } = request.params as { id: string }
    const key = await prisma.partnerApiKey.findUnique({ where: { id } })
    if (!key) return reply.code(404).send({ error: 'Key not found' })
    const q = request.query as { limit?: string }
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 40))
    const events = await prisma.partnerApiEvent.findMany({
      where: { partnerKeyId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const byType = await prisma.partnerApiEvent.groupBy({
      by: ['eventType'],
      where: { partnerKeyId: id },
      _count: { _all: true },
    })
    return {
      partnerKey: serializePartnerKey(key),
      items: events.map(serializePartnerEvent),
      totals: Object.fromEntries(byType.map((row) => [row.eventType, row._count._all])),
    }
  })

  const partner = {
    preHandler: (request: FastifyRequest, reply: FastifyReply) => authenticatePartner(request, reply),
    config: {
      rateLimit: {
        ...PARTNER_RATE_LIMIT,
        keyGenerator: (request: FastifyRequest) => request.partnerKeyId ?? request.ip,
      },
    },
  }

  app.get('/partner/v1/photos', partner, async (request) => {
    const query = partnerListQuerySchema.parse(request.query)
    // Same stock + facet filters as public search so partners can target
    // library tiers (incl. Verified+) without inventing a second catalog.
    const where = buildPhotoWhere(query)

    const [total, photos, products] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: catalogPhotoInclude,
        orderBy: photoOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.licenseProduct.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    ])

    return {
      items: photos.map((p) => serializePartnerPhoto(p, products)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
      terms: PARTNER_API_TERMS,
    }
  })

  app.get('/partner/v1/photos/:id', partner, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findFirst({
      where: { id, ...STOCK_PHOTO_FILTER },
      include: catalogPhotoInclude,
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    const products = await prisma.licenseProduct.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    // V21-P3: detail fetch counts as a view (attribution surfaces on the DTO).
    if (request.partnerKeyId) {
      await recordPartnerEvent({
        partnerKeyId: request.partnerKeyId,
        photoId: photo.id,
        eventType: 'view',
        referrer: typeof request.headers.referer === 'string' ? request.headers.referer : null,
      }).catch(() => undefined)
    }
    return { photo: serializePartnerPhoto(photo, products), terms: PARTNER_API_TERMS }
  })

  app.post('/partner/v1/photos/:id/events', partner, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = partnerApiEventSchema.parse(request.body)
    const photo = await prisma.photo.findFirst({
      where: { id, ...STOCK_PHOTO_FILTER },
      select: { id: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!request.partnerKeyId) return reply.code(401).send({ error: 'Partner API key required' })

    const event = await recordPartnerEvent({
      partnerKeyId: request.partnerKeyId,
      photoId: photo.id,
      eventType: body.eventType,
      fileVariant: body.fileVariant ?? (body.eventType === 'download_preview' ? 'preview' : null),
      referrer: body.referrer || null,
    })

    return {
      event: serializePartnerEvent(event),
      // Explicit: logging is not checkout and grants nothing.
      licenceGranted: false,
      message: 'Event recorded. Licences are still granted only on VueKumi checkout.',
    }
  })
}
