import type { FastifyInstance } from 'fastify'
import {
  acceptQuoteSchema,
  purchaseLicenseSchema,
  quoteDecisionSchema,
  rightsManagedQuoteSchema,
} from '@vuekumi/shared'
import type { AuthUser } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import { AgencyError, assertAgencyActive, canPurchase, canQuote } from '../lib/agency.js'
import { buildCertificatePdf } from '../lib/certificate.js'
import { convertFromUsd, pricingForCountry } from '../lib/fx.js'
import { prisma } from '../lib/prisma.js'
import { issueGrant } from '../lib/grants.js'
import { PaymentError, startLicenseCheckout } from '../lib/payments.js'
import { serializeCheckout, serializeGrant, serializeLicenseProduct, serializeQuote } from '../lib/serialize.js'
import { assertCanGrant, priceForProduct, RightsError } from '../lib/rights.js'
import { DOWNLOAD_RATE_LIMIT } from '../lib/rate-limit.js'
import { streamObject } from '../lib/storage.js'

function rightsError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof RightsError || err instanceof PaymentError || err instanceof AgencyError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

async function assertAgencyAction(user: AuthUser | undefined, action: 'purchase' | 'quote') {
  if (!user?.agencyId) return
  const agency = await prisma.agency.findUnique({ where: { id: user.agencyId } })
  if (!agency) throw new AgencyError('Agency workspace required', 403)
  assertAgencyActive(agency.status)
  const role = user.agencyRole ?? 'viewer'
  if (action === 'purchase' && !canPurchase(role)) {
    throw new AgencyError('Your agency role cannot purchase licences', 403)
  }
  if (action === 'quote' && !canQuote(role)) {
    throw new AgencyError('Your agency role cannot request or accept quotes', 403)
  }
}

function grantsWhere(user: AuthUser) {
  if (user.accountType === 'admin') return {}
  if (user.agencyId) return { OR: [{ buyerId: user.id }, { agencyId: user.agencyId }] }
  return { buyerId: user.id }
}

function quotesWhere(user: AuthUser) {
  if (user.accountType === 'admin') return {}
  if (user.agencyId) return { OR: [{ requesterId: user.id }, { agencyId: user.agencyId }] }
  return { requesterId: user.id }
}

function canAccessGrant(user: AuthUser, grant: { buyerId: string; agencyId: string | null }) {
  if (user.accountType === 'admin') return true
  if (grant.buyerId === user.id) return true
  return Boolean(user.agencyId && grant.agencyId === user.agencyId)
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
      await assertAgencyAction(request.authUser, 'purchase')
      assertCanGrant(product, photo, photo.rightsRecord)
    } catch (err) {
      return rightsError(reply, err)
    }

    const existing = await prisma.licenseGrant.findFirst({
      where: request.authUser?.agencyId
        ? { agencyId: request.authUser.agencyId, photoId: id, licenseType: body.type }
        : { buyerId: request.userId!, photoId: id, licenseType: body.type },
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
    const scopeJson = {
      grant: 'usage_permission',
      ownership: false,
      layers: ['copyright', 'model', 'platform', 'buyer'],
    }

    if (amountUsd <= 0) {
      const grant = await issueGrant({
        buyerId: request.userId!,
        photoId: photo.id,
        productId: product.id,
        agencyId: request.authUser?.agencyId,
        licenseType: product.type,
        amountUsd,
        currency,
        amountLocal,
        scopeJson,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'license.grant',
        entityType: 'photo',
        entityId: photo.id,
        metadata: { licenseType: product.type, amountUsd, free: true },
        ipAddress: request.ip,
      })
      return { grant: serializeGrant(grant) }
    }

    try {
      const payment = await startLicenseCheckout({
        buyerId: request.userId!,
        buyerEmail: request.authUser!.email,
        buyerName: request.authUser!.name,
        buyerCountry: request.authUser?.country,
        photoId: photo.id,
        productId: product.id,
        licenseType: product.type,
        amountUsd,
        currency,
        agencyId: request.authUser?.agencyId,
        scopeJson,
        requestedProvider: body.provider,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'license.checkout',
        entityType: 'payment',
        entityId: payment.id,
        metadata: { licenseType: product.type, amountUsd, provider: payment.provider },
        ipAddress: request.ip,
      })
      return { checkout: serializeCheckout(payment) }
    } catch (err) {
      return rightsError(reply, err)
    }
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
    try {
      await assertAgencyAction(request.authUser, 'quote')
    } catch (err) {
      return rightsError(reply, err)
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
      where: grantsWhere(request.authUser!),
      include: { photo: true, product: true, buyer: true },
      orderBy: { createdAt: 'desc' },
    })
    return { items: grants.map(serializeGrant) }
  })

  app.get('/licenses/quotes', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const quotes = await prisma.licenseQuote.findMany({
      where: quotesWhere(request.authUser!),
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
    const sameAgency = Boolean(request.authUser?.agencyId && quote.agencyId === request.authUser.agencyId)
    if (quote.requesterId !== request.userId && request.authUser?.accountType !== 'admin' && !sameAgency) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    try {
      await assertAgencyAction(request.authUser, 'quote')
    } catch (err) {
      return rightsError(reply, err)
    }
    if (quote.status !== 'quoted' || quote.quoteUsd == null) {
      return reply.code(400).send({ error: 'Quote has not been priced yet' })
    }

    const body = acceptQuoteSchema.parse(request.body ?? {})

    try {
      assertCanGrant(quote.product, quote.photo, quote.photo.rightsRecord)
    } catch (err) {
      return rightsError(reply, err)
    }

    const existingGrant = await prisma.licenseGrant.findFirst({
      where: quote.agencyId
        ? { agencyId: quote.agencyId, photoId: quote.photoId, licenseType: 'rights_managed' }
        : { buyerId: quote.requesterId, photoId: quote.photoId, licenseType: 'rights_managed' },
      include: { photo: true, product: true, buyer: true },
    })
    if (existingGrant) return { grant: serializeGrant(existingGrant), existing: true }

    const pricing = await pricingForCountry(request.authUser?.country)
    const scopeJson = {
      grant: 'usage_permission',
      ownership: false,
      territory: quote.territory,
      duration: quote.duration,
      channels: quote.channels,
    }

    if (quote.quoteUsd <= 0) {
      const grant = await issueGrant({
        buyerId: quote.requesterId,
        photoId: quote.photoId,
        productId: quote.productId,
        agencyId: quote.agencyId,
        quoteId: quote.id,
        licenseType: 'rights_managed',
        amountUsd: quote.quoteUsd,
        currency: pricing.currency,
        amountLocal: convertFromUsd(quote.quoteUsd, pricing.rateToUsd),
        scopeJson,
      })
      return { grant: serializeGrant(grant) }
    }

    try {
      const payment = await startLicenseCheckout({
        buyerId: quote.requesterId,
        buyerEmail: request.authUser!.email,
        buyerName: request.authUser!.name,
        buyerCountry: request.authUser?.country,
        photoId: quote.photoId,
        productId: quote.productId,
        licenseType: 'rights_managed',
        amountUsd: quote.quoteUsd,
        currency: body.currency ?? pricing.currency,
        agencyId: quote.agencyId,
        quoteId: quote.id,
        scopeJson,
        requestedProvider: body.provider,
      })
      return { checkout: serializeCheckout(payment) }
    } catch (err) {
      return rightsError(reply, err)
    }
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
    config: { rateLimit: DOWNLOAD_RATE_LIMIT },
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
    if (!canAccessGrant(request.authUser!, grant)) {
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
    config: { rateLimit: DOWNLOAD_RATE_LIMIT },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const grant = await prisma.licenseGrant.findUnique({
      where: { id },
      include: { photo: { include: { assets: true } } },
    })
    if (!grant) return reply.code(404).send({ error: 'Grant not found' })
    if (!canAccessGrant(request.authUser!, grant)) {
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
