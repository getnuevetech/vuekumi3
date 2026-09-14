import type { FastifyInstance } from 'fastify'
import {
  purchaseLicenseSchema,
  quoteDecisionSchema,
  rightsManagedQuoteSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import { buildCertificatePdf } from '../lib/certificate.js'
import { convertFromUsd, pricingForCountry } from '../lib/fx.js'
import { prisma } from '../lib/prisma.js'
import { serializeGrant, serializeLicenseProduct, serializeQuote } from '../lib/serialize.js'
import { assertCanGrant, certificateCode, priceForProduct, RightsError } from '../lib/rights.js'
import { streamObject } from '../lib/storage.js'

function rightsError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof RightsError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

async function loadPhotoForLicense(id: string) {
  return prisma.photo.findUnique({
    where: { id },
    include: {
      rightsRecord: true,
      contributor: { include: { contributorProfile: true, platformAgreements: true } },
      tags: true,
    },
  })
}

export async function licenseRoutes(app: FastifyInstance) {
  app.get('/agreements/current', async () => {
    const row = await prisma.agreementVersion.findFirst({
      where: { current: true },
      orderBy: { publishedAt: 'desc' },
    })
    if (!row) {
      return { version: '1.0', title: 'VueKumi Contributor Platform Agreement', body: '' }
    }
    return { version: row.version, title: row.title, body: row.body }
  })

  app.get('/licenses', async () => {
    const products = await prisma.licenseProduct.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return {
      items: products.map((p) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        description: p.description,
        priceUsd: p.quoteOnly ? null : p.defaultUsd,
        quoteOnly: p.quoteOnly,
        points: p.points,
        commercialAllowed: p.commercialAllowed,
        requiresModelRelease: p.requiresModelRelease,
        exclusiveOptIn: p.exclusiveOptIn,
        offered: true,
      })),
    }
  })

  app.get('/photos/:id/licenses', async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await loadPhotoForLicense(id)
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const products = await prisma.licenseProduct.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return {
      items: products.map((p) => serializeLicenseProduct(p, photo, photo.rightsRecord)),
    }
  })

  app.post('/photos/:id/licenses', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = purchaseLicenseSchema.parse(request.body)
    const photo = await loadPhotoForLicense(id)
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const product = await prisma.licenseProduct.findUnique({ where: { type: body.type } })
    if (!product) return reply.code(404).send({ error: 'Licence type not found' })
    if (product.quoteOnly) {
      return reply.code(400).send({ error: 'Rights-managed licences require a quote request' })
    }

    try {
      assertCanGrant(product, photo, photo.rightsRecord)
    } catch (err) {
      return rightsError(reply, err)
    }

    const existing = await prisma.licenseGrant.findFirst({
      where: { buyerId: request.userId!, photoId: id, licenseType: body.type },
    })
    if (existing) {
      const full = await prisma.licenseGrant.findUnique({
        where: { id: existing.id },
        include: { photo: true, product: true },
      })
      return { grant: serializeGrant(full!), existing: true }
    }

    const amountUsd = priceForProduct(product, photo) ?? 0
    const pricing = await pricingForCountry(request.authUser?.country)
    const currency = (body.currency ?? pricing.currency).toUpperCase()
    const amountLocal = convertFromUsd(amountUsd, pricing.rateToUsd)
    const code = certificateCode(photo.id, product.type)

    const grant = await prisma.$transaction(async (tx) => {
      const created = await tx.licenseGrant.create({
        data: {
          buyerId: request.userId!,
          photoId: photo.id,
          productId: product.id,
          agencyId: request.authUser?.agencyId,
          licenseType: product.type,
          amountUsd,
          currency,
          amountLocal,
          scopeJson: {
            grant: 'usage_permission',
            ownership: false,
            layers: ['copyright', 'model', 'platform', 'buyer'],
          },
          certificateCode: code,
        },
        include: { photo: true, product: true },
      })

      await tx.photo.update({
        where: { id: photo.id },
        data: {
          downloads: { increment: 1 },
          ...(product.type === 'exclusive'
            ? { exclusiveSold: true, status: 'delisted' as const }
            : {}),
        },
      })

      if (product.type === 'exclusive') {
        await tx.licenseQuote.updateMany({
          where: { photoId: photo.id, status: { in: ['pending', 'quoted'] } },
          data: { status: 'declined' },
        })
      }

      return created
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'license.grant',
      entityType: 'photo',
      entityId: photo.id,
      metadata: { licenseType: product.type, certificateCode: code, amountUsd },
      ipAddress: request.ip,
    })

    return { grant: serializeGrant(grant) }
  })

  app.post('/photos/:id/quotes', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = rightsManagedQuoteSchema.parse(request.body)
    const photo = await loadPhotoForLicense(id)
    if (!photo || photo.status !== 'active') {
      return reply.code(404).send({ error: 'Photo not found' })
    }
    if (photo.exclusiveSold) {
      return reply.code(400).send({ error: 'An exclusive licence has already been sold' })
    }

    const product = await prisma.licenseProduct.findUnique({ where: { type: 'rights_managed' } })
    if (!product) return reply.code(500).send({ error: 'Rights-managed product missing' })

    const quote = await prisma.licenseQuote.create({
      data: {
        photoId: photo.id,
        requesterId: request.userId!,
        agencyId: request.authUser?.agencyId,
        productId: product.id,
        territory: body.territory,
        duration: body.duration,
        channels: body.channels,
        notes: body.notes,
      },
      include: { photo: true, requester: true },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'license.quote_request',
      entityType: 'photo',
      entityId: photo.id,
      metadata: { territory: body.territory, duration: body.duration, channels: body.channels },
      ipAddress: request.ip,
    })

    return { quote: serializeQuote(quote) }
  })

  app.get('/licenses/grants', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const grants = await prisma.licenseGrant.findMany({
      where: { buyerId: request.userId },
      include: { photo: true, product: true },
      orderBy: { createdAt: 'desc' },
    })
    return { items: grants.map(serializeGrant) }
  })

  app.get('/licenses/quotes', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const quotes = await prisma.licenseQuote.findMany({
      where: request.authUser?.accountType === 'admin' ? {} : { requesterId: request.userId },
      include: { photo: true, requester: true },
      orderBy: { createdAt: 'desc' },
    })
    return { items: quotes.map(serializeQuote) }
  })

  app.post('/licenses/quotes/:id/accept', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const quote = await prisma.licenseQuote.findUnique({
      where: { id },
      include: { photo: { include: { rightsRecord: true } }, product: true },
    })
    if (!quote) return reply.code(404).send({ error: 'Quote not found' })
    if (quote.requesterId !== request.userId && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    if (quote.status !== 'quoted' || quote.quoteUsd == null) {
      return reply.code(400).send({ error: 'Quote has not been priced yet' })
    }

    try {
      assertCanGrant(quote.product, quote.photo, quote.photo.rightsRecord)
    } catch (err) {
      return rightsError(reply, err)
    }

    const pricing = await pricingForCountry(request.authUser?.country)
    const code = certificateCode(quote.photoId, 'rights_managed')

    const grant = await prisma.$transaction(async (tx) => {
      const created = await tx.licenseGrant.create({
        data: {
          buyerId: quote.requesterId,
          photoId: quote.photoId,
          productId: quote.productId,
          agencyId: quote.agencyId,
          quoteId: quote.id,
          licenseType: 'rights_managed',
          amountUsd: quote.quoteUsd!,
          currency: pricing.currency,
          amountLocal: convertFromUsd(quote.quoteUsd!, pricing.rateToUsd),
          scopeJson: {
            grant: 'usage_permission',
            ownership: false,
            territory: quote.territory,
            duration: quote.duration,
            channels: quote.channels,
          },
          certificateCode: code,
        },
        include: { photo: true, product: true },
      })
      await tx.licenseQuote.update({ where: { id: quote.id }, data: { status: 'accepted' } })
      await tx.photo.update({ where: { id: quote.photoId }, data: { downloads: { increment: 1 } } })
      return created
    })

    return { grant: serializeGrant(grant) }
  })

  app.patch('/admin/quotes/:id', {
    preHandler: requireAccountTypes(app, 'admin'),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = quoteDecisionSchema.parse(request.body)
    const quote = await prisma.licenseQuote.findUnique({ where: { id } })
    if (!quote) return reply.code(404).send({ error: 'Quote not found' })

    const updated = await prisma.licenseQuote.update({
      where: { id },
      data: {
        ...(body.quoteUsd != null ? { quoteUsd: body.quoteUsd, status: 'quoted' } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      },
      include: { photo: true, requester: true },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.quote_update',
      entityType: 'license_quote',
      entityId: id,
      metadata: body,
      ipAddress: request.ip,
    })

    return { quote: serializeQuote(updated) }
  })

  app.get('/licenses/grants/:id/certificate', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const grant = await prisma.licenseGrant.findUnique({
      where: { id },
      include: {
        photo: { include: { contributor: true } },
        product: true,
        buyer: true,
      },
    })
    if (!grant) return reply.code(404).send({ error: 'Grant not found' })
    if (grant.buyerId !== request.userId && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const scope = (grant.scopeJson ?? {}) as Record<string, unknown>
    const pdf = buildCertificatePdf({
      code: grant.certificateCode,
      issuedAt: grant.createdAt.toISOString().slice(0, 10),
      photoTitle: grant.photo.title,
      photoId: grant.photo.id,
      photographer: grant.photo.contributor.name,
      licensee: grant.buyer.name,
      licenseeEmail: grant.buyer.email,
      licenseName: grant.product.name,
      amountLabel: grant.amountUsd === 0 ? 'Free' : `USD ${grant.amountUsd.toFixed(2)} (${grant.amountLocal.toFixed(2)} ${grant.currency})`,
      scopeLines: [
        'Usage permission only — copyright stays with the photographer.',
        scope.territory ? `Territory: ${scope.territory}` : 'Territory: worldwide unless otherwise limited',
        scope.duration ? `Duration: ${scope.duration}` : 'Duration: perpetual for this licence type',
        scope.channels ? `Channels: ${scope.channels}` : 'Channels: as permitted by the selected licence',
      ],
    })

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${grant.certificateCode}.pdf"`)
      .send(pdf)
  })

  app.get('/licenses/grants/:id/file', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const grant = await prisma.licenseGrant.findUnique({
      where: { id },
      include: { photo: { include: { assets: true } } },
    })
    if (!grant) return reply.code(404).send({ error: 'Grant not found' })
    if (grant.buyerId !== request.userId && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const original = grant.photo.assets.find((a) => a.kind === 'original')
    const key = original?.storageKey ?? grant.photo.storageKey
    if (!key) {
      return reply.code(404).send({ error: 'Original is not stored for this image' })
    }

    const obj = await streamObject(key)
    reply
      .header('Content-Type', original?.mimeType || obj.mimeType || 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${grant.photo.id}-original.jpg"`)
      .header('Cache-Control', 'private, no-store')
    if (obj.bytes) reply.header('Content-Length', obj.bytes)
    return reply.send(obj.stream)
  })
}
