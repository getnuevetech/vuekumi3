import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { LicenseProduct } from '@prisma/client'
import { createPartnerKeySchema, PARTNER_API_TERMS } from '@vuekumi/shared'
import type { PartnerKeyDto, PartnerPhotoDto } from '@vuekumi/shared'
import { z } from 'zod'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import {
  catalogPhotoInclude,
  normalizeQuery,
  STOCK_PHOTO_FILTER,
  type CatalogPhoto,
} from '../lib/catalog.js'
import { authenticatePartner, generatePartnerKey } from '../lib/partner.js'
import { prisma } from '../lib/prisma.js'
import { mediaSrc, serializeLicenseProduct } from '../lib/serialize.js'

/** Per-key limit — well below the anonymous global limit's abuse ceiling. */
export const PARTNER_RATE_LIMIT = { max: 120, timeWindow: '1 minute' as const }

const partnerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  q: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
})

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
  return {
    id: photo.id,
    title: photo.title,
    description: photo.description,
    category: photo.category,
    country: photo.country,
    tags: photo.tags.map((t) => t.tag),
    width: photo.width,
    height: photo.height,
    urls: {
      thumb: absoluteMediaUrl(mediaSrc(photo, 'thumb')),
      preview: absoluteMediaUrl(mediaSrc(photo, 'preview')),
    },
    photographer: {
      name: photo.contributor.name,
      handle,
      profileUrl: `${config.webUrl}/p/${handle}`,
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
    webUrl: `${config.webUrl}/photo/${photo.id}`,
    createdAt: photo.createdAt.toISOString(),
  }
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
    const q = normalizeQuery(query.q)
    const where = {
      ...STOCK_PHOTO_FILTER,
      ...(query.category ? { category: query.category } : {}),
      ...(query.country ? { country: { contains: query.country, mode: 'insensitive' as const } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { tags: { some: { tag: { contains: q, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    }

    const [total, photos, products] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: catalogPhotoInclude,
        orderBy: { createdAt: 'desc' },
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
    return { photo: serializePartnerPhoto(photo, products), terms: PARTNER_API_TERMS }
  })
}
