import type { FastifyInstance } from 'fastify'
import { patchLegalOverlaySchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import {
  globalRightsStandardDto,
  loadOverlay,
  overlaySeedForCountry,
  seedLegalOverlays,
  serializeLegalOverlay,
} from '../lib/legal.js'
import { overlayContributorAllowedBlocked } from '@vuekumi/shared'
import { prisma } from '../lib/prisma.js'

export async function legalRoutes(app: FastifyInstance) {
  app.get('/legal/standard', async () => globalRightsStandardDto())

  app.get('/legal/agreements', async () => ({
    items: globalRightsStandardDto().agreementStack,
    counselGated: globalRightsStandardDto().counselGated,
  }))

  app.get('/legal/overlays/:code', async (request, reply) => {
    const { code } = request.params as { code: string }
    const overlay = await loadOverlay(code)
    if (!overlay) return reply.code(404).send({ error: 'No overlay for that country' })
    return { overlay: serializeLegalOverlay(overlay, overlay.country) }
  })

  const listOverlays = { preHandler: requireAdminCapability(app, 'geo.countries.list') }
  const writeOverlays = { preHandler: requireAdminCapability(app, 'geo.countries.write') }

  app.get('/admin/legal/overlays', listOverlays, async (request) => {
    const query = request.query as { kind?: string }
    const overlays = await prisma.legalOverlay.findMany({
      where: query.kind && query.kind !== 'all' ? { overlayKind: query.kind } : undefined,
      include: { country: true },
      orderBy: { countryCode: 'asc' },
    })
    return {
      standard: globalRightsStandardDto(),
      items: overlays.map((row) => serializeLegalOverlay(row, row.country)),
    }
  })

  app.post('/admin/legal/overlays/seed', writeOverlays, async (request) => {
    await seedLegalOverlays()
    const count = await prisma.legalOverlay.count()
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.seed_legal_overlays',
      entityType: 'legal_overlay',
      metadata: { count },
    })
    return { ok: true as const, count }
  })

  app.patch('/admin/legal/overlays/:code', writeOverlays, async (request, reply) => {
    const { code } = request.params as { code: string }
    const body = patchLegalOverlaySchema.parse(request.body)
    const existing = await prisma.legalOverlay.findUnique({
      where: { countryCode: code.toUpperCase() },
      include: { country: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Overlay not found' })
    const nextAllowed = body.contributorAllowed ?? existing.contributorAllowed
    const blocked = overlayContributorAllowedBlocked({
      region: existing.country.region,
      contributorEligible: existing.country.contributorEligible,
      overlayContributorAllowed: nextAllowed,
    })
    if (blocked) return reply.code(400).send({ error: blocked })
    const updated = await prisma.legalOverlay.update({
      where: { countryCode: existing.countryCode },
      data: {
        dataTransferNotice: body.dataTransferNotice,
        commissionedPhotoPrompt: body.commissionedPhotoPrompt,
        extraNotice: body.extraNotice === undefined ? undefined : body.extraNotice,
        biometricForbidden: body.biometricForbidden,
        contributorAllowed: nextAllowed,
      },
      include: { country: true },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.patch_legal_overlay',
      entityType: 'legal_overlay',
      entityId: updated.countryCode,
      metadata: { contributorAllowed: updated.contributorAllowed, biometricForbidden: updated.biometricForbidden },
    })
    return { overlay: serializeLegalOverlay(updated, updated.country) }
  })
}

export { overlaySeedForCountry }
